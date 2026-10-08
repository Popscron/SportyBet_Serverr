const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const parseIntEnv = (name, fallback) => {
  const v = Number.parseInt(String(process.env[name] || ""), 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/** True for POST /api/login — it has its own per-account limiters below. */
function isLoginRequest(req) {
  const u = (req.originalUrl || req.url || "").split("?")[0];
  return req.method === "POST" && /\/api\/login\/?$/.test(u);
}

/**
 * Same skips as before: heavy GET polling endpoints should not trip global throttles.
 * Login is also skipped so an IP's normal app traffic (or many users behind one
 * mobile-carrier IP) can never block someone from logging in.
 */
function skipHeavyPollingGet(req) {
  if (isLoginRequest(req)) return true;
  if (req.method !== "GET") return false;
  const u = req.originalUrl || req.url || "";
  return u.includes("/cashout");
}

const json429 = (req, res, next, options) => {
  // Log so a shared/wrong client IP (e.g. proxy not forwarding X-Forwarded-For) is visible in logs.
  console.warn("[rateLimit] 429", {
    path: req.originalUrl,
    ip: req.ip,
    xff: req.headers["x-forwarded-for"],
    limit: options?.limit,
  });
  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
  });
};

/** Per-account key for login: identifier (phone/email) + client IP. */
function loginKey(req) {
  const id = String(req.body?.identifier || "").trim().toLowerCase();
  const ip = ipKeyGenerator(req.ip || "");
  return id ? `login:${id}:${ip}` : `login-ip:${ip}`;
}

/**
 * Burst limiter — stops thousands of requests per second from a single IP.
 * Default: 20 requests per 1 second (override API_BURST_WINDOW_MS + API_BURST_MAX).
 */
const apiBurstLimiter = rateLimit({
  windowMs: parseIntEnv("API_BURST_WINDOW_MS", 1000),
  max: parseIntEnv("API_BURST_MAX", 20),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipHeavyPollingGet,
  handler: json429,
});

/**
 * Per-minute ceiling (sustained abuse / scanners).
 * Default: 180 / minute (override API_PER_MINUTE_MAX).
 */
const apiPerMinuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseIntEnv("API_PER_MINUTE_MAX", 180),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipHeavyPollingGet,
  handler: json429,
});

/** Long-window cap (override API_RATE_LIMIT_MAX). */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseIntEnv("API_RATE_LIMIT_MAX", 4000),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipHeavyPollingGet,
  handler: json429,
});

const skipReadsAndLogin = (req) =>
  req.method === "GET" ||
  req.method === "HEAD" ||
  req.method === "OPTIONS" ||
  isLoginRequest(req);

/** Write burst — POST/PUT/PATCH/DELETE spikes (default 12/sec). */
const apiWriteBurstLimiter = rateLimit({
  windowMs: parseIntEnv("API_WRITE_BURST_WINDOW_MS", 1000),
  max: parseIntEnv("API_WRITE_BURST_MAX", 12),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipReadsAndLogin,
  handler: json429,
});

/** Stricter cap for mutating requests over 15 minutes. */
const apiWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseIntEnv("API_WRITE_RATE_LIMIT_MAX", 400),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipReadsAndLogin,
  handler: json429,
});

/**
 * Login limiters are keyed per account (identifier + IP), not per IP alone, and only
 * failed attempts count — so one person's wrong passwords, or many users sharing a
 * carrier/proxy IP, never lock other people out.
 */
const loginBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseIntEnv("API_LOGIN_BURST_MAX", 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: loginKey,
  skipSuccessfulRequests: true,
  handler: json429,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseIntEnv("API_LOGIN_RATE_LIMIT_MAX", 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: loginKey,
  skipSuccessfulRequests: true,
  handler: json429,
});

/**
 * Apply /api throttling (after body parsers, before route modules).
 * Order: tight windows first so per-second abuse is rejected before long-window counters.
 */
function applyApiRateLimit(app) {
  app.use("/api", apiBurstLimiter);
  app.use("/api", apiPerMinuteLimiter);
  app.use("/api", apiLimiter);
  app.use("/api", apiWriteBurstLimiter);
  app.use("/api", apiWriteLimiter);
  app.use("/api/login", loginBurstLimiter);
  app.use("/api/login", authLimiter);
}

module.exports = {
  apiBurstLimiter,
  apiPerMinuteLimiter,
  apiLimiter,
  apiWriteBurstLimiter,
  apiWriteLimiter,
  loginBurstLimiter,
  authLimiter,
  applyApiRateLimit,
};

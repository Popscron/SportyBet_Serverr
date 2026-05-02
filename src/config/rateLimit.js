const rateLimit = require("express-rate-limit");

const parseIntEnv = (name, fallback) => {
  const v = Number.parseInt(String(process.env[name] || ""), 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/** Same skips as before: heavy GET polling endpoints should not trip global throttles. */
function skipHeavyPollingGet(req) {
  if (req.method !== "GET") return false;
  const u = req.originalUrl || req.url || "";
  return u.includes("/cashout");
}

const json429 = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
  });
};

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

/** Write burst — POST/PUT/PATCH/DELETE spikes (default 12/sec). */
const apiWriteBurstLimiter = rateLimit({
  windowMs: parseIntEnv("API_WRITE_BURST_WINDOW_MS", 1000),
  max: parseIntEnv("API_WRITE_BURST_MAX", 12),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  handler: json429,
});

/** Stricter cap for mutating requests over 15 minutes. */
const apiWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseIntEnv("API_WRITE_RATE_LIMIT_MAX", 400),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  handler: json429,
});

const loginBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseIntEnv("API_LOGIN_BURST_MAX", 25),
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseIntEnv("API_LOGIN_RATE_LIMIT_MAX", 40),
  standardHeaders: true,
  legacyHeaders: false,
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

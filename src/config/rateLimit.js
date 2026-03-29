const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.method !== "GET") return false;
    const u = req.originalUrl || req.url || "";
    return u.includes("/cashout");
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Apply global /api throttling (after body parsers, before route modules).
 */
function applyApiRateLimit(app) {
  app.use("/api", apiLimiter);
  app.use("/api/login", authLimiter);
}

module.exports = {
  apiLimiter,
  authLimiter,
  applyApiRateLimit,
};

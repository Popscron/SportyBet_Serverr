/**
 * Auth / JWT configuration (single source of truth for signing and verification).
 */
module.exports = {
  jwtSecret: process.env.JWT_SECRET || "your_secret_key",
};

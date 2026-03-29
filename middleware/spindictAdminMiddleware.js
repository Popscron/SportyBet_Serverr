/**
 * Use after spindictAuthMiddleware. Requires req.user.role === 'admin'.
 */
function requireSpindictAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }
  next();
}

module.exports = requireSpindictAdmin;

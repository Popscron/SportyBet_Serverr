const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { jwtSecret } = require("../src/config/auth.config");

/**
 * Admin auth: cookie `sportybetToken` or `Authorization: Bearer`.
 * Supports admin JWT (decoded.email) or user JWT (decoded.id) with role admin.
 */
async function adminAuth(req, res, next) {
  try {
    let token = req.cookies?.sportybetToken;

    if (!token) {
      token = req.header("Authorization")?.replace("Bearer ", "");
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    const decoded = jwt.verify(token, jwtSecret);

    if (decoded.email) {
      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase());
      if (!adminEmails.includes(decoded.email.toLowerCase())) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin privileges required.",
        });
      }
      req.user = { _id: decoded.email, role: "admin", email: decoded.email };
      return next();
    }

    if (decoded.id) {
      const user = await User.findById(decoded.id);
      if (!user || user.token !== token) {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please log in again.",
        });
      }

      if (user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin privileges required.",
        });
      }

      req.user = user;
      req.user.id = user._id;
      return next();
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token format.",
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
}

module.exports = adminAuth;

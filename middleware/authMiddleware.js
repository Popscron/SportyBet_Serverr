const jwt = require("jsonwebtoken");
const User = require("../models/user");
const SECRET_KEY = "your_secret_key";
const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    // ✅ Check if token exists in tokens array (new system) or matches single token (backward compatibility)
    const tokens = user.tokens || [];
    const isValidToken = tokens.includes(token) || user.token === token;

    if (!isValidToken) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = authMiddleware;

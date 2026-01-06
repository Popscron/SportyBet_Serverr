const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Device = require("../models/Device");
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

    // Check if user is premium and has active subscription
    const isPremium = user.subscription === "Premium" && 
                     (!user.expiry || new Date(user.expiry) > new Date());
    
    // For premium users, allow multiple tokens (don't check user.token)
    // For basic users, check token to ensure only one device is logged in
    if (!isPremium && user.token && user.token !== token) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    // Optional: Validate device if deviceId is provided in headers
    // This ensures the request is coming from an active device
    const deviceId = req.header("X-Device-Id");
    if (deviceId) {
      const device = await Device.findOne({
        userId: user._id,
        deviceId: deviceId,
        isActive: true,
      });

      if (!device) {
        // Device not found or inactive - but don't block the request
        // Just log it for monitoring purposes
        console.log(`[Auth] Device validation failed for user ${user._id}, device ${deviceId}`);
      } else {
        // Update last activity timestamp
        device.lastLoginAt = new Date();
        await device.save();
      }
    }

    req.user = user;
    req.user.id = user._id; // Ensure id is available
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = authMiddleware;

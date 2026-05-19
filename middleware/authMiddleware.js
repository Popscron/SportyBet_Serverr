const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Device = require("../models/Device");
const { jwtSecret } = require("../src/config/auth.config");
const { getSubscriptionInfo } = require("../src/services/auth/subscription.helper");

const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id).lean();

    if (!user) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    // Use entitlements (handles legacy tiers like "Games", "Optimum", etc.)
    const subInfo = getSubscriptionInfo(user);
    const maxDevices = subInfo.maxDevices ?? 1;
    const allowMultipleSessions = maxDevices > 1;
    
    // ============================================================================
    // OLD BEHAVIOR (Currently Active):
    // - For Basic users: Check if token matches user.token in database
    // - When Basic user logs in on Device 2, token is updated in database
    // - Device 1's token no longer matches, so it gets logged out
    // - Result: Only the most recent device stays logged in
    //
    // NEW BEHAVIOR (Currently Disabled):
    // - For Basic users: Device limit is enforced before token generation
    // - Device 2 is blocked with RESET_REQUEST_NEEDED before login succeeds
    // - Device 1's token remains valid, so it stays logged in
    // - This check can be removed if new behavior is re-enabled
    //
    // ============================================================================
    // IMPORTANT: Token validation logic
    // - For Basic users: If token is null, reject (single device enforcement)
    // - For Premium users: If token is null BUT they have active devices, allow (multi-device support)
    // - For Premium users: If token is null AND no active devices, reject (all devices logged out)
    // - Admin force logout: If token is null and no active devices, reject (admin cleared everything)
    
    if (!user.token) {
      if (allowMultipleSessions) {
        const activeDevices = await Device.find({
          userId: user._id,
          isActive: true,
        }).lean();
        if (activeDevices.length === 0) {
          return res.status(401).json({ error: "Session expired. Please log in again." });
        }
      } else {
        return res.status(401).json({ error: "Session expired. Please log in again." });
      }
    }
    
    // Multi-device tiers: JWT is enough. Single-device: token must match DB (latest login wins).
    if (!allowMultipleSessions && user.token && user.token !== token) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    // CRITICAL: Validate device if deviceId is provided in headers
    // This ensures the request is coming from an active device
    // If device is logged out (isActive: false), reject the request
    const deviceId = req.header("X-Device-Id");
    if (deviceId) {
      const device = await Device.findOne({
        userId: user._id,
        deviceId: deviceId,
      }).lean();

      if (!device) {
        // Device not found - allow request (might be first time or device not registered yet)
      } else if (!device.isActive) {
        // Device exists but is inactive (logged out) - REJECT the request
        return res.status(401).json({
          error: "This device has been logged out. Please log in again.",
          deviceLoggedOut: true
        });
      } else {
        // Device is active - update last activity timestamp (fire-and-forget)
        Device.updateOne(
          { _id: device._id },
          { $set: { lastLoginAt: new Date() } }
        ).exec();
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

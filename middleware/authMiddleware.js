const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Device = require("../models/Device");
const { jwtSecret } = require("../src/config/auth.config");

const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id).lean();

    if (!user) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    // Check if user is premium and has active subscription
    const isPremium =
      (user.subscription === "Premium" || user.subscription === "Premium Plus") &&
      (!user.expiry || new Date(user.expiry) > new Date());
    
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
      // Check if Premium user has active devices (multi-device support)
      if (isPremium) {
        const activeDevices = await Device.find({
          userId: user._id,
          isActive: true,
        }).lean();
        
        // If Premium user has active devices, allow the request (multi-device support)
        if (activeDevices.length > 0) {
          // Premium user with active devices - token can be null, allow request
        } else {
          // Premium user with no active devices - token is null, reject (all devices logged out)
          return res.status(401).json({ error: "Session expired. Please log in again." });
        }
      } else {
        // Basic user with null token - reject (single device enforcement)
        return res.status(401).json({ error: "Session expired. Please log in again." });
      }
    }
    
    // For premium users, allow multiple tokens (don't check if token matches user.token)
    // For basic users, check token to ensure only one device is logged in (OLD BEHAVIOR)
    if (!isPremium && user.token !== token) {
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

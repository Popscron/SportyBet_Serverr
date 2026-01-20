const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const DeviceRequest = require("../models/DeviceRequest");
const DeviceDeactivationRequest = require("../models/DeviceDeactivationRequest");
const Device = require("../models/Device");
const User = require("../models/user");
const SECRET_KEY = "your_secret_key";

// Helper function to get subscription info
const getSubscriptionInfo = (user) => {
  const isActive = !user.expiry || new Date(user.expiry) > new Date();
  const subscription = user.subscription || "Basic";
  
  let isPremium = false;
  let maxDevices = 1; // Basic gets 1 device limit
  
  if (isActive) {
    if (subscription === "Premium") {
      isPremium = true;
      maxDevices = 2; // Premium gets 2 devices
    }
  }
  // Basic gets 1 device (default)
  
  return {
    subscription,
    isPremium,
    maxDevices,
    isActive
  };
};

// Admin authentication middleware that supports both cookies and Authorization header
const adminAuth = async (req, res, next) => {
  try {
    // Try to get token from cookie first (for website)
    let token = req.cookies?.sportybetToken;
    
    // If no cookie, try Authorization header (for API)
    if (!token) {
      token = req.header("Authorization")?.replace("Bearer ", "");
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, SECRET_KEY);
    
    // For cookie-based auth (admin login), decoded.email is set
    // For user auth, decoded.id is set
    let user;
    if (decoded.email) {
      // Admin login via cookie - check if email is in admin list
      const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
      if (!adminEmails.includes(decoded.email.toLowerCase())) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin privileges required.",
        });
      }
      // Create a minimal user object for admin
      req.user = { _id: decoded.email, role: "admin", email: decoded.email };
      return next();
    } else if (decoded.id) {
      // User auth - get user from database
      user = await User.findById(decoded.id);
      if (!user || user.token !== token) {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please log in again.",
        });
      }
      
      // Check if user is admin
      if (user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin privileges required.",
        });
      }
      
      req.user = user;
      req.user.id = user._id;
      return next();
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid token format.",
      });
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

// Test route to verify routing works (no auth required for testing)
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Admin routes are working", path: "/api/admin/test" });
});

// All admin routes require authentication
router.use(adminAuth);

// @route   GET /api/admin/device-requests
// @desc    Get all pending device requests (Admin only)
// @access  Private (Admin)
router.get("/device-requests", async (req, res) => {
  try {
    console.log("[Device Requests] Route hit - GET /api/admin/device-requests");
    const { status } = req.query;
    console.log("[Device Requests] Query status:", status);
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const requests = await DeviceRequest.find(query)
      .populate("userId", "name email username mobileNumber subscription expiry")
      .populate("currentActiveDevices", "deviceName platform lastLoginAt")
      .sort({ requestedAt: -1 });

    console.log("[Device Requests] Found requests:", requests.length);
    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("Get device requests error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching device requests",
      error: error.message,
    });
  }
});

// @route   GET /api/admin/device-requests/:id
// @desc    Get a specific device request by ID (Admin only)
// @access  Private (Admin)
router.get("/device-requests/:id", async (req, res) => {
  try {
    const request = await DeviceRequest.findById(req.params.id)
      .populate("userId", "name email username mobileNumber subscription expiry")
      .populate("currentActiveDevices", "deviceName platform lastLoginAt deviceId")
      .populate("reviewedBy", "name email");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Device request not found",
      });
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Get device request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching device request",
      error: error.message,
    });
  }
});

// @route   GET /api/admin/device-requests/:id/devices
// @desc    Get active devices for a device request (Admin only)
// @access  Private (Admin)
router.get("/device-requests/:id/devices", async (req, res) => {
  try {
    const request = await DeviceRequest.findById(req.params.id)
      .populate("userId", "_id");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Device request not found",
      });
    }

    // Get current active devices for this user
    const activeDevices = await Device.find({
      userId: request.userId._id,
      isActive: true,
    }).sort({ lastLoginAt: -1 });

    res.json({
      success: true,
      data: activeDevices,
      count: activeDevices.length,
    });
  } catch (error) {
    console.error("Get active devices error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching active devices",
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/device-requests/:id/approve
// @desc    Approve a device request (Admin only)
// @access  Private (Admin)
router.put("/device-requests/:id/approve", async (req, res) => {
  try {
    const request = await DeviceRequest.findById(req.params.id)
      .populate("userId")
      .populate("currentActiveDevices");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Device request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status}`,
      });
    }

    const user = request.userId;
    const subInfo = getSubscriptionInfo(user);
    const isPremium = subInfo.isPremium;
    const maxDevices = subInfo.maxDevices;

    // Get current active devices
    const activeDevices = await Device.find({
      userId: user._id,
      isActive: true,
    });

    // Get deviceIdToLogout or deviceIdsToLogout from request body (admin selects which device(s) to logout)
    const { deviceIdToLogout, deviceIdsToLogout } = req.body;
    
    // Support both single deviceId and array of deviceIds
    const devicesToLogout = deviceIdsToLogout && Array.isArray(deviceIdsToLogout) && deviceIdsToLogout.length > 0
      ? deviceIdsToLogout
      : deviceIdToLogout
      ? [deviceIdToLogout]
      : [];

    console.log(`[Admin Approve] Active devices: ${activeDevices.length}, Max: ${maxDevices}`);
    console.log(`[Admin Approve] Devices to logout:`, devicesToLogout);
    console.log(`[Admin Approve] Active device IDs:`, activeDevices.map(d => ({ deviceId: d.deviceId, _id: d._id, deviceName: d.deviceName })));

    // If user has reached max devices, logout the selected device(s)
    if (activeDevices.length >= maxDevices) {
      if (devicesToLogout.length === 0) {
        return res.status(400).json({
          success: false,
          message: "deviceIdToLogout or deviceIdsToLogout is required when user has reached device limit",
          availableDevices: activeDevices.map(d => ({
            _id: d._id.toString(),
            deviceId: d.deviceId,
            deviceName: d.deviceName,
            platform: d.platform,
          })),
        });
      }

      // Logout all selected devices
      const logoutResults = [];
      for (const deviceIdentifier of devicesToLogout) {
        // Find the device to logout by deviceId (try exact match first)
        let deviceToLogout = await Device.findOne({
          userId: user._id,
          deviceId: deviceIdentifier,
          isActive: true,
        });

        // If not found by deviceId, try by _id (in case admin sent MongoDB _id instead)
        if (!deviceToLogout) {
          try {
            deviceToLogout = await Device.findOne({
              userId: user._id,
              _id: deviceIdentifier,
              isActive: true,
            });
            console.log(`[Admin Approve] Found device by _id: ${deviceIdentifier}`);
          } catch (idError) {
            // Invalid ObjectId format, continue with deviceId search
            console.log(`[Admin Approve] ${deviceIdentifier} is not a valid ObjectId, using deviceId search`);
          }
        }

        if (!deviceToLogout) {
          console.error(`[Admin Approve] Device not found - deviceIdentifier: ${deviceIdentifier}, userId: ${user._id}`);
          logoutResults.push({ deviceIdentifier, success: false, error: "Device not found" });
          continue;
        }

        console.log(`[Admin Approve] Logging out device: ${deviceToLogout.deviceId} (${deviceToLogout._id})`);

        // Deactivate the selected device
        const updatedDevice = await Device.findByIdAndUpdate(
          deviceToLogout._id,
          {
            isActive: false,
            lastLogoutAt: new Date(),
          },
          { new: true }
        );

        if (!updatedDevice || updatedDevice.isActive !== false) {
          console.error(`[Admin Approve] Failed to deactivate device: ${deviceToLogout._id}`);
          logoutResults.push({ deviceIdentifier, success: false, error: "Failed to deactivate" });
          continue;
        }

        console.log(`[Admin Approve] Device successfully deactivated: ${updatedDevice.deviceId}`);
        logoutResults.push({ deviceIdentifier, success: true, deviceId: updatedDevice.deviceId });
      }

      // Check if at least one device was successfully logged out
      const successfulLogouts = logoutResults.filter(r => r.success);
      if (successfulLogouts.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Failed to logout any devices. Please check the device IDs and try again.",
          logoutResults: logoutResults,
          availableDevices: activeDevices.map(d => ({
            _id: d._id.toString(),
            deviceId: d.deviceId,
            deviceName: d.deviceName,
            platform: d.platform,
          })),
        });
      }

      // CRITICAL: For all users, we need to ensure logged out devices cannot authenticate
      // For Basic users: Remove user's token to logout all devices (since they can only have 1 device)
      // For Premium users: We keep token but authMiddleware will check device isActive status
      // The authMiddleware now properly rejects requests from inactive devices
      if (!isPremium) {
        // Basic users: Clear token to ensure logged out devices can't use it
        await User.findByIdAndUpdate(user._id, { token: null });
        console.log(`✅ Logged out ${successfulLogouts.length} device(s) and removed token for Basic user ${user._id}`);
      } else {
        // Premium users: Devices are logged out via isActive=false
        // authMiddleware will check device isActive status and reject requests from inactive devices
        // Token is preserved for remaining active devices
        console.log(`✅ Logged out ${successfulLogouts.length} device(s) for Premium user ${user._id} (devices marked inactive, authMiddleware will reject their requests)`);
      }
      
      // Re-fetch active devices after deactivation to ensure count is correct
      const activeDevicesAfterLogout = await Device.find({
        userId: user._id,
        isActive: true,
      });
      console.log(`[Admin Approve] Active devices after logout: ${activeDevicesAfterLogout.length}`);
    }

    // Verify we have space for new device before creating
    const finalActiveDevices = await Device.find({
      userId: user._id,
      isActive: true,
    });

    if (finalActiveDevices.length >= maxDevices) {
      console.error(`[Admin Approve] Still at device limit after logout! Active: ${finalActiveDevices.length}, Max: ${maxDevices}`);
      return res.status(400).json({
        success: false,
        message: "Cannot create new device. User is still at device limit. Please ensure a device was properly logged out.",
        currentActiveDevices: finalActiveDevices.length,
        maxDevices: maxDevices,
      });
    }

    // Create or reactivate the device (avoid duplicate key on userId+deviceId)
    let newDevice;
    const existingDevice = await Device.findOne({
      userId: user._id,
      deviceId: request.deviceInfo.deviceId,
    });

    if (existingDevice) {
      // Reactivate and update existing device
      newDevice = await Device.findByIdAndUpdate(
        existingDevice._id,
        {
          deviceName: request.deviceInfo.deviceName,
          modelName: request.deviceInfo.modelName,
          modelId: request.deviceInfo.modelId,
          deviceType: request.deviceInfo.deviceType,
          platform: request.deviceInfo.platform,
          osVersion: request.deviceInfo.osVersion,
          appVersion: request.deviceInfo.appVersion,
          ipAddress: request.deviceInfo.ipAddress,
          location: request.deviceInfo.location,
          isActive: true,
          lastLoginAt: new Date(),
          $inc: { loginCount: 1 },
        },
        { new: true }
      );
      console.log(`[Admin Approve] Reactivated existing device ${existingDevice.deviceId}`);
    } else {
      // Create the device since it doesn't exist
      newDevice = await Device.create({
        userId: user._id,
        deviceId: request.deviceInfo.deviceId,
        deviceName: request.deviceInfo.deviceName,
        modelName: request.deviceInfo.modelName,
        modelId: request.deviceInfo.modelId,
        deviceType: request.deviceInfo.deviceType,
        platform: request.deviceInfo.platform,
        osVersion: request.deviceInfo.osVersion,
        appVersion: request.deviceInfo.appVersion,
        ipAddress: request.deviceInfo.ipAddress,
        location: request.deviceInfo.location,
        lastLoginAt: new Date(),
        isActive: true,
        loginCount: 1,
      });
      console.log(`[Admin Approve] Created new device ${newDevice.deviceId}`);
    }

      // Update the request status
      request.status = "approved";
      // For cookie-based admin auth, reviewedBy might be email string, skip it
      // For user-based auth, reviewedBy is user._id
      if (req.user._id && typeof req.user._id === 'object') {
        request.reviewedBy = req.user._id;
      }
      request.reviewedAt = new Date();
      await request.save();

    res.json({
      success: true,
      message: "Device request approved successfully",
      data: {
        request,
        newDevice,
      },
    });
  } catch (error) {
    console.error("Approve device request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error approving device request",
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/device-requests/:id/reject
// @desc    Reject a device request (Admin only)
// @access  Private (Admin)
router.put("/device-requests/:id/reject", async (req, res) => {
  try {
    const { rejectionReason } = req.body;

    const request = await DeviceRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Device request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status}`,
      });
    }

    // Update the request status
    request.status = "rejected";
    // For cookie-based admin auth, reviewedBy might be email string, skip it
    // For user-based auth, reviewedBy is user._id
    if (req.user._id && typeof req.user._id === 'object') {
      request.reviewedBy = req.user._id;
    }
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason || "No reason provided";
    await request.save();

    res.json({
      success: true,
      message: "Device request rejected",
      data: request,
    });
  } catch (error) {
    console.error("Reject device request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error rejecting device request",
      error: error.message,
    });
  }
});

// @route   GET /api/admin/users/:userId/devices
// @desc    Get all devices for a specific user (Admin only)
// @access  Private (Admin)
router.get("/users/:userId/devices", async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.params.userId })
      .sort({ lastLoginAt: -1 });

    const user = await User.findById(req.params.userId)
      .select("name email username mobileNumber subscription expiry");

    res.json({
      success: true,
      data: {
        user,
        devices,
        activeDevices: devices.filter(d => d.isActive),
        inactiveDevices: devices.filter(d => !d.isActive),
      },
    });
  } catch (error) {
    console.error("Get user devices error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching user devices",
      error: error.message,
    });
  }
});

// @route   GET /api/admin/device-deactivation-requests
// @desc    Get all device deactivation requests (Admin only)
// @access  Private (Admin)
router.get("/device-deactivation-requests", async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }

    const requests = await DeviceDeactivationRequest.find(query)
      .populate("userId", "name email username mobileNumber subscription expiry")
      .populate("device", "deviceName platform deviceType osVersion appVersion lastLoginAt")
      .populate("reviewedBy", "name email")
      .sort({ requestedAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("Get device deactivation requests error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching device deactivation requests",
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/device-deactivation-requests/:id/approve
// @desc    Approve a device deactivation request (Admin only)
// @access  Private (Admin)
router.put("/device-deactivation-requests/:id/approve", async (req, res) => {
  try {
    const request = await DeviceDeactivationRequest.findById(req.params.id)
      .populate("device")
      .populate("userId");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Deactivation request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status}`,
      });
    }

    // Deactivate the device
    const device = await Device.findById(request.device._id);
    if (device) {
      device.isActive = false;
      device.lastLogoutAt = new Date();
      await device.save();
    }

    // Update the request status
    request.status = "approved";
    request.reviewedBy = req.user?.id || null;
    request.reviewedAt = new Date();
    await request.save();

    res.json({
      success: true,
      message: "Device deactivation request approved and device deactivated successfully",
      data: request,
    });
  } catch (error) {
    console.error("Approve device deactivation request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error approving device deactivation request",
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/device-deactivation-requests/:id/reject
// @desc    Reject a device deactivation request (Admin only)
// @access  Private (Admin)
router.put("/device-deactivation-requests/:id/reject", async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const request = await DeviceDeactivationRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Deactivation request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status}`,
      });
    }

    request.status = "rejected";
    request.reviewedBy = req.user?.id || null;
    request.reviewedAt = new Date();
    if (rejectionReason) {
      request.rejectionReason = rejectionReason;
    }
    await request.save();

    res.json({
      success: true,
      message: "Device deactivation request rejected",
      data: request,
    });
  } catch (error) {
    console.error("Reject device deactivation request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error rejecting device deactivation request",
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/devices/:deviceId/deactivate
// @desc    Deactivate a device (Admin only)
// @access  Private (Admin)
router.put("/devices/:deviceId/deactivate", async (req, res) => {
  try {
    const device = await Device.findById(req.params.deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found",
      });
    }

    device.isActive = false;
    device.lastLogoutAt = new Date();
    await device.save();

    res.json({
      success: true,
      message: "Device deactivated successfully",
      data: device,
    });
  } catch (error) {
    console.error("Deactivate device error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deactivating device",
      error: error.message,
    });
  }
});

// Load SMS points for a user
router.post("/load-sms-points", async (req, res) => {
  try {
    const { userId, points } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    if (points === undefined || points === null || points < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid points amount is required (must be >= 0)"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Update SMS points
    user.smsPoints = (user.smsPoints || 0) + Number(points);
    await user.save();

    return res.json({
      success: true,
      message: `Successfully loaded ${points} SMS points`,
      data: {
        userId: user._id,
        smsPoints: user.smsPoints,
        pointsAdded: Number(points)
      }
    });
  } catch (error) {
    console.error("Error loading SMS points:", error);
    return res.status(500).json({
      success: false,
      message: "Server error loading SMS points",
      error: error.message
    });
  }
});

// @route   POST /api/admin/users/:userId/clear-devices
// @desc    Clear all devices and token for a user (Admin only) - Forces logout
// @access  Private (Admin)
router.post("/users/:userId/clear-devices", async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete all devices for this user
    const deleteResult = await Device.deleteMany({ userId });
    
    // Clear user's authentication token
    await User.findByIdAndUpdate(userId, { token: null });

    res.json({
      success: true,
      message: `Successfully cleared ${deleteResult.deletedCount} device(s) and authentication token for user ${user.username}`,
      data: {
        userId: user._id,
        username: user.username,
        email: user.email,
        devicesDeleted: deleteResult.deletedCount,
        tokenCleared: true,
      },
    });
  } catch (error) {
    console.error("Clear user devices error:", error);
    res.status(500).json({
      success: false,
      message: "Server error clearing user devices",
      error: error.message,
    });
  }
});

module.exports = router;


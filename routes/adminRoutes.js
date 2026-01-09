const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const DeviceRequest = require("../models/DeviceRequest");
const Device = require("../models/Device");
const User = require("../models/user");
const SECRET_KEY = "your_secret_key";

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

    // Get deviceIdToLogout from request body (admin selects which device to logout)
    const { deviceIdToLogout } = req.body;

    // If user has reached max devices, logout the selected device
    if (activeDevices.length >= maxDevices) {
      if (!deviceIdToLogout) {
        return res.status(400).json({
          success: false,
          message: "deviceIdToLogout is required when user has reached device limit",
        });
      }

      // Find the device to logout by deviceId
      const deviceToLogout = await Device.findOne({
        userId: user._id,
        deviceId: deviceIdToLogout,
        isActive: true,
      });

      if (!deviceToLogout) {
        return res.status(404).json({
          success: false,
          message: "Device to logout not found or is not active",
        });
      }

      // Deactivate the selected device
      await Device.findByIdAndUpdate(deviceToLogout._id, {
        isActive: false,
        lastLogoutAt: new Date(),
      });
    }

    // Create the new device
    const newDevice = await Device.create({
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

module.exports = router;


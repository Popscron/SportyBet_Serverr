const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const DeviceRequest = require("../models/DeviceRequest");
const Device = require("../models/Device");
const User = require("../models/user");

// All admin routes require authentication
router.use(authMiddleware);

// Helper function to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }
  next();
};

// @route   GET /api/admin/device-requests
// @desc    Get all pending device requests (Admin only)
// @access  Private (Admin)
router.get("/device-requests", isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const requests = await DeviceRequest.find(query)
      .populate("userId", "name email username mobileNumber subscription expiry")
      .populate("currentActiveDevices", "deviceName platform lastLoginAt")
      .sort({ requestedAt: -1 });

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
router.get("/device-requests/:id", isAdmin, async (req, res) => {
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

// @route   PUT /api/admin/device-requests/:id/approve
// @desc    Approve a device request (Admin only)
// @access  Private (Admin)
router.put("/device-requests/:id/approve", isAdmin, async (req, res) => {
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
    const isPremium = user.subscription === "Premium" && 
                     (!user.expiry || new Date(user.expiry) > new Date());
    const maxDevices = isPremium ? 2 : 1;

    // Get current active devices
    const activeDevices = await Device.find({
      userId: user._id,
      isActive: true,
    });

    // If user has reached max devices, deactivate the oldest one
    if (activeDevices.length >= maxDevices) {
      const oldestDevice = await Device.findOne({
        userId: user._id,
        isActive: true,
      }).sort({ lastLoginAt: 1 });

      if (oldestDevice) {
        await Device.findByIdAndUpdate(oldestDevice._id, {
          isActive: false,
          lastLogoutAt: new Date(),
        });
      }
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
    request.reviewedBy = req.user._id;
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
router.put("/device-requests/:id/reject", isAdmin, async (req, res) => {
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
    request.reviewedBy = req.user._id;
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
router.get("/users/:userId/devices", isAdmin, async (req, res) => {
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
router.put("/devices/:deviceId/deactivate", isAdmin, async (req, res) => {
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

module.exports = router;


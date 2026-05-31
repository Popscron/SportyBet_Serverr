const mongoose = require("mongoose");
const DeviceRequest = require("../../models/DeviceRequest");
const DeviceDeactivationRequest = require("../../models/DeviceDeactivationRequest");
const Device = require("../../models/Device");
const User = require("../../models/user");
const NextUpdateDate = require("../../models/NextUpdateDate");

/**
 * Resolve an active device row for logout: exact deviceId, Mongo _id, or short/suffix match.
 */
async function findActiveDeviceForLogout(userId, deviceIdentifier) {
  const idRaw =
    deviceIdentifier != null ? String(deviceIdentifier).trim() : "";
  if (!idRaw) return null;

  let device = await Device.findOne({
    userId,
    deviceId: idRaw,
    isActive: true,
  });
  if (device) return device;

  if (mongoose.Types.ObjectId.isValid(idRaw)) {
    device = await Device.findOne({
      userId,
      _id: new mongoose.Types.ObjectId(idRaw),
      isActive: true,
    });
    if (device) return device;
  }

  const active = await Device.find({ userId, isActive: true });
  const lower = idRaw.toLowerCase();

  const byExactDeviceId = active.find(
    (d) => d.deviceId && String(d.deviceId).toLowerCase() === lower
  );
  if (byExactDeviceId) return byExactDeviceId;

  const suffixMatches = active.filter(
    (d) =>
      (d.deviceId && String(d.deviceId).toLowerCase().endsWith(lower)) ||
      String(d._id).toLowerCase().endsWith(lower)
  );
  if (suffixMatches.length === 1) return suffixMatches[0];

  const contains = active.filter(
    (d) => d.deviceId && String(d.deviceId).toLowerCase().includes(lower)
  );
  if (contains.length === 1) return contains[0];

  return null;
}

function getSubscriptionInfo(user) {
  const isActive = !user.expiry || new Date(user.expiry) > new Date();
  const subscription = user.subscription || "Basic";

  let isPremium = false;
  let maxDevices = 1;

  if (isActive) {
    if (subscription === "Premium") {
      isPremium = true;
      maxDevices = 2;
    }
  }

  return {
    subscription,
    isPremium,
    maxDevices,
    isActive,
  };
}

function deviceRequestReviewerId(reviewer) {
  if (reviewer && reviewer._id && typeof reviewer._id === "object") {
    return reviewer._id;
  }
  return undefined;
}

async function updateNextUpdateDate(body) {
  try {
    const { nextUpdateDate } = body;
    if (!nextUpdateDate || typeof nextUpdateDate !== "string" || !nextUpdateDate.trim()) {
      return {
        status: 400,
        json: {
          success: false,
          message: "nextUpdateDate is required (e.g. '01 Mar' or '15 Apr')",
        },
      };
    }
    let doc = await NextUpdateDate.getOrCreate();
    doc.currentMonth = nextUpdateDate.trim();
    doc.lastCalculated = new Date();
    await doc.save();
    return {
      status: 200,
      json: {
        success: true,
        message: "Next update date updated",
        nextUpdateDate: doc.currentMonth,
      },
    };
  } catch (error) {
    console.error("Error updating next update date:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Error updating next update date",
        error: error.message,
      },
    };
  }
}

async function getDeviceRequests(query) {
  try {
    const { status } = query;
    const q = {};
    if (status) {
      q.status = status;
    }

    const requests = await DeviceRequest.find(q)
      .populate("userId", "name email username mobileNumber subscription expiry")
      .populate("currentActiveDevices", "deviceName platform lastLoginAt")
      .sort({ requestedAt: -1 });

    return {
      status: 200,
      json: {
        success: true,
        data: requests,
        count: requests.length,
      },
    };
  } catch (error) {
    console.error("Get device requests error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error fetching device requests",
        error: error.message,
      },
    };
  }
}

async function getDeviceRequestById(id) {
  try {
    const request = await DeviceRequest.findById(id)
      .populate("userId", "name email username mobileNumber subscription expiry")
      .populate("currentActiveDevices", "deviceName platform lastLoginAt deviceId")
      .populate("reviewedBy", "name email");

    if (!request) {
      return {
        status: 404,
        json: {
          success: false,
          message: "Device request not found",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        data: request,
      },
    };
  } catch (error) {
    console.error("Get device request error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error fetching device request",
        error: error.message,
      },
    };
  }
}

async function getDeviceRequestActiveDevices(id) {
  try {
    const request = await DeviceRequest.findById(id).populate("userId", "_id");

    if (!request) {
      return {
        status: 404,
        json: {
          success: false,
          message: "Device request not found",
        },
      };
    }

    const activeDevices = await Device.find({
      userId: request.userId._id,
      isActive: true,
    }).sort({ lastLoginAt: -1 });

    return {
      status: 200,
      json: {
        success: true,
        data: activeDevices,
        count: activeDevices.length,
      },
    };
  } catch (error) {
    console.error("Get active devices error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error fetching active devices",
        error: error.message,
      },
    };
  }
}

async function approveDeviceRequest(requestId, body, reviewer) {
  try {
    const request = await DeviceRequest.findById(requestId)
      .populate("userId")
      .populate("currentActiveDevices");

    if (!request) {
      return {
        status: 404,
        json: {
          success: false,
          message: "Device request not found",
        },
      };
    }

    if (request.status !== "pending") {
      return {
        status: 400,
        json: {
          success: false,
          message: `Request is already ${request.status}`,
        },
      };
    }

    const user = request.userId;
    const subInfo = getSubscriptionInfo(user);
    const isPremium = subInfo.isPremium;
    const maxDevices = subInfo.maxDevices;

    const activeDevices = await Device.find({
      userId: user._id,
      isActive: true,
    });

    const { deviceIdToLogout, deviceIdsToLogout } = body;

    let devicesToLogout =
      deviceIdsToLogout && Array.isArray(deviceIdsToLogout) && deviceIdsToLogout.length > 0
        ? deviceIdsToLogout
        : deviceIdToLogout
          ? [deviceIdToLogout]
          : [];

    console.log(`[Admin Approve] Active devices: ${activeDevices.length}, Max: ${maxDevices}`);
    console.log(`[Admin Approve] Devices to logout:`, devicesToLogout);
    console.log(
      `[Admin Approve] Active device IDs:`,
      activeDevices.map((d) => ({ deviceId: d.deviceId, _id: d._id, deviceName: d.deviceName }))
    );

    if (activeDevices.length >= maxDevices) {
      if (devicesToLogout.length === 0 && maxDevices === 1) {
        // Prefer Mongo _id so logout is unambiguous (deviceId strings can be shortened in clients)
        devicesToLogout = activeDevices.map((d) => String(d._id)).filter(Boolean);
        console.log(`[Admin Approve] Auto-selected devices to logout for 1-device plan:`, devicesToLogout);
      }

      if (devicesToLogout.length === 0) {
        return {
          status: 400,
          json: {
            success: false,
            message:
              "deviceIdToLogout or deviceIdsToLogout is required when user has reached device limit",
            availableDevices: activeDevices.map((d) => ({
              _id: d._id.toString(),
              deviceId: d.deviceId,
              deviceName: d.deviceName,
              platform: d.platform,
            })),
          },
        };
      }

      const logoutResults = [];
      for (const deviceIdentifier of devicesToLogout) {
        const deviceToLogout = await findActiveDeviceForLogout(
          user._id,
          deviceIdentifier
        );

        if (!deviceToLogout) {
          console.error(
            `[Admin Approve] Device not found - deviceIdentifier: ${deviceIdentifier}, userId: ${user._id}`
          );
          logoutResults.push({ deviceIdentifier, success: false, error: "Device not found" });
          continue;
        }

        console.log(`[Admin Approve] Logging out device: ${deviceToLogout.deviceId} (${deviceToLogout._id})`);

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

      const successfulLogouts = logoutResults.filter((r) => r.success);
      if (successfulLogouts.length === 0) {
        return {
          status: 400,
          json: {
            success: false,
            message: "Failed to logout any devices. Please check the device IDs and try again.",
            logoutResults: logoutResults,
            availableDevices: activeDevices.map((d) => ({
              _id: d._id.toString(),
              deviceId: d.deviceId,
              deviceName: d.deviceName,
              platform: d.platform,
            })),
          },
        };
      }

      if (!isPremium) {
        await User.findByIdAndUpdate(user._id, { token: null });
        console.log(
          `✅ Logged out ${successfulLogouts.length} device(s) and removed token for Basic user ${user._id}`
        );
      } else {
        console.log(
          `✅ Logged out ${successfulLogouts.length} device(s) for Premium user ${user._id} (devices marked inactive, authMiddleware will reject their requests)`
        );
      }

      const activeDevicesAfterLogout = await Device.find({
        userId: user._id,
        isActive: true,
      });
      console.log(`[Admin Approve] Active devices after logout: ${activeDevicesAfterLogout.length}`);
    }

    const finalActiveDevices = await Device.find({
      userId: user._id,
      isActive: true,
    });

    if (finalActiveDevices.length >= maxDevices) {
      console.error(
        `[Admin Approve] Still at device limit after logout! Active: ${finalActiveDevices.length}, Max: ${maxDevices}`
      );
      return {
        status: 400,
        json: {
          success: false,
          message:
            "Cannot create new device. User is still at device limit. Please ensure a device was properly logged out.",
          currentActiveDevices: finalActiveDevices.length,
          maxDevices: maxDevices,
        },
      };
    }

    let newDevice;
    const existingDevice = await Device.findOne({
      userId: user._id,
      deviceId: request.deviceInfo.deviceId,
    });

    if (existingDevice) {
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

    request.status = "approved";
    const rid = deviceRequestReviewerId(reviewer);
    if (rid) {
      request.reviewedBy = rid;
    }
    request.reviewedAt = new Date();
    await request.save();

    return {
      status: 200,
      json: {
        success: true,
        message: "Device request approved successfully",
        data: {
          request,
          newDevice,
        },
      },
    };
  } catch (error) {
    console.error("Approve device request error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error approving device request",
        error: error.message,
      },
    };
  }
}

async function rejectDeviceRequest(requestId, body, reviewer) {
  try {
    const { rejectionReason } = body;

    const request = await DeviceRequest.findById(requestId);

    if (!request) {
      return {
        status: 404,
        json: {
          success: false,
          message: "Device request not found",
        },
      };
    }

    if (request.status !== "pending") {
      return {
        status: 400,
        json: {
          success: false,
          message: `Request is already ${request.status}`,
        },
      };
    }

    request.status = "rejected";
    const rid = deviceRequestReviewerId(reviewer);
    if (rid) {
      request.reviewedBy = rid;
    }
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason || "No reason provided";
    await request.save();

    return {
      status: 200,
      json: {
        success: true,
        message: "Device request rejected",
        data: request,
      },
    };
  } catch (error) {
    console.error("Reject device request error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error rejecting device request",
        error: error.message,
      },
    };
  }
}

async function getUserDevices(userId) {
  try {
    const devices = await Device.find({ userId }).sort({ lastLoginAt: -1 });

    const user = await User.findById(userId).select(
      "name email username mobileNumber subscription expiry"
    );

    return {
      status: 200,
      json: {
        success: true,
        data: {
          user,
          devices,
          activeDevices: devices.filter((d) => d.isActive),
          inactiveDevices: devices.filter((d) => !d.isActive),
        },
      },
    };
  } catch (error) {
    console.error("Get user devices error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error fetching user devices",
        error: error.message,
      },
    };
  }
}

async function getDeviceDeactivationRequests(query) {
  try {
    const { status } = query;
    const q = {};
    if (status) {
      q.status = status;
    }

    const requests = await DeviceDeactivationRequest.find(q)
      .populate("userId", "name email username mobileNumber subscription expiry")
      .populate("device", "deviceName platform deviceType osVersion appVersion lastLoginAt")
      .populate("reviewedBy", "name email")
      .sort({ requestedAt: -1 });

    return {
      status: 200,
      json: {
        success: true,
        data: requests,
        count: requests.length,
      },
    };
  } catch (error) {
    console.error("Get device deactivation requests error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error fetching device deactivation requests",
        error: error.message,
      },
    };
  }
}

async function approveDeviceDeactivationRequest(requestId, reviewerId) {
  try {
    const request = await DeviceDeactivationRequest.findById(requestId)
      .populate("device")
      .populate("userId");

    if (!request) {
      return {
        status: 404,
        json: {
          success: false,
          message: "Deactivation request not found",
        },
      };
    }

    if (request.status !== "pending") {
      return {
        status: 400,
        json: {
          success: false,
          message: `Request is already ${request.status}`,
        },
      };
    }

    const device = await Device.findById(request.device._id);
    if (device) {
      device.isActive = false;
      device.lastLogoutAt = new Date();
      await device.save();
    }

    request.status = "approved";
    request.reviewedBy = reviewerId || null;
    request.reviewedAt = new Date();
    await request.save();

    return {
      status: 200,
      json: {
        success: true,
        message: "Device deactivation request approved and device deactivated successfully",
        data: request,
      },
    };
  } catch (error) {
    console.error("Approve device deactivation request error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error approving device deactivation request",
        error: error.message,
      },
    };
  }
}

async function rejectDeviceDeactivationRequest(requestId, body, reviewerId) {
  try {
    const { rejectionReason } = body;
    const request = await DeviceDeactivationRequest.findById(requestId);

    if (!request) {
      return {
        status: 404,
        json: {
          success: false,
          message: "Deactivation request not found",
        },
      };
    }

    if (request.status !== "pending") {
      return {
        status: 400,
        json: {
          success: false,
          message: `Request is already ${request.status}`,
        },
      };
    }

    request.status = "rejected";
    request.reviewedBy = reviewerId || null;
    request.reviewedAt = new Date();
    if (rejectionReason) {
      request.rejectionReason = rejectionReason;
    }
    await request.save();

    return {
      status: 200,
      json: {
        success: true,
        message: "Device deactivation request rejected",
        data: request,
      },
    };
  } catch (error) {
    console.error("Reject device deactivation request error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error rejecting device deactivation request",
        error: error.message,
      },
    };
  }
}

async function deactivateDeviceById(deviceId) {
  try {
    const device = await Device.findById(deviceId);

    if (!device) {
      return {
        status: 404,
        json: {
          success: false,
          message: "Device not found",
        },
      };
    }

    device.isActive = false;
    device.lastLogoutAt = new Date();
    await device.save();

    return {
      status: 200,
      json: {
        success: true,
        message: "Device deactivated successfully",
        data: device,
      },
    };
  } catch (error) {
    console.error("Deactivate device error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error deactivating device",
        error: error.message,
      },
    };
  }
}

async function loadSmsPoints(body) {
  try {
    const { userId, points } = body;

    if (!userId) {
      return {
        status: 400,
        json: {
          success: false,
          message: "User ID is required",
        },
      };
    }

    if (points === undefined || points === null || points < 0) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Valid points amount is required (must be >= 0)",
        },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return {
        status: 404,
        json: {
          success: false,
          message: "User not found",
        },
      };
    }

    user.smsPoints = (user.smsPoints || 0) + Number(points);
    await user.save();

    return {
      status: 200,
      json: {
        success: true,
        message: `Successfully loaded ${points} SMS points`,
        data: {
          userId: user._id,
          smsPoints: user.smsPoints,
          pointsAdded: Number(points),
        },
      },
    };
  } catch (error) {
    console.error("Error loading SMS points:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error loading SMS points",
        error: error.message,
      },
    };
  }
}

async function clearUserDevices(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        status: 404,
        json: {
          success: false,
          message: "User not found",
        },
      };
    }

    const deleteResult = await Device.deleteMany({ userId });

    await User.findByIdAndUpdate(userId, { token: null });

    return {
      status: 200,
      json: {
        success: true,
        message: `Successfully cleared ${deleteResult.deletedCount} device(s) and authentication token for user ${user.username}`,
        data: {
          userId: user._id,
          username: user.username,
          email: user.email,
          devicesDeleted: deleteResult.deletedCount,
          tokenCleared: true,
        },
      },
    };
  } catch (error) {
    console.error("Clear user devices error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error clearing user devices",
        error: error.message,
      },
    };
  }
}

module.exports = {
  updateNextUpdateDate,
  getDeviceRequests,
  getDeviceRequestById,
  getDeviceRequestActiveDevices,
  approveDeviceRequest,
  rejectDeviceRequest,
  getUserDevices,
  getDeviceDeactivationRequests,
  approveDeviceDeactivationRequest,
  rejectDeviceDeactivationRequest,
  deactivateDeviceById,
  loadSmsPoints,
  clearUserDevices,
};

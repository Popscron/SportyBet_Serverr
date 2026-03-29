const bcrypt = require("bcryptjs");
const User = require("../../../models/user");
const Device = require("../../../models/Device");
const DeviceRequest = require("../../../models/DeviceRequest");
const DeviceDeactivationRequest = require("../../../models/DeviceDeactivationRequest");
async function createDeviceRequestWithCredentials(
  { identifier, password, deviceInfo },
  clientIp
) {
  try {
    console.log(
      "[Create Device Request] Request body:",
      JSON.stringify({ identifier, password: "***", deviceInfo }, null, 2)
    );

    if (!identifier || !password) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Identifier and password are required",
        },
      };
    }

    if (!deviceInfo) {
      return {
        status: 400,
        json: { success: false, message: "Device info is required" },
      };
    }

    if (
      typeof deviceInfo !== "object" ||
      deviceInfo === null ||
      Array.isArray(deviceInfo)
    ) {
      console.error(
        "[Create Device Request] Invalid deviceInfo type:",
        typeof deviceInfo,
        deviceInfo
      );
      return {
        status: 400,
        json: { success: false, message: "Device info must be an object" },
      };
    }

    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { mobileNumber: identifier },
      ],
    });

    if (!user) {
      return {
        status: 404,
        json: { success: false, message: "User not found" },
      };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return {
        status: 401,
        json: { success: false, message: "Invalid credentials" },
      };
    }

    const deviceId = deviceInfo && deviceInfo.deviceId ? deviceInfo.deviceId : clientIp;

    const existingRequest = await DeviceRequest.findOne({
      userId: user._id,
      "deviceInfo.deviceId": deviceId,
      status: "pending",
    });

    if (existingRequest) {
      return {
        status: 400,
        json: {
          success: false,
          message: "A device request is already pending for this device",
          requestId: existingRequest._id,
        },
      };
    }

    const activeDevices = await Device.find({
      userId: user._id,
      isActive: true,
    });

    let deviceData;
    try {
      if (!deviceInfo || typeof deviceInfo !== "object") {
        throw new Error("deviceInfo is not a valid object");
      }
      deviceData = {
        deviceId: deviceInfo.deviceId || clientIp,
        deviceName: deviceInfo.deviceName || "Unknown Device",
        modelName:
          deviceInfo.modelName || deviceInfo.deviceName || "Unknown Model",
        modelId: deviceInfo.modelId || null,
        deviceType: deviceInfo.deviceType || "unknown",
        platform: deviceInfo.platform || "Unknown",
        osVersion: deviceInfo.osVersion || null,
        appVersion: deviceInfo.appVersion || null,
        ipAddress: clientIp,
        location: deviceInfo.location || null,
      };
    } catch (dataError) {
      console.error(
        "[Create Device Request] Error preparing device data:",
        dataError
      );
      return {
        status: 400,
        json: {
          success: false,
          message: "Error processing device information: " + dataError.message,
        },
      };
    }

    let deviceRequest;
    try {
      deviceRequest = await DeviceRequest.create({
        userId: user._id,
        deviceInfo: deviceData,
        status: "pending",
        currentActiveDevices: activeDevices.map((d) => d._id),
        subscriptionType: user.subscription || "Games",
      });
    } catch (createError) {
      console.error(
        "[Create Device Request] Error creating device request:",
        createError
      );
      return {
        status: 500,
        json: {
          success: false,
          message: "Error creating device request",
          error: createError.message,
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Thank you, request is pending",
        requestId: deviceRequest._id,
      },
    };
  } catch (error) {
    console.error("Error creating device request:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error creating device request",
        error: error.message,
      },
    };
  }
}

async function listDeviceRequests(userId, query) {
  try {
    const { status } = query;
    const filter = { userId };
    if (status) filter.status = status;

    const requests = await DeviceRequest.find(filter)
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
    console.error("Error fetching device requests:", error);
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

async function getDeviceRequest(userId, requestId) {
  try {
    const request = await DeviceRequest.findOne({
      _id: requestId,
      userId,
    })
      .populate("reviewedBy", "name email")
      .populate(
        "currentActiveDevices",
        "deviceName platform lastLoginAt"
      );

    if (!request) {
      return {
        status: 404,
        json: { success: false, message: "Device request not found" },
      };
    }

    return { status: 200, json: { success: true, data: request } };
  } catch (error) {
    console.error("Error fetching device request:", error);
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

async function createDeactivationRequest(userId, deviceId) {
  try {
    const device = await Device.findOne({ userId, deviceId });
    if (!device) {
      return {
        status: 404,
        json: { success: false, message: "Device not found" },
      };
    }
    if (!device.isActive) {
      return {
        status: 400,
        json: { success: false, message: "Device is already deactivated" },
      };
    }

    const existingRequest = await DeviceDeactivationRequest.findOne({
      userId,
      deviceId,
      status: "pending",
    });

    if (existingRequest) {
      return {
        status: 400,
        json: {
          success: false,
          message: "A deactivation request is already pending for this device",
        },
      };
    }

    const deactivationRequest = await DeviceDeactivationRequest.create({
      userId,
      deviceId,
      device: device._id,
      status: "pending",
    });

    return {
      status: 200,
      json: {
        success: true,
        message:
          "Deactivation request submitted successfully. Waiting for admin approval.",
        data: deactivationRequest,
      },
    };
  } catch (error) {
    console.error("Error creating deactivation request:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
    };
  }
}

async function deactivateDevice(userId, deviceId) {
  try {
    const device = await Device.findOne({ userId, deviceId });
    if (!device) {
      return { status: 404, json: { error: "Device not found" } };
    }
    await Device.findByIdAndUpdate(device._id, { isActive: false });
    return {
      status: 200,
      json: { success: true, message: "Device deactivated successfully" },
    };
  } catch (error) {
    console.error("Error deactivating device:", error);
    return { status: 500, json: { error: "Internal server error" } };
  }
}

module.exports = {
  createDeviceRequestWithCredentials,
  listDeviceRequests,
  getDeviceRequest,
  createDeactivationRequest,
  deactivateDevice,
};

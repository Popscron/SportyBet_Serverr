const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../../models/user");
const UserDeactivation = require("../../../models/UserDeactivation");
const Device = require("../../../models/Device");
const DeviceRequest = require("../../../models/DeviceRequest");
const { getSubscriptionInfo } = require("./subscription.helper");
const { jwtSecret } = require("../../config/auth.config");

/**
 * POST /api/login — device limits, JWT, token persistence (Games vs Premium).
 * Initial user lookup uses .lean() for a lighter hot path (plain object + password hash).
 */
async function login(req, res) {
  const { identifier, password, deviceInfo } = req.body;

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Both fields are required" });
  }

  try {
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { mobileNumber: identifier },
      ],
    }).lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (user.accountStatus === "Hold") {
      return res.status(403).json({
        success: false,
        message:
          "Your account is pending admin approval. Please wait for approval before logging in.",
        requiresApproval: true,
        accountStatus: "Hold",
      });
    }

    const deactivationRecord = await UserDeactivation.findOne({
      userId: user._id,
    });
    if (deactivationRecord && deactivationRecord.isDeactivated) {
      return res.status(403).json({
        success: false,
        message:
          "Account is deactivated. Please reactivate your account to continue.",
        isDeactivated: true,
        remainingDays: deactivationRecord.remainingSubscriptionDays,
      });
    }

    let isNewDevice = false;
    let activeDevicesCountBeforeNewDevice = 0;

    if (deviceInfo && typeof deviceInfo === "object" && deviceInfo !== null) {
      try {
        const deviceData = {
          userId: user._id,
          deviceId: deviceInfo?.deviceId || req.ip,
          deviceName: deviceInfo?.deviceName || "Unknown Device",
          modelName:
            deviceInfo?.modelName || deviceInfo?.deviceName || "Unknown Model",
          modelId: deviceInfo?.modelId || null,
          deviceType: deviceInfo?.deviceType || "unknown",
          platform: deviceInfo?.platform || "Unknown",
          osVersion: deviceInfo?.osVersion || null,
          appVersion: deviceInfo?.appVersion || null,
          ipAddress: req.ip,
          location: deviceInfo?.location || null,
          lastLoginAt: new Date(),
        };

        console.log(`[Login] Device data received:`, {
          deviceId: deviceData.deviceId,
          deviceName: deviceData.deviceName,
          modelName: deviceData.modelName,
          platform: deviceData.platform,
        });

        let existingDevice = await Device.findOne({
          userId: user._id,
          deviceId: deviceData.deviceId,
        });

        console.log(
          `[Login] Device lookup by deviceId (${deviceData.deviceId}):`,
          existingDevice ? "Found" : "Not found"
        );

        if (existingDevice) {
          const subInfo = getSubscriptionInfo(user);
          const isPremium = subInfo.isPremium;
          const maxDevices = subInfo.maxDevices;

          const activeDevicesBeforeUpdate = await Device.countDocuments({
            userId: user._id,
            isActive: true,
            _id: { $ne: existingDevice._id },
          });
          activeDevicesCountBeforeNewDevice = activeDevicesBeforeUpdate;

          if (!existingDevice.isActive && activeDevicesBeforeUpdate >= maxDevices) {
            console.log(
              `[Login] Cannot reactivate inactive device - limit reached. Active: ${activeDevicesBeforeUpdate}, Max: ${maxDevices}`
            );

            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const approvedRequest = await DeviceRequest.findOne({
              userId: user._id,
              "deviceInfo.deviceId": deviceData.deviceId,
              status: "approved",
              reviewedAt: { $gte: fiveMinutesAgo },
            });

            if (!approvedRequest) {
              const message = isPremium
                ? "This account is already active on two devices"
                : "This account is already active on another device";
              console.log(
                `[Login] Blocking reactivation - device was logged out, creating new request`
              );

              const existingPendingRequest = await DeviceRequest.findOne({
                userId: user._id,
                "deviceInfo.deviceId": deviceData.deviceId,
                status: "pending",
              });

              if (existingPendingRequest) {
                return res.status(403).json({
                  success: false,
                  code: "RESET_REQUEST_NEEDED",
                  message: `${message}. A request is already pending for this device. Please wait for admin approval.`,
                  subscriptionType: user.subscription || "Games",
                  maxDevices: maxDevices,
                  currentDevices: activeDevicesBeforeUpdate,
                  deviceInfo: deviceData,
                  requestId: existingPendingRequest._id,
                  requestCreated: true,
                });
              }

              try {
                const activeDevicesForRequest = await Device.find({
                  userId: user._id,
                  isActive: true,
                });
                const deviceRequest = await DeviceRequest.create({
                  userId: user._id,
                  deviceInfo: deviceData,
                  status: "pending",
                  currentActiveDevices: activeDevicesForRequest.map((d) => d._id),
                  subscriptionType: user.subscription || "Games",
                });

                return res.status(403).json({
                  success: false,
                  code: "RESET_REQUEST_NEEDED",
                  message: `${message}. This device was previously logged out. A new request has been sent to admin for approval.`,
                  subscriptionType: user.subscription || "Games",
                  maxDevices: maxDevices,
                  currentDevices: activeDevicesBeforeUpdate,
                  deviceInfo: deviceData,
                  requestId: deviceRequest._id,
                  requestCreated: true,
                });
              } catch (requestError) {
                console.error(
                  `[Login] Error creating device request:`,
                  requestError
                );
                return res.status(403).json({
                  success: false,
                  code: "RESET_REQUEST_NEEDED",
                  message: `${message}. Failed to create device request. Please try again.`,
                  subscriptionType: user.subscription || "Games",
                  maxDevices: maxDevices,
                  currentDevices: activeDevicesBeforeUpdate,
                  deviceInfo: deviceData,
                  requestCreated: false,
                });
              }
            }
            console.log(
              `[Login] Recent approved request found - allowing device reactivation`
            );
          }

          const updateData = {
            lastLoginAt: new Date(),
            loginCount: existingDevice.loginCount + 1,
            isActive: true,
            deviceName: deviceData.deviceName,
            modelName:
              deviceData.modelName || deviceData.deviceName || "Unknown Model",
            modelId: deviceData.modelId || existingDevice.modelId || null,
            deviceType: deviceData.deviceType,
            platform: deviceData.platform,
            osVersion: deviceData.osVersion,
            appVersion: deviceData.appVersion,
            ipAddress: deviceData.ipAddress,
            location: deviceData.location,
          };

          console.log(
            `[Login] Updating device ${existingDevice._id} with modelName: ${updateData.modelName}`
          );
          const updatedDevice = await Device.findByIdAndUpdate(
            existingDevice._id,
            updateData,
            { new: true }
          );
          console.log(
            `[Login] Device updated successfully. New modelName: ${updatedDevice?.modelName}`
          );
          isNewDevice = false;
        } else {
          const subInfo = getSubscriptionInfo(user);
          const isPremium = subInfo.isPremium;
          const maxDevices = subInfo.maxDevices;

          const activeDevices = await Device.find({
            userId: user._id,
            isActive: true,
          });

          console.log(
            `[Login] Device limit check - Active devices: ${activeDevices.length}, Max: ${maxDevices}, isPremium: ${isPremium}`
          );

          if (activeDevices.length >= maxDevices) {
            console.log(
              `[Login] Device limit reached! Blocking new device creation. Active: ${activeDevices.length}, Max: ${maxDevices}`
            );

            const existingRequest = await DeviceRequest.findOne({
              userId: user._id,
              "deviceInfo.deviceId": deviceData.deviceId,
              status: "pending",
            });

            if (existingRequest) {
              console.log(
                `[Login] Pending request found for device ${deviceData.deviceId}`
              );
              return res.status(403).json({
                success: false,
                message:
                  "A device change request is already pending for this device. Please wait for admin approval.",
                hasPendingRequest: true,
                requestId: existingRequest._id,
                requiresApproval: true,
              });
            }

            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const recentApprovedRequest = await DeviceRequest.findOne({
              userId: user._id,
              "deviceInfo.deviceId": deviceData.deviceId,
              status: "approved",
              reviewedAt: { $gte: fiveMinutesAgo },
            });

            const existingDeviceForApproval = await Device.findOne({
              userId: user._id,
              deviceId: deviceData.deviceId,
            });

            if (
              recentApprovedRequest &&
              (!existingDeviceForApproval || existingDeviceForApproval.isActive)
            ) {
              console.log(
                `[Login] Recent approved request found for device ${deviceData.deviceId}`
              );
              if (!existingDeviceForApproval) {
                await Device.create({
                  ...deviceData,
                  isActive: true,
                  loginCount: 1,
                });
                console.log(
                  `[Login] Approved device created - Active devices: ${activeDevices.length + 1}, Max: ${maxDevices}`
                );
                isNewDevice = true;
              } else {
                existingDeviceForApproval.lastLoginAt = new Date();
                existingDeviceForApproval.loginCount =
                  (existingDeviceForApproval.loginCount || 0) + 1;
                await existingDeviceForApproval.save();
                console.log(
                  `[Login] Approved device updated - Active devices: ${activeDevices.length}, Max: ${maxDevices}`
                );
              }
            } else {
              const message = isPremium
                ? "This account is already active on two devices"
                : "This account is already active on another device";

              console.log(
                `[Login] Device limit reached - Auto-creating device request for device ${deviceData.deviceId}`
              );

              try {
                const deviceRequest = await DeviceRequest.create({
                  userId: user._id,
                  deviceInfo: deviceData,
                  status: "pending",
                  currentActiveDevices: activeDevices.map((d) => d._id),
                  subscriptionType: user.subscription || "Games",
                });

                console.log(
                  `[Login] Device request created successfully: ${deviceRequest._id}`
                );

                return res.status(403).json({
                  success: false,
                  code: "RESET_REQUEST_NEEDED",
                  message: `${message}. A request has been automatically sent to admin for approval. Please wait for admin approval.`,
                  subscriptionType: user.subscription || "Games",
                  maxDevices: maxDevices,
                  currentDevices: activeDevices.length,
                  deviceInfo: deviceData,
                  requestId: deviceRequest._id,
                  requestCreated: true,
                });
              } catch (requestError) {
                console.error(
                  `[Login] Error creating device request:`,
                  requestError
                );
                return res.status(403).json({
                  success: false,
                  code: "RESET_REQUEST_NEEDED",
                  message: `${message}. Failed to create device request. Please try again.`,
                  subscriptionType: user.subscription || "Games",
                  maxDevices: maxDevices,
                  currentDevices: activeDevices.length,
                  deviceInfo: deviceData,
                  requestCreated: false,
                  error: requestError.message,
                });
              }
            }
          } else {
            activeDevicesCountBeforeNewDevice = activeDevices.length;
            await Device.create(deviceData);
            console.log(
              `[Login] New device created - Active devices: ${activeDevices.length + 1}, Max: ${maxDevices}`
            );
            isNewDevice = true;
          }
        }
      } catch (deviceError) {
        console.error("Device tracking error:", deviceError);
      }
    }

    const token = jwt.sign({ id: user._id, email: user.email }, jwtSecret, {
      expiresIn: "7d",
    });

    const subInfo = getSubscriptionInfo(user);
    const isPremium = subInfo.isPremium;

    if (isPremium) {
      const activeDevicesBeforeLogin = activeDevicesCountBeforeNewDevice;

      if (activeDevicesBeforeLogin === 0) {
        await User.findByIdAndUpdate(user._id, { token });
        console.log(`[Login] Token updated for Premium user (first device)`);
      } else {
        console.log(
          `[Login] Token NOT updated for Premium user (already has ${activeDevicesBeforeLogin} active device(s))`
        );
      }
    } else {
      await User.findByIdAndUpdate(user._id, { token });
      console.log(`[Login] Token updated for Games user`);
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      isDefaultPassword: user.isDefaultPassword || false,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        mobileNumber: user.mobileNumber,
        role: user.role,
        isDefaultPassword: user.isDefaultPassword || false,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { login };

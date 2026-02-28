const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Otp = require("../models/otp");
const User = require("../models/user");
const UserDeactivation = require("../models/UserDeactivation");
const authMiddleware = require("../middleware/authMiddleware");
const PasswordChangeRequest = require("../models/PasswordChangeRequest");
const UserImage = require("../models/UserImage");
const Balance = require("../models/UserBalance");
const Device = require("../models/Device");
const DeviceRequest = require("../models/DeviceRequest");
const DeviceDeactivationRequest = require("../models/DeviceDeactivationRequest");
const UserProfileStats = require("../models/UserProfileStats");

const router = express.Router();
const SECRET_KEY = "your_secret_key"; // Change this to a secure secret

// Helper function to get subscription info
const getSubscriptionInfo = (user) => {
  const isActive = !user.expiry || new Date(user.expiry) > new Date();
  const subscription = user.subscription || "Basic";
  
  let isPremium = false;
  let maxDevices = 1; // Basic gets 1 device limit
  
  if (isActive) {
    if (subscription === "Premium") {
      isPremium = true;
      maxDevices = 999; // Premium only: unlimited devices (no limit enforced)
    } else if (subscription === "Premium Plus") {
      isPremium = true;
      maxDevices = 2; // Premium Plus: 2 devices
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

// Generate Random 6-Digit OTP
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * 1️⃣ Send OTP (Just shows OTP instead of sending SMS)
 */
router.post("/send-otp", async (req, res) => {
  const { mobileNumber } = req.body;
  if (!mobileNumber)
    return res.status(400).json({ error: "Mobile number is required" });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP expires in 5 minutes

  await Otp.findOneAndUpdate(
    { mobileNumber },
    { otp, expiresAt },
    { upsert: true, new: true }
  );

  res.json({ success: true, message: `OTP generated: ${otp}` }); // Show OTP in response
});

/**
 * 2️⃣ Verify OTP
 */
router.post("/verify-otp", async (req, res) => {
  const { mobileNumber, otp } = req.body;

  const otpRecord = await Otp.findOne({ mobileNumber });
  if (!otpRecord) return res.status(400).json({ error: "Invalid OTP" });

  if (otpRecord.otp !== otp)
    return res.status(400).json({ error: "Incorrect OTP" });
  if (new Date() > otpRecord.expiresAt)
    return res.status(400).json({ error: "OTP expired" });

  res.json({ success: true, message: "OTP verified successfully" });
});

router.post("/register", async (req, res) => {
  const {
    name,
    password,
    username,
    email,
    mobileNumber
  } = req.body;

  console.log("Register request:", req.body);

  // ✅ Validate only user-provided fields (admin fields removed)
  if (
    !name ||
    !password ||
    !username ||
    !email ||
    !mobileNumber
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required: name, username, email, mobile number, and password.",
    });
  }

  // ✅ Validate password length
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long.",
    });
  }

  try {
    // ✅ Check if username, email, or mobile already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }, { mobileNumber }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username, email, or mobile number already exists.",
      });
    }

    // ✅ Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // ✅ Calculate 1 month expiry date from now
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1); // Add 1 month

    // ✅ Create new user with default values and "Hold" status (pending approval)
    const newUser = new User({
      name,
      password: hashedPassword,
      username,
      email,
      mobileNumber,
      subscription: "Basic", // Default subscription
      accountStatus: "Hold", // Pending admin approval
      role: "user", // Default role
      expiry: expiry, // Set 1 month expiry by default
      expiryPeriod: "1 Month", // Set expiry period
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: "Registration successful! Your account is pending admin approval. You will be able to login once approved.",
      requiresApproval: true,
      user: {
        _id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        mobileNumber: newUser.mobileNumber,
        accountStatus: newUser.accountStatus,
      },
    });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { identifier, password, deviceInfo } = req.body; // identifier can be email, username, or mobile number

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Both fields are required" });
  }

  try {
    // ✅ Try finding user by email, username, or mobileNumber
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { mobileNumber: identifier },
      ],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // ✅ Check if account is pending approval (Hold status)
    if (user.accountStatus === "Hold") {
      return res
        .status(403)
        .json({ 
          success: false, 
          message: "Your account is pending admin approval. Please wait for approval before logging in.",
          requiresApproval: true,
          accountStatus: "Hold"
        });
    }

    // ✅ Check if account is deactivated
    const deactivationRecord = await UserDeactivation.findOne({ userId: user._id });
    if (deactivationRecord && deactivationRecord.isDeactivated) {
      return res
        .status(403)
        .json({ 
          success: false, 
          message: "Account is deactivated. Please reactivate your account to continue.",
          isDeactivated: true,
          remainingDays: deactivationRecord.remainingSubscriptionDays
        });
    }

    // ✅ Track device information if provided and check device limits BEFORE generating token
    let isNewDevice = false; // Track if this is a new device
    let activeDevicesCountBeforeNewDevice = 0; // Track active devices count before creating new device
    if (deviceInfo && typeof deviceInfo === 'object' && deviceInfo !== null) {
      try {
        const deviceData = {
          userId: user._id,
          deviceId: deviceInfo?.deviceId || req.ip,
          deviceName: deviceInfo?.deviceName || "Unknown Device",
          modelName: deviceInfo?.modelName || deviceInfo?.deviceName || "Unknown Model",
          modelId: deviceInfo?.modelId || null, // Store modelId for future reference
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
          platform: deviceData.platform
        });

        // Check if device already exists (STRICTLY by deviceId only to prevent device limit bypass)
        // We only match by deviceId to ensure each physical device is tracked separately
        // This prevents Device 2 from matching Device 1's device and bypassing the limit check
        let existingDevice = await Device.findOne({
          userId: user._id,
          deviceId: deviceData.deviceId,
        });
        
        console.log(`[Login] Device lookup by deviceId (${deviceData.deviceId}):`, existingDevice ? 'Found' : 'Not found');
        
        // NOTE: Removed platform+deviceName and platform-only lookups to prevent device limit bypass
        // Each device must have a unique deviceId. If deviceId changes, it's treated as a new device
        // and the device limit check will properly block it if the limit is reached.

        if (existingDevice) {
          // Check user subscription type and expiry
          const subInfo = getSubscriptionInfo(user);
          const isPremium = subInfo.isPremium;
          const maxDevices = subInfo.maxDevices;

          // Count active devices BEFORE updating this device (excluding the device being updated)
          const activeDevicesBeforeUpdate = await Device.countDocuments({
            userId: user._id,
            isActive: true,
            _id: { $ne: existingDevice._id } // Exclude the device being updated
          });
          activeDevicesCountBeforeNewDevice = activeDevicesBeforeUpdate;

          // If device is inactive and user has reached device limit, check if we can reactivate
          if (!existingDevice.isActive && activeDevicesBeforeUpdate >= maxDevices) {
            console.log(`[Login] Cannot reactivate inactive device - limit reached. Active: ${activeDevicesBeforeUpdate}, Max: ${maxDevices}`);
            
            // Check if there's a RECENT approved request for this device (within last 5 minutes)
            // This prevents old approvals from being reused
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const approvedRequest = await DeviceRequest.findOne({
              userId: user._id,
              "deviceInfo.deviceId": deviceData.deviceId,
              status: "approved",
              reviewedAt: { $gte: fiveMinutesAgo }, // Only allow recent approvals
            });

            if (!approvedRequest) {
              // No recent approved request - block reactivation and create new request
              const message = isPremium 
                ? "This account is already active on two devices"
                : "This account is already active on another device";
              console.log(`[Login] Blocking reactivation - device was logged out, creating new request`);
              
              // Check if there's already a pending request for this device
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
                  subscriptionType: user.subscription || "Basic",
                  maxDevices: maxDevices,
                  currentDevices: activeDevicesBeforeUpdate,
                  deviceInfo: deviceData,
                  requestId: existingPendingRequest._id,
                  requestCreated: true,
                });
              }

              // Create new device request automatically
              try {
                // Collect currently-active devices to help admin choose what to log out.
                // Note: `activeDevicesBeforeUpdate` is a count; we still need the actual documents here.
                const activeDevicesForRequest = await Device.find({
                  userId: user._id,
                  isActive: true,
                });
                const deviceRequest = await DeviceRequest.create({
                  userId: user._id,
                  deviceInfo: deviceData,
                  status: "pending",
                  currentActiveDevices: activeDevicesForRequest.map((d) => d._id),
                  subscriptionType: user.subscription || "Basic",
                });
                
                return res.status(403).json({
                  success: false,
                  code: "RESET_REQUEST_NEEDED",
                  message: `${message}. This device was previously logged out. A new request has been sent to admin for approval.`,
                  subscriptionType: user.subscription || "Basic",
                  maxDevices: maxDevices,
                  currentDevices: activeDevicesBeforeUpdate,
                  deviceInfo: deviceData,
                  requestId: deviceRequest._id,
                  requestCreated: true,
                });
              } catch (requestError) {
                console.error(`[Login] Error creating device request:`, requestError);
                return res.status(403).json({
                  success: false,
                  code: "RESET_REQUEST_NEEDED",
                  message: `${message}. Failed to create device request. Please try again.`,
                  subscriptionType: user.subscription || "Basic",
                  maxDevices: maxDevices,
                  currentDevices: activeDevicesBeforeUpdate,
                  deviceInfo: deviceData,
                  requestCreated: false,
                });
              }
            }
            // Recent approved request exists - allow reactivation
            console.log(`[Login] Recent approved request found - allowing device reactivation`);
          }
          
          // Update existing device - ensure modelName and modelId are included
          const updateData = {
            lastLoginAt: new Date(),
            loginCount: existingDevice.loginCount + 1,
            isActive: true,
            deviceName: deviceData.deviceName,
            modelName: deviceData.modelName || deviceData.deviceName || 'Unknown Model',
            modelId: deviceData.modelId || existingDevice.modelId || null,
            deviceType: deviceData.deviceType,
            platform: deviceData.platform,
            osVersion: deviceData.osVersion,
            appVersion: deviceData.appVersion,
            ipAddress: deviceData.ipAddress,
            location: deviceData.location,
          };
          
          console.log(`[Login] Updating device ${existingDevice._id} with modelName: ${updateData.modelName}`);
          const updatedDevice = await Device.findByIdAndUpdate(existingDevice._id, updateData, { new: true });
          console.log(`[Login] Device updated successfully. New modelName: ${updatedDevice?.modelName}`);
          // For existing devices, mark as not new device (token will be updated later if needed)
          isNewDevice = false;
        } else {
          // Check user subscription type and expiry
          const subInfo = getSubscriptionInfo(user);
          const isPremium = subInfo.isPremium;
          const maxDevices = subInfo.maxDevices;

          // Count active devices (excluding the current device being added)
          const activeDevices = await Device.find({
            userId: user._id,
            isActive: true,
          });

          console.log(`[Login] Device limit check - Active devices: ${activeDevices.length}, Max: ${maxDevices}, isPremium: ${isPremium}`);

          // ============================================================================
          // 🔒 DEVICE LIMIT FEATURE - COMMENTED OUT (RESTORED OLD BEHAVIOR)
          // ============================================================================
          // 
          // NEW BEHAVIOR (Currently Disabled):
          // - Basic users: Limited to 1 active device
          // - Premium users: Limited to 2 active devices
          // - When limit is reached, returns RESET_REQUEST_NEEDED code
          // - User sees modal to request device reset from admin
          // - Device 1 stays logged in, Device 2 is blocked
          //
          // OLD BEHAVIOR (Currently Active):
          // - Basic users: Can log in on multiple devices
          // - Premium users: Can log in on 2 devices
          // - When Basic user logs in on Device 2, token is updated in database
          // - Device 1's token becomes invalid (authMiddleware checks token match)
          // - Device 1 gets logged out automatically, only Device 2 stays active
          // - This is enforced by: authMiddleware.js line 24 (token check for Basic users)
          // - And: authRoutes.js line 384-386 (always updates token for Basic users)
          //
          // TO RE-ENABLE NEW BEHAVIOR:
          // 1. Uncomment the code block below (lines starting with "if (activeDevices.length >= maxDevices)")
          // 2. Comment out or remove the "Create new device" block at the bottom
          // 3. Make sure frontend handles RESET_REQUEST_NEEDED code properly
          //
          // ============================================================================

          // Check if user has reached the device limit
          if (activeDevices.length >= maxDevices) {
            console.log(`[Login] Device limit reached! Blocking new device creation. Active: ${activeDevices.length}, Max: ${maxDevices}`);
            
            // Check if there's already a pending request for this device
            const existingRequest = await DeviceRequest.findOne({
              userId: user._id,
              "deviceInfo.deviceId": deviceData.deviceId,
              status: "pending",
            });

            if (existingRequest) {
              console.log(`[Login] Pending request found for device ${deviceData.deviceId}`);
              return res.status(403).json({
                success: false,
                message: "A device change request is already pending for this device. Please wait for admin approval.",
                hasPendingRequest: true,
                requestId: existingRequest._id,
                requiresApproval: true,
              });
            }

            // Check if there's an approved request for this device
            const approvedRequest = await DeviceRequest.findOne({
              userId: user._id,
              "deviceInfo.deviceId": deviceData.deviceId,
              status: "approved",
            });

            // Check if there's a RECENT approved request for this device (within last 5 minutes)
            // AND the device doesn't exist yet (first time login after approval)
            // This prevents old approvals from being reused after devices are logged out
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const recentApprovedRequest = await DeviceRequest.findOne({
              userId: user._id,
              "deviceInfo.deviceId": deviceData.deviceId,
              status: "approved",
              reviewedAt: { $gte: fiveMinutesAgo }, // Only allow recent approvals
            });

            // Check if device already exists
            const existingDeviceForApproval = await Device.findOne({
              userId: user._id,
              deviceId: deviceData.deviceId,
            });

            // Only allow using recent approval if:
            // 1. There's a recent approved request
            // 2. Device doesn't exist yet (first time login after approval)
            // OR device exists but is currently active (wasn't logged out)
            if (recentApprovedRequest && (!existingDeviceForApproval || existingDeviceForApproval.isActive)) {
              console.log(`[Login] Recent approved request found for device ${deviceData.deviceId}`);
              // Device was recently approved and either doesn't exist or is still active
              if (!existingDeviceForApproval) {
                // Create the device since it was approved
                await Device.create({
                  ...deviceData,
                  isActive: true,
                  loginCount: 1,
                });
                console.log(`[Login] Approved device created - Active devices: ${activeDevices.length + 1}, Max: ${maxDevices}`);
                isNewDevice = true; // Mark as new device
              } else {
                // Device exists and is active - just update it
                existingDeviceForApproval.lastLoginAt = new Date();
                existingDeviceForApproval.loginCount = (existingDeviceForApproval.loginCount || 0) + 1;
                await existingDeviceForApproval.save();
                console.log(`[Login] Approved device updated - Active devices: ${activeDevices.length}, Max: ${maxDevices}`);
                // Don't mark as new device - it already existed
              }
              // Continue with login (device will be created/updated above)
            } else {
              // Automatically create a device request when user logs in on 3rd device
              // Premium: 2 devices, Basic: 1 device
              const message = isPremium 
                ? "This account is already active on two devices"
                : "This account is already active on another device";
              
              console.log(`[Login] Device limit reached - Auto-creating device request for device ${deviceData.deviceId}`);
              
              try {
                // Create device request automatically
                const deviceRequest = await DeviceRequest.create({
                  userId: user._id,
                  deviceInfo: deviceData,
                  status: "pending",
                  currentActiveDevices: activeDevices.map(d => d._id),
                  subscriptionType: user.subscription || "Basic",
                });
                
                console.log(`[Login] Device request created successfully: ${deviceRequest._id}`);
                
                return res.status(403).json({
                  success: false,
                  code: "RESET_REQUEST_NEEDED",
                  message: `${message}. A request has been automatically sent to admin for approval. Please wait for admin approval.`,
                  subscriptionType: user.subscription || "Basic",
                  maxDevices: maxDevices,
                  currentDevices: activeDevices.length,
                  deviceInfo: deviceData,
                  requestId: deviceRequest._id,
                  requestCreated: true,
                });
              } catch (requestError) {
                console.error(`[Login] Error creating device request:`, requestError);
                // If request creation fails, return error but still inform user
                return res.status(403).json({
                  success: false,
                  code: "RESET_REQUEST_NEEDED",
                  message: `${message}. Failed to create device request. Please try again.`,
                  subscriptionType: user.subscription || "Basic",
                  maxDevices: maxDevices,
                  currentDevices: activeDevices.length,
                  deviceInfo: deviceData,
                  requestCreated: false,
                  error: requestError.message,
                });
              }
            }
          } else {
            // User hasn't reached device limit, create new device normally
            // Store activeDevices.length BEFORE creating new device for token update logic
            activeDevicesCountBeforeNewDevice = activeDevices.length;
            await Device.create(deviceData);
            console.log(`[Login] New device created - Active devices: ${activeDevices.length + 1}, Max: ${maxDevices}`);
            isNewDevice = true; // Mark as new device
          }
        }
      } catch (deviceError) {
        console.error("Device tracking error:", deviceError);
        // Don't fail login if device tracking fails
      }
    }

    // ✅ Generate JWT only after device check passes
    const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, {
      expiresIn: "7d",
    });

    // ✅ Save token in DB
    // Token update logic:
    // - Basic users: Always update token (only 1 device allowed, so previous device should be logged out)
    // - Premium/Premium Plus users: Only update token if this is the FIRST device (no existing active devices)
    //   - If user already has 1+ active devices, don't update token
    //   - This allows multiple devices to stay logged in simultaneously
    //   - Each device gets its own unique token, but we don't overwrite the stored token
    //   - The stored token is mainly for Basic users (single device enforcement)
    const subInfo = getSubscriptionInfo(user);
    const isPremium = subInfo.isPremium;
    
    // For Premium users: Only update token if this is the first device
    if (isPremium) {
      // Check active devices count BEFORE this login (excluding the device we just created/updated)
      // We need to check if there were already active devices before this login
      const activeDevicesBeforeLogin = activeDevicesCountBeforeNewDevice;
      
      // Only update token if this is the first device (no active devices before this login)
      if (activeDevicesBeforeLogin === 0) {
        // First device - update token
        await User.findByIdAndUpdate(user._id, { token });
        console.log(`[Login] Token updated for Premium user (first device)`);
      } else {
        // User already has active devices - don't update token
        // This allows multiple devices to stay logged in simultaneously
        console.log(`[Login] Token NOT updated for Premium user (already has ${activeDevicesBeforeLogin} active device(s))`);
      }
    } else {
      // Basic users: Always update token (enforces single device)
      await User.findByIdAndUpdate(user._id, { token });
      console.log(`[Login] Token updated for Basic user`);
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      isDefaultPassword: user.isDefaultPassword || false, // Include default password flag
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
});

router.get("/user/profile", authMiddleware, async (req, res) => {
  try {
    // Get user ID from request after authentication
    const userId = req.user.id;

    // Fetch user data from the database (excluding password)
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get profile stats (gifts count, badge count)
router.get("/user/profile-stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    let stats = await UserProfileStats.findOne({ user: userId });
    if (!stats) {
      stats = await UserProfileStats.create({
        user: userId,
        giftsCount: 0,
        badgeCount: 1,
      });
    }
    res.json({
      success: true,
      giftsCount: stats.giftsCount,
      badgeCount: stats.badgeCount,
    });
  } catch (error) {
    console.error("Error fetching profile stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update profile stats (gifts count, badge count)
router.put("/user/profile-stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { giftsCount, badgeCount } = req.body;
    let stats = await UserProfileStats.findOne({ user: userId });
    if (!stats) {
      stats = await UserProfileStats.create({
        user: userId,
        giftsCount: 0,
        badgeCount: 1,
      });
    }
    if (typeof giftsCount === "number" && giftsCount >= 0) stats.giftsCount = giftsCount;
    if (typeof badgeCount === "number" && badgeCount >= 0) stats.badgeCount = badgeCount;
    await stats.save();
    res.json({
      success: true,
      giftsCount: stats.giftsCount,
      badgeCount: stats.badgeCount,
    });
  } catch (error) {
    console.error("Error updating profile stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user devices
router.get("/user/devices", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    const subInfo = getSubscriptionInfo(user);
    const isPremium = subInfo.isPremium;
    const maxDevices = subInfo.maxDevices;

    const devices = await Device.find({ userId })
      .sort({ lastLoginAt: -1 })
      .select("-userId -__v");

    const activeDevices = devices.filter(d => d.isActive);
    const inactiveDevices = devices.filter(d => !d.isActive);

    res.json({ 
      success: true, 
      devices: activeDevices,
      allDevices: devices,
      activeDevices: activeDevices,
      inactiveDevices: inactiveDevices,
      subscriptionType: user.subscription || "Basic",
      maxDevices: maxDevices,
      currentDeviceCount: activeDevices.length,
      canAddDevice: activeDevices.length < maxDevices
    });
  } catch (error) {
    console.error("Error fetching user devices:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create device request after user confirmation
router.post("/user/create-device-request", async (req, res) => {
  try {
    console.log("[Create Device Request] Request body:", JSON.stringify(req.body, null, 2));
    
    const { identifier, password, deviceInfo } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Identifier and password are required",
      });
    }

    if (!deviceInfo) {
      return res.status(400).json({
        success: false,
        message: "Device info is required",
      });
    }

    // Verify deviceInfo is an object
    if (typeof deviceInfo !== 'object' || deviceInfo === null || Array.isArray(deviceInfo)) {
      console.error("[Create Device Request] Invalid deviceInfo type:", typeof deviceInfo, deviceInfo);
      return res.status(400).json({
        success: false,
        message: "Device info must be an object",
      });
    }

    // Verify user credentials first
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { mobileNumber: identifier },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Extract deviceId safely (deviceInfo is already validated as an object above)
    const deviceId = (deviceInfo && deviceInfo.deviceId) ? deviceInfo.deviceId : req.ip;

    // Check if request already exists
    const existingRequest = await DeviceRequest.findOne({
      userId: user._id,
      "deviceInfo.deviceId": deviceId,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "A device request is already pending for this device",
        requestId: existingRequest._id,
      });
    }

    // Get active devices
    const activeDevices = await Device.find({
      userId: user._id,
      isActive: true,
    });

    const subInfo = getSubscriptionInfo(user);
    const isPremium = subInfo.isPremium;
    const maxDevices = subInfo.maxDevices;

    // Prepare device data with safe property access
    let deviceData;
    try {
      // Ensure deviceInfo exists and is an object before accessing properties
      if (!deviceInfo || typeof deviceInfo !== 'object') {
        throw new Error('deviceInfo is not a valid object');
      }
      
      deviceData = {
        deviceId: deviceInfo.deviceId || req.ip,
        deviceName: deviceInfo.deviceName || "Unknown Device",
        modelName: deviceInfo.modelName || deviceInfo.deviceName || "Unknown Model",
        modelId: deviceInfo.modelId || null,
        deviceType: deviceInfo.deviceType || "unknown",
        platform: deviceInfo.platform || "Unknown",
        osVersion: deviceInfo.osVersion || null,
        appVersion: deviceInfo.appVersion || null,
        ipAddress: req.ip,
        location: deviceInfo.location || null,
      };
    } catch (dataError) {
      console.error("[Create Device Request] Error preparing device data:", dataError);
      return res.status(400).json({
        success: false,
        message: "Error processing device information: " + dataError.message,
      });
    }

    // Create the device request
    let deviceRequest;
    try {
      deviceRequest = await DeviceRequest.create({
        userId: user._id,
        deviceInfo: deviceData,
        status: "pending",
        currentActiveDevices: activeDevices.map(d => d._id),
        subscriptionType: user.subscription || "Basic",
      });
    } catch (createError) {
      console.error("[Create Device Request] Error creating device request:", createError);
      return res.status(500).json({
        success: false,
        message: "Error creating device request",
        error: createError.message,
      });
    }

    res.json({
      success: true,
      message: "Thank you, request is pending",
      requestId: deviceRequest._id,
    });
  } catch (error) {
    console.error("Error creating device request:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating device request",
      error: error.message,
    });
  }
});

// Get user's device requests
router.get("/user/device-requests", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const requests = await DeviceRequest.find(query)
      .populate("reviewedBy", "name email")
      .sort({ requestedAt: -1 });

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("Error fetching device requests:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching device requests",
      error: error.message,
    });
  }
});

// Get specific device request by ID
router.get("/user/device-requests/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const requestId = req.params.id;

    const request = await DeviceRequest.findOne({
      _id: requestId,
      userId: userId, // Ensure user can only view their own requests
    })
      .populate("reviewedBy", "name email")
      .populate("currentActiveDevices", "deviceName platform lastLoginAt");

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
    console.error("Error fetching device request:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching device request",
      error: error.message,
    });
  }
});

// Create device deactivation request
router.post("/user/devices/:deviceId/deactivation-request", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;

    // Find the device
    const device = await Device.findOne({ userId, deviceId });
    if (!device) {
      return res.status(404).json({ 
        success: false,
        message: "Device not found" 
      });
    }

    // Check if device is already inactive
    if (!device.isActive) {
      return res.status(400).json({ 
        success: false,
        message: "Device is already deactivated" 
      });
    }

    // Check if there's already a pending request for this device
    const existingRequest = await DeviceDeactivationRequest.findOne({
      userId,
      deviceId,
      status: "pending"
    });

    if (existingRequest) {
      return res.status(400).json({ 
        success: false,
        message: "A deactivation request is already pending for this device" 
      });
    }

    // Create the deactivation request
    const deactivationRequest = await DeviceDeactivationRequest.create({
      userId,
      deviceId,
      device: device._id,
      status: "pending"
    });

    res.json({ 
      success: true, 
      message: "Deactivation request submitted successfully. Waiting for admin approval.",
      data: deactivationRequest
    });
  } catch (error) {
    console.error("Error creating deactivation request:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: error.message 
    });
  }
});

// Deactivate a device (kept for admin use)
router.put("/user/devices/:deviceId/deactivate", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;

    const device = await Device.findOne({ userId, deviceId });
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    await Device.findByIdAndUpdate(device._id, { isActive: false });

    res.json({ success: true, message: "Device deactivated successfully" });
  } catch (error) {
    console.error("Error deactivating device:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/update-user-icon", async (req, res) => {
  const { userId, imageUrl } = req.body;

  if (!userId || !imageUrl) {
    return res
      .status(400)
      .json({ error: "User ID and image URL are required" });
  }

  try {
    // Find the user and update the userIcon field
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { userIcon: imageUrl },
      { new: true } // Return the updated user document
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      message: "User icon updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user icon:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/update-name", async (req, res) => {
  try {
    console.log("Received Request Body:", req.body); // Debugging

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "Request body is empty" });
    }

    const { userId, newName } = req.body;

    if (!userId || !newName.trim()) {
      return res
        .status(400)
        .json({ message: "User ID and new name are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = newName;
    await user.save();

    res
      .status(200)
      .json({ message: "Name updated successfully", updatedName: user.name });
  } catch (error) {
    console.error("Error updating name:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || email.trim() === "" || !password || password.trim() === "") {
      return res
        .status(400)
        .json({ message: "email and password are required." });
    }
    // Check admin credentials from environment variables
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (
      !adminEmails.includes(email.toLowerCase()) ||
      !adminPassword ||
      password !== adminPassword
    ) {
      return res.status(400).json({ message: "email or password is wrong." });
    }

    // Generate JWT token
    const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: "7d" });

    res.cookie("sportybetToken", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });

    res
      .status(200)
      .json({ success: true, message: "Login successful", user: { email }, token });
  } catch (error) {
    console.error("Error in admin login", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/auth/me", (req, res) => {
  try {
    const token = req.cookies.sportybetToken;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No token provided" });
    }
    const decoded = jwt.verify(token, SECRET_KEY);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }
    const user = { email: decoded.email };
    res.status(200).json({ success: true, user: user });
  } catch (error) {
    console.error("Error in getMe controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/auth/logout", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const deviceId = req.body.deviceId || req.headers['x-device-id'];
    
    // Get user to check subscription type
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Deactivate the device if deviceId is provided
    if (deviceId) {
      await Device.findOneAndUpdate(
        { userId, deviceId, isActive: true },
        { isActive: false, lastLogoutAt: new Date() }
      );
    }

    // Check user subscription type
    const subInfo = getSubscriptionInfo(user);
    const isPremium = subInfo.isPremium;

    // Only clear token for Basic users (single device enforcement)
    // For Premium users, keep token so other devices can stay logged in
    if (!isPremium) {
      // Basic users: Clear token to enforce single device
      await User.findByIdAndUpdate(userId, { token: null });
      console.log(`[Logout] Token cleared for Basic user ${userId}`);
    } else {
      // Premium users: Check if there are still active devices
      const activeDevices = await Device.find({
        userId,
        isActive: true,
      });
      
      // Only clear token if no active devices remain
      if (activeDevices.length === 0) {
        await User.findByIdAndUpdate(userId, { token: null });
        console.log(`[Logout] Token cleared for Premium user ${userId} (no active devices)`);
      } else {
        console.log(`[Logout] Token kept for Premium user ${userId} (${activeDevices.length} active device(s) remaining)`);
      }
    }

    res.clearCookie("sportybetToken", {
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });
    
    res.status(200).json({ success: true, message: "Logout Successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(200).json({ success: true, message: "Logout Successfully" }); // Still return success even if device deactivation fails
  }
});

router.get("/admin/getAllUsers", async (req, res) => {
  try {
    const allUsers = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, allUsers });
  } catch (error) {
    console.error("Error fetching all users", error);
    res.status(500).json({ message: "Server error", errorr: error });
  }
});

router.delete("/admin/deleteUser/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    // await User.findOneAndDelete(id);
    await User.findByIdAndDelete(id);
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    console.log(error);
  }
});

router.get("/admin/getAllUsersByStatus", async (req, res) => {
  try {
    const allActiveUsers = await User.find({ accountStatus: "Active" }).sort({
      createdAt: -1,
    });
    const allDisableUsers = await User.find({ accountStatus: "Hold" }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, allActiveUsers, allDisableUsers });
  } catch (error) {
    console.error("Error fetching all users", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/admin/disableUserAccountStatus/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    await User.findByIdAndUpdate(id, { accountStatus: "Hold" });
    res
      .status(200)
      .json({ success: true, message: "User disabled successfully." });
  } catch (error) {
    console.error("Error disabling user", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/admin/activeUserAccountStatus/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Find user with 'Hold' status
    const user = await User.findOne({ _id: id, accountStatus: "Hold" });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found or not on Hold" });
    }

    // Update user status & expiry date
    await User.findByIdAndUpdate(id, {
      accountStatus: "Active",
    });

    res
      .status(200)
      .json({ success: true, message: "User activated successfully." });
  } catch (error) {
    console.error("Error activating user", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/admin/getExpiredUsers", async (req, res) => {
  try {
    const currentDate = new Date();

    // Find users where expiry date is before today
    const expiredUsers = await User.find({ expiry: { $lt: currentDate } });

    res.status(200).json({
      success: true,
      expiredUsers,
    });
  } catch (error) {
    console.error("Error fetching expired users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/admin/activeUserAccount/:id", async (req, res) => {
  const { id } = req.params;
  const { expiryDate } = req.body;

  try {
    if (!expiryDate || expiryDate === "none") {
      return res
        .status(400)
        .json({ success: false, message: "Select a valid expiry period" });
    }

    // Ensure expiryDate is a valid number
    const expiryDays = Number(expiryDate);
    if (isNaN(expiryDays) || expiryDays <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid expiry date" });
    }

    // Find user with 'Hold' status
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Calculate expiry date correctly
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expiryDays);

    const expiryMap = {
      7: "1 Week",
      14: "2 Weeks",
      21: "3 Weeks",
      30: "1 Month",
      60: "2 Months",
      90: "3 Months"
    }

    const expiryValue = expiryMap[expiryDate];

    // Update user status & expiry date
    await User.findByIdAndUpdate(id, {
      expiry: expiry,
      expiryPeriod: expiryValue
    });

    res
      .status(200)
      .json({ success: true, message: "User activated successfully." });
  } catch (error) {
    console.error("Error activating user", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/update-status/:userId", async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  if (!["Active", "Hold"].includes(status)) {
    return res
      .status(400)
      .json({ error: "Invalid status. Must be 'Active' or 'Hold'." });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { accountStatus: status },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({
      message: `User status updated to '${status}'.`,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        mobileNumber: updatedUser.mobileNumber,
        accountStatus: updatedUser.accountStatus,
      },
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/update-profile", async (req, res) => {
  const { userId, name, amount, phone, email, userIcon, darkMode, potentialRewards, loyaltyProgress, autoCashoutNotification } = req.body;

  try {
    // Validate userId so we don't call findByIdAndUpdate(undefined) after app reopen before user is loaded
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required. Please wait for your profile to load and try again." });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID." });
    }

    // ✅ Update user basic info – only set defined fields so we don't overwrite with undefined
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.mobileNumber = phone;
    if (email !== undefined) updateData.email = email;
    if (userIcon !== undefined) updateData.userIcon = userIcon;

    if (darkMode !== undefined) updateData.darkMode = darkMode;
    if (potentialRewards !== undefined) updateData.potentialRewards = potentialRewards;
    if (loyaltyProgress !== undefined) updateData.loyaltyProgress = Math.max(0, Math.min(100, loyaltyProgress));
    if (autoCashoutNotification !== undefined) updateData.autoCashoutNotification = autoCashoutNotification;

    if (Object.keys(updateData).length > 0) {
      const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
      if (!updatedUser) {
        return res.status(404).json({ success: false, message: "User not found." });
      }
    }

    // ✅ Update balance only when amount is a valid number (avoids Mongoose issues with undefined)
    const parsedAmount = amount !== undefined && amount !== null && amount !== "" ? Number(amount) : NaN;
    if (Number.isFinite(parsedAmount) && parsedAmount >= 0) {
      await Balance.findOneAndUpdate(
        { userId },
        { $set: { amount: parsedAmount } },
        { upsert: true, new: true }
      );
    }

    return res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("Update error:", err);
    const message = err.message || "Update failed";
    return res.status(500).json({ success: false, message });
  }
});

// Update notification settings
router.put("/user/notification-settings", async (req, res) => {
  try {
    const { userId, notificationType, notificationPhoneNumber } = req.body;

    console.log("Update notification settings request:", { userId, notificationType, notificationPhoneNumber });

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid user ID format" 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updateData = {};
    
    // Update notification type if provided
    if (notificationType !== undefined) {
      if (!["inbuilt", "third-party"].includes(notificationType)) {
        return res.status(400).json({ success: false, message: "Invalid notification type. Must be 'inbuilt' or 'third-party'" });
      }
      
      // Validate notification type based on subscription
      const subscription = user.subscription || "Basic";
      // All users (Basic and Premium) can use both inbuilt and real SMS
      // No subscription-based restrictions on notification types
      
      updateData.notificationType = notificationType;
      console.log("Updating notificationType to:", notificationType);
    }

    // Update notification phone number if provided (but don't change verified status unless explicitly verified via OTP)
    if (notificationPhoneNumber !== undefined) {
      // Only update if it's different from current
      if (notificationPhoneNumber !== user.notificationPhoneNumber) {
        // If phone number changes, reset verified status (user needs to verify again)
        updateData.notificationPhoneNumber = notificationPhoneNumber;
        updateData.notificationPhoneVerified = false;
      }
    }

    // Allow explicitly setting notificationPhoneVerified status (for unverify functionality)
    if (req.body.notificationPhoneVerified !== undefined) {
      updateData.notificationPhoneVerified = req.body.notificationPhoneVerified === true;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    console.log("Update data:", updateData);
    
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
    
    if (!updatedUser) {
      return res.status(500).json({ success: false, message: "Failed to update user" });
    }

    console.log("User updated successfully. New notificationType:", updatedUser.notificationType);

    // Fetch fresh data to ensure we return the correct values
    const freshUser = await User.findById(userId).select("notificationPhoneNumber notificationPhoneVerified notificationType smsPoints");

    return res.json({
      success: true,
      message: "Notification settings updated successfully",
      data: {
        notificationPhoneNumber: freshUser.notificationPhoneNumber,
        notificationPhoneVerified: freshUser.notificationPhoneVerified,
        notificationType: freshUser.notificationType,
        smsPoints: freshUser.smsPoints
      }
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// Get SMS points
router.get("/user/sms-points", async (req, res) => {
  try {
    const { userId } = req.query;

    console.log("Get SMS points request:", { userId });

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("Invalid user ID format:", userId);
      return res.status(400).json({ 
        success: false, 
        message: "Invalid user ID format" 
      });
    }

    const user = await User.findById(userId).select("smsPoints notificationPhoneNumber notificationPhoneVerified notificationType");
    
    if (!user) {
      console.error("User not found:", userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("User found:", {
      id: user._id,
      smsPoints: user.smsPoints,
      notificationPhoneNumber: user.notificationPhoneNumber,
      notificationPhoneVerified: user.notificationPhoneVerified,
      notificationPhoneVerifiedType: typeof user.notificationPhoneVerified,
      notificationType: user.notificationType
    });

    // Ensure notificationType has a default value if null/undefined
    const notificationType = user.notificationType || "third-party";
    
    // Explicitly convert notificationPhoneVerified to boolean
    const notificationPhoneVerified = user.notificationPhoneVerified === true || user.notificationPhoneVerified === "true";
    
    console.log("Returning data:", {
      notificationPhoneVerified: notificationPhoneVerified,
      notificationPhoneNumber: user.notificationPhoneNumber || null,
      notificationType: notificationType
    });

    return res.json({
      success: true,
      data: {
        smsPoints: user.smsPoints || 0,
        notificationPhoneNumber: user.notificationPhoneNumber || null,
        notificationPhoneVerified: notificationPhoneVerified,
        notificationType: notificationType
      }
    });
  } catch (error) {
    console.error("Error fetching SMS points:", error);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    
    // Return more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'Internal server error';
    
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack,
        name: error.name 
      })
    });
  }
});

// Update user fields (subscription, username, expiry)
router.put("/admin/updateUserFields", async (req, res) => {
  try {
    const { userId, username, subscription, expiry } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (subscription !== undefined) updateData.subscription = subscription;
    if (expiry !== undefined) {
      updateData.expiry = expiry ? new Date(expiry) : null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: false });

    return res.json({ success: true, message: "User fields updated successfully" });
  } catch (error) {
    console.error("Error updating user fields:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// Update user's grand audit limit
router.put("/update-grand-audit-limit", async (req, res) => {
  try {
    console.log("Received request body:", req.body); // Debug log
    
    const { userId, grandAuditLimit } = req.body;

    // Validate userId
    if (!userId) {
      console.log("Validation failed: userId is missing");
      return res.status(400).json({ message: "userId is required" });
    }

    // Validate userId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("Validation failed: Invalid userId format:", userId);
      return res.status(400).json({ message: "Invalid userId format" });
    }

    // Validate grandAuditLimit - allow 0 as a valid value
    // Check for undefined or null (but allow 0)
    if (grandAuditLimit === undefined || grandAuditLimit === null) {
      console.log("Validation failed: grandAuditLimit is undefined or null");
      return res.status(400).json({ message: "grandAuditLimit is required and cannot be empty" });
    }

    // Handle both number and string inputs - convert to number directly
    let parsedLimit;
    
    // If it's already a number, use it directly
    if (typeof grandAuditLimit === 'number') {
      parsedLimit = grandAuditLimit;
    } else if (typeof grandAuditLimit === 'string') {
      // If it's a string, trim and parse
      const trimmed = grandAuditLimit.trim();
      if (trimmed === "" || trimmed === "null" || trimmed === "undefined" || trimmed === "NaN") {
        console.log("Validation failed: grandAuditLimit is empty or invalid string:", trimmed);
        return res.status(400).json({ message: "grandAuditLimit is required and cannot be empty" });
      }
      parsedLimit = Number(trimmed);
    } else {
      // For any other type, try to convert
      parsedLimit = Number(grandAuditLimit);
    }

    // Validate the parsed number
    if (Number.isNaN(parsedLimit) || !isFinite(parsedLimit)) {
      console.log("Validation failed: grandAuditLimit is not a valid number:", grandAuditLimit);
      return res.status(400).json({ message: "grandAuditLimit must be a valid number" });
    }

    // Allow 0 and positive numbers, reject negative
    if (parsedLimit < 0) {
      console.log("Validation failed: grandAuditLimit is negative:", parsedLimit);
      return res.status(400).json({ message: "grandAuditLimit must be a non-negative number" });
    }

    // Update only the grandAuditLimit field using findByIdAndUpdate
    // This avoids triggering validation on other fields like subscription
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { grandAuditLimit: parsedLimit } },
      { new: true, runValidators: false } // runValidators: false to avoid validating unchanged fields
    );

    if (!updatedUser) {
      console.log("Validation failed: User not found with userId:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Successfully updated grand audit limit for user:", userId, "to:", parsedLimit);
    return res.status(200).json({ message: "Grand audit limit updated", grandAuditLimit: updatedUser.grandAuditLimit });
  } catch (error) {
    console.error("Error updating grand audit limit:", error);
    // Handle validation errors specifically
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Validation error", error: error.message });
    }
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Deactivate user account and pause subscription
router.put("/deactivate-account", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if account is already deactivated
    const existingDeactivation = await UserDeactivation.findOne({ userId });
    if (existingDeactivation && existingDeactivation.isDeactivated) {
      return res.status(400).json({ success: false, message: "Account is already deactivated" });
    }

    // Calculate remaining subscription days
    const now = new Date();
    const remainingDays = user.expiry ? Math.max(0, Math.ceil((user.expiry - now) / (1000 * 60 * 60 * 24))) : 0;

    // Create or update deactivation record
    const deactivationData = {
      userId,
      isDeactivated: true,
      deactivatedAt: now,
      subscriptionPausedAt: now,
      remainingSubscriptionDays: remainingDays,
      originalExpiryDate: user.expiry,
      deactivationReason: "user_request"
    };

    if (existingDeactivation) {
      await UserDeactivation.findByIdAndUpdate(existingDeactivation._id, deactivationData);
    } else {
      await UserDeactivation.create(deactivationData);
    }

    // Update user account status
    await User.findByIdAndUpdate(userId, {
      accountStatus: "Deactivated"
    });

    res.json({ 
      success: true, 
      message: "Account deactivated successfully. Your subscription has been paused.",
      remainingDays 
    });
  } catch (error) {
    console.error("Error deactivating account:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Reactivate user account and resume subscription
router.put("/reactivate-account", async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email, username, or mobile number

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Both identifier and password are required" });
    }

    // Find user by identifier
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { mobileNumber: identifier },
      ],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Check deactivation record
    const deactivationRecord = await UserDeactivation.findOne({ userId: user._id });
    if (!deactivationRecord || !deactivationRecord.isDeactivated) {
      return res.status(400).json({ success: false, message: "Account is not deactivated" });
    }

    // Calculate new expiry date based on remaining days
    const now = new Date();
    const newExpiry = new Date(now.getTime() + (deactivationRecord.remainingSubscriptionDays * 24 * 60 * 60 * 1000));

    // Update deactivation record
    await UserDeactivation.findByIdAndUpdate(deactivationRecord._id, {
      isDeactivated: false,
      reactivatedAt: now,
      reactivationCount: deactivationRecord.reactivationCount + 1
    });

    // Reactivate account and resume subscription
    await User.findByIdAndUpdate(user._id, {
      accountStatus: "Active",
      expiry: newExpiry
    });

    // Generate new JWT token
    const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, {
      expiresIn: "7d",
    });

    // Save token in DB
    await User.findByIdAndUpdate(user._id, { token });

    res.json({
      success: true,
      message: "Account reactivated successfully. Your subscription has been resumed.",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        mobileNumber: user.mobileNumber,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error reactivating account:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get deactivation status for a user
router.get("/deactivation-status", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const deactivationRecord = await UserDeactivation.findOne({ userId });
    
    if (!deactivationRecord) {
      return res.json({ 
        success: true, 
        isDeactivated: false,
        message: "Account is active" 
      });
    }

    res.json({
      success: true,
      isDeactivated: deactivationRecord.isDeactivated,
      deactivatedAt: deactivationRecord.deactivatedAt,
      remainingDays: deactivationRecord.remainingSubscriptionDays,
      reactivationCount: deactivationRecord.reactivationCount
    });
  } catch (error) {
    console.error("Error fetching deactivation status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Create a password change request (user initiates)
router.post("/password-change/request", async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "userId, currentPassword and newPassword are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // If there is an existing pending request, reject creating another
    const existingPending = await PasswordChangeRequest.findOne({ userId, status: "pending" });
    if (existingPending) {
      return res.status(409).json({ message: "There is already a pending password change request" });
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    const requestDoc = await PasswordChangeRequest.create({
      userId,
      newPasswordHash,
      status: "pending",
    });

    return res.status(201).json({ success: true, message: "Password change request submitted and pending admin approval", requestId: requestDoc._id });
  } catch (error) {
    console.error("Error creating password change request:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Admin: list password change requests (optionally filter by status)
router.get("/admin/password-change/requests", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }
    const requests = await PasswordChangeRequest.find(filter).sort({ createdAt: -1 }).populate("userId", "name email username mobileNumber");
    return res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("Error listing password change requests:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Admin: approve a password change request and update user's password
router.put("/admin/password-change/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const requestDoc = await PasswordChangeRequest.findById(id);
    if (!requestDoc) {
      return res.status(404).json({ message: "Request not found" });
    }
    if (requestDoc.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be approved" });
    }

    // Update user password to the new hashed password
    await User.findByIdAndUpdate(requestDoc.userId, { password: requestDoc.newPasswordHash });

    requestDoc.status = "approved";
    await requestDoc.save();

    return res.status(200).json({ success: true, message: "Password updated and request approved" });
  } catch (error) {
    console.error("Error approving password change request:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Admin: reject a password change request
router.put("/admin/password-change/reject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const requestDoc = await PasswordChangeRequest.findById(id);
    if (!requestDoc) {
      return res.status(404).json({ message: "Request not found" });
    }
    if (requestDoc.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be rejected" });
    }

    requestDoc.status = "rejected";
    requestDoc.rejectedReason = reason || "";
    await requestDoc.save();

    return res.status(200).json({ success: true, message: "Password change request rejected" });
  } catch (error) {
    console.error("Error rejecting password change request:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Admin: Set user password (admin sets custom password for user)
router.put("/admin/set-user-password/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: "Password is required and must be at least 6 characters long" 
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password (user will use this password to login)
    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      isDefaultPassword: false // User will use this password, no prompt needed
    });

    return res.status(200).json({ 
      success: true, 
      message: `Password has been set successfully.`,
      passwordSet: true
    });
  } catch (error) {
    console.error("Error setting user password:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// User: Change password directly (for users with default password)
router.put("/user/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters long" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear default password flag
    await User.findByIdAndUpdate(userId, {
      password: hashedNewPassword,
      isDefaultPassword: false
    });

    return res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;

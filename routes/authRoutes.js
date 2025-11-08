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

const router = express.Router();
const SECRET_KEY = "your_secret_key"; // Change this to a secure secret

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
    expiryDate,
    subscription,
    role,
    mobileNumber,
    expiryPeriod
  } = req.body;

  console.log("Register request:", req.body);

  // ✅ Validate all fields
  if (
    !name ||
    !password ||
    !username ||
    !email ||
    !expiryDate ||
    !subscription ||
    !role ||
    !mobileNumber
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required including mobile number.",
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

    // ✅ Convert expiryDate to proper Date object
    const expiry = new Date(expiryDate);
    if (isNaN(expiry)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expiry date format.",
      });
    }

    const expiryMap = {
      14: "2 Weeks",
      30: "1 Month",
      60: "2 Months",
      90: "3 Months"
    }

    const expiryValue = expiryMap[expiryPeriod];

    // ✅ Create and save new user
    const newUser = new User({
      name,
      password: hashedPassword,
      username,
      email,
      mobileNumber,
      subscription,
      expiry,
      expiryPeriod: expiryValue,
      role,
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        mobileNumber: newUser.mobileNumber,
        role: newUser.role,
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

    // ✅ Generate JWT
    const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, {
      expiresIn: "7d",
    });

    // ✅ Save token in DB
    await User.findByIdAndUpdate(user._id, { token });

    // ✅ Track device information if provided
    if (deviceInfo) {
      try {
        const deviceData = {
          userId: user._id,
          deviceId: deviceInfo.deviceId || req.ip,
          deviceName: deviceInfo.deviceName || "Unknown Device",
          deviceType: deviceInfo.deviceType || "unknown",
          platform: deviceInfo.platform || "Unknown",
          osVersion: deviceInfo.osVersion,
          appVersion: deviceInfo.appVersion,
          ipAddress: req.ip,
          location: deviceInfo.location,
          lastLoginAt: new Date(),
        };

        // Check if device already exists
        const existingDevice = await Device.findOne({
          userId: user._id,
          deviceId: deviceData.deviceId,
        });

        if (existingDevice) {
          // Update existing device
          await Device.findByIdAndUpdate(existingDevice._id, {
            lastLoginAt: new Date(),
            loginCount: existingDevice.loginCount + 1,
            isActive: true,
            ...deviceData,
          });
        } else {
          // Create new device
          await Device.create(deviceData);
        }
      } catch (deviceError) {
        console.error("Device tracking error:", deviceError);
        // Don't fail login if device tracking fails
      }
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
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

// Get user devices
router.get("/user/devices", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const devices = await Device.find({ userId, isActive: true })
      .sort({ lastLoginAt: -1 })
      .select("-userId -__v");

    res.json({ success: true, devices });
  } catch (error) {
    console.error("Error fetching user devices:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deactivate a device
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
    if (
      !(
        (email === "Capsiteafrica@gmail.com" ||
          email === "Moderator@gmail.com") &&
        password === "Fiifi9088."
      )
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
      .json({ success: true, message: "Login successful", user: { email } });
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

router.post("/auth/logout", (req, res) => {
  res.clearCookie("sportybetToken", {
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });
  res.status(200).json({ success: true, message: "Logout Successfully" });
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
  const { userId, name, amount, phone, email, userIcon, darkMode } = req.body;

  try {
    // ✅ Update user basic info
    const updateData = {
      name,
      mobileNumber: phone,
      email,
      userIcon, // ✅ store avatar here
    };
    
    // Add darkMode if provided
    if (darkMode !== undefined) {
      updateData.darkMode = darkMode;
    }
    
    await User.findByIdAndUpdate(userId, updateData);

    // ✅ Update or create balance
    await Balance.findOneAndUpdate(
      { userId },
      { amount },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("Update error:", err);
    return res.status(500).json({ success: false, message: "Update failed" });
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

module.exports = router;

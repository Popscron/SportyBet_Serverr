const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../../models/user");
const UserDeactivation = require("../../../models/UserDeactivation");
const { jwtSecret } = require("../../config/auth.config");

async function deactivateAccount(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    const existingDeactivation = await UserDeactivation.findOne({ userId });
    if (existingDeactivation && existingDeactivation.isDeactivated) {
      return {
        status: 400,
        json: { success: false, message: "Account is already deactivated" },
      };
    }

    const now = new Date();
    const remainingDays = user.expiry
      ? Math.max(
          0,
          Math.ceil((user.expiry - now) / (1000 * 60 * 60 * 24))
        )
      : 0;

    const deactivationData = {
      userId,
      isDeactivated: true,
      deactivatedAt: now,
      subscriptionPausedAt: now,
      remainingSubscriptionDays: remainingDays,
      originalExpiryDate: user.expiry,
      deactivationReason: "user_request",
    };

    if (existingDeactivation) {
      await UserDeactivation.findByIdAndUpdate(
        existingDeactivation._id,
        deactivationData
      );
    } else {
      await UserDeactivation.create(deactivationData);
    }

    await User.findByIdAndUpdate(userId, { accountStatus: "Deactivated" });

    return {
      status: 200,
      json: {
        success: true,
        message:
          "Account deactivated successfully. Your subscription has been paused.",
        remainingDays,
      },
    };
  } catch (error) {
    console.error("Error deactivating account:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function reactivateAccount({ identifier, password }) {
  try {
    if (!identifier || !password) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Both identifier and password are required",
        },
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
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return {
        status: 401,
        json: { success: false, message: "Invalid credentials" },
      };
    }

    const deactivationRecord = await UserDeactivation.findOne({
      userId: user._id,
    });
    if (!deactivationRecord || !deactivationRecord.isDeactivated) {
      return {
        status: 400,
        json: { success: false, message: "Account is not deactivated" },
      };
    }

    const now = new Date();
    const newExpiry = new Date(
      now.getTime() +
        deactivationRecord.remainingSubscriptionDays * 24 * 60 * 60 * 1000
    );

    await UserDeactivation.findByIdAndUpdate(deactivationRecord._id, {
      isDeactivated: false,
      reactivatedAt: now,
      reactivationCount: deactivationRecord.reactivationCount + 1,
    });

    await User.findByIdAndUpdate(user._id, {
      accountStatus: "Active",
      expiry: newExpiry,
    });

    const token = jwt.sign({ id: user._id, email: user.email }, jwtSecret, {
      expiresIn: "7d",
    });

    await User.findByIdAndUpdate(user._id, { token });

    return {
      status: 200,
      json: {
        success: true,
        message:
          "Account reactivated successfully. Your subscription has been resumed.",
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          username: user.username,
          mobileNumber: user.mobileNumber,
          role: user.role,
        },
      },
    };
  } catch (error) {
    console.error("Error reactivating account:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function getDeactivationStatus(userId) {
  try {
    const deactivationRecord = await UserDeactivation.findOne({ userId });

    if (!deactivationRecord) {
      return {
        status: 200,
        json: {
          success: true,
          isDeactivated: false,
          message: "Account is active",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        isDeactivated: deactivationRecord.isDeactivated,
        deactivatedAt: deactivationRecord.deactivatedAt,
        remainingDays: deactivationRecord.remainingSubscriptionDays,
        reactivationCount: deactivationRecord.reactivationCount,
      },
    };
  } catch (error) {
    console.error("Error fetching deactivation status:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

module.exports = {
  deactivateAccount,
  reactivateAccount,
  getDeactivationStatus,
};

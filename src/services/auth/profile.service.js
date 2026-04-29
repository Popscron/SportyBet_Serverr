const mongoose = require("mongoose");
const User = require("../../../models/user");
const Balance = require("../../../models/UserBalance");
const UserProfileStats = require("../../../models/UserProfileStats");
const { getSubscriptionInfo } = require("./subscription.helper");
const Device = require("../../../models/Device");

async function getProfile(userId) {
  try {
    const user = await User.findById(userId).select("-password").lean();
    if (!user) return { status: 404, json: { error: "User not found" } };
    return { status: 200, json: { success: true, user } };
  } catch (error) {
    console.error("Error fetching user data:", error);
    return { status: 500, json: { error: "Internal server error" } };
  }
}

async function getProfileStats(userId) {
  try {
    let stats = await UserProfileStats.findOne({ user: userId });
    if (!stats) {
      stats = await UserProfileStats.create({
        user: userId,
        giftsCount: 0,
        luckyWheelCount: 0,
        badgeCount: 1,
      });
    }
    return {
      status: 200,
      json: {
        success: true,
        giftsCount: stats.giftsCount ?? 0,
        luckyWheelCount: stats.luckyWheelCount ?? 0,
        badgeCount: stats.badgeCount ?? 1,
      },
    };
  } catch (error) {
    console.error("Error fetching profile stats:", error);
    return { status: 500, json: { error: "Internal server error" } };
  }
}

async function updateProfileStats(userId, body) {
  try {
    const { giftsCount, luckyWheelCount, badgeCount } = body;
    let stats = await UserProfileStats.findOne({ user: userId });
    if (!stats) {
      stats = await UserProfileStats.create({
        user: userId,
        giftsCount: 0,
        luckyWheelCount: 0,
        badgeCount: 1,
      });
    }
    if (typeof giftsCount === "number" && giftsCount >= 0)
      stats.giftsCount = giftsCount;
    if (typeof luckyWheelCount === "number" && luckyWheelCount >= 0)
      stats.luckyWheelCount = luckyWheelCount;
    if (typeof badgeCount === "number" && badgeCount >= 0)
      stats.badgeCount = badgeCount;
    await stats.save();
    return {
      status: 200,
      json: {
        success: true,
        giftsCount: stats.giftsCount ?? 0,
        luckyWheelCount: stats.luckyWheelCount ?? 0,
        badgeCount: stats.badgeCount ?? 1,
      },
    };
  } catch (error) {
    console.error("Error updating profile stats:", error);
    return { status: 500, json: { error: "Internal server error" } };
  }
}

async function listUserDevices(userId) {
  try {
    const user = await User.findById(userId).lean();
    if (!user) return { status: 404, json: { error: "User not found" } };

    const subInfo = getSubscriptionInfo(user);
    const maxDevices = subInfo.maxDevices;

    const devices = await Device.find({ userId })
      .sort({ lastLoginAt: -1 })
      .select("-userId -__v")
      .lean();

    const activeDevices = devices.filter((d) => d.isActive);
    const inactiveDevices = devices.filter((d) => !d.isActive);

    return {
      status: 200,
      json: {
        success: true,
        devices: activeDevices,
        allDevices: devices,
        activeDevices,
        inactiveDevices,
        subscriptionType: user.subscription || "Games",
        maxDevices,
        currentDeviceCount: activeDevices.length,
        canAddDevice: activeDevices.length < maxDevices,
      },
    };
  } catch (error) {
    console.error("Error fetching user devices:", error);
    return { status: 500, json: { error: "Internal server error" } };
  }
}

async function updateUserIcon({ userId, imageUrl }) {
  if (!userId || !imageUrl) {
    return {
      status: 400,
      json: { error: "User ID and image URL are required" },
    };
  }
  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { userIcon: imageUrl },
      { new: true }
    );
    if (!updatedUser)
      return { status: 404, json: { error: "User not found" } };
    return {
      status: 200,
      json: {
        success: true,
        message: "User icon updated successfully",
        user: updatedUser,
      },
    };
  } catch (error) {
    console.error("Error updating user icon:", error);
    return { status: 500, json: { error: "Internal server error" } };
  }
}

async function updateName(body) {
  try {
    if (!body || Object.keys(body).length === 0) {
      return { status: 400, json: { message: "Request body is empty" } };
    }
    const { userId, newName } = body;
    if (!userId || !newName.trim()) {
      return {
        status: 400,
        json: { message: "User ID and new name are required" },
      };
    }
    const user = await User.findById(userId);
    if (!user) return { status: 404, json: { message: "User not found" } };
    user.name = newName;
    await user.save();
    return {
      status: 200,
      json: { message: "Name updated successfully", updatedName: user.name },
    };
  } catch (error) {
    console.error("Error updating name:", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function getUserById(id) {
  try {
    const user = await User.findById(id).lean();
    if (!user) return { status: 404, json: { message: "User not found" } };
    return { status: 200, json: { user } };
  } catch (error) {
    console.error("Error fetching user:", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function updateAccountStatus(userId, status) {
  if (!["Active", "Hold"].includes(status)) {
    return {
      status: 400,
      json: { error: "Invalid status. Must be 'Active' or 'Hold'." },
    };
  }
  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { accountStatus: status },
      { new: true }
    );
    if (!updatedUser)
      return { status: 404, json: { error: "User not found." } };
    return {
      status: 200,
      json: {
        message: `User status updated to '${status}'.`,
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          mobileNumber: updatedUser.mobileNumber,
          accountStatus: updatedUser.accountStatus,
        },
      },
    };
  } catch (error) {
    console.error("Error updating user status:", error);
    return { status: 500, json: { error: "Server error" } };
  }
}

async function updateProfile(body) {
  const {
    userId,
    name,
    amount,
    phone,
    email,
    userIcon,
    darkMode,
    potentialRewards,
    loyaltyProgress,
    autoCashoutNotification,
  } = body;

  try {
    if (!userId) {
      return {
        status: 400,
        json: {
          success: false,
          message:
            "User ID is required. Please wait for your profile to load and try again.",
        },
      };
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return {
        status: 400,
        json: { success: false, message: "Invalid user ID." },
      };
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.mobileNumber = phone;
    if (email !== undefined) updateData.email = email;
    if (userIcon !== undefined) updateData.userIcon = userIcon;
    if (darkMode !== undefined) updateData.darkMode = darkMode;
    if (potentialRewards !== undefined)
      updateData.potentialRewards = potentialRewards;
    if (loyaltyProgress !== undefined)
      updateData.loyaltyProgress = Math.max(
        0,
        Math.min(100, loyaltyProgress)
      );
    if (autoCashoutNotification !== undefined)
      updateData.autoCashoutNotification = autoCashoutNotification;

    if (Object.keys(updateData).length > 0) {
      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
      });
      if (!updatedUser) {
        return {
          status: 404,
          json: { success: false, message: "User not found." },
        };
      }
    }

    const parsedAmount =
      amount !== undefined && amount !== null && amount !== ""
        ? Number(amount)
        : NaN;
    if (Number.isFinite(parsedAmount) && parsedAmount >= 0) {
      await Balance.findOneAndUpdate(
        { userId },
        { $set: { amount: parsedAmount } },
        { upsert: true, new: true }
      );
    }

    return { status: 200, json: { success: true, message: "Profile updated" } };
  } catch (err) {
    console.error("Update error:", err);
    const message = err.message || "Update failed";
    return { status: 500, json: { success: false, message } };
  }
}

module.exports = {
  getProfile,
  getProfileStats,
  updateProfileStats,
  listUserDevices,
  updateUserIcon,
  updateName,
  getUserById,
  updateAccountStatus,
  updateProfile,
};

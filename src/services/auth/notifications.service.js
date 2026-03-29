const mongoose = require("mongoose");
const User = require("../../../models/user");

async function updateNotificationSettings(body) {
  try {
    const { userId, notificationType, notificationPhoneNumber } = body;

    console.log("Update notification settings request:", {
      userId,
      notificationType,
      notificationPhoneNumber,
    });

    if (!userId) {
      return {
        status: 400,
        json: { success: false, message: "User ID is required" },
      };
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return {
        status: 400,
        json: { success: false, message: "Invalid user ID format" },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    const updateData = {};

    if (notificationType !== undefined) {
      if (!["inbuilt", "third-party"].includes(notificationType)) {
        return {
          status: 400,
          json: {
            success: false,
            message:
              "Invalid notification type. Must be 'inbuilt' or 'third-party'",
          },
        };
      }
      updateData.notificationType = notificationType;
      console.log("Updating notificationType to:", notificationType);
    }

    if (notificationPhoneNumber !== undefined) {
      if (notificationPhoneNumber !== user.notificationPhoneNumber) {
        updateData.notificationPhoneNumber = notificationPhoneNumber;
        updateData.notificationPhoneVerified = false;
      }
    }

    if (body.notificationPhoneVerified !== undefined) {
      updateData.notificationPhoneVerified =
        body.notificationPhoneVerified === true;
    }

    if (Object.keys(updateData).length === 0) {
      return {
        status: 400,
        json: { success: false, message: "No fields to update" },
      };
    }

    console.log("Update data:", updateData);

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    if (!updatedUser) {
      return {
        status: 500,
        json: { success: false, message: "Failed to update user" },
      };
    }

    console.log(
      "User updated successfully. New notificationType:",
      updatedUser.notificationType
    );

    const freshUser = await User.findById(userId).select(
      "notificationPhoneNumber notificationPhoneVerified notificationType smsPoints"
    );

    return {
      status: 200,
      json: {
        success: true,
        message: "Notification settings updated successfully",
        data: {
          notificationPhoneNumber: freshUser.notificationPhoneNumber,
          notificationPhoneVerified: freshUser.notificationPhoneVerified,
          notificationType: freshUser.notificationType,
          smsPoints: freshUser.smsPoints,
        },
      },
    };
  } catch (error) {
    console.error("Error updating notification settings:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error",
        error: error.message,
      },
    };
  }
}

async function getSmsPoints(userId) {
  try {
    console.log("Get SMS points request:", { userId });

    if (!userId) {
      return {
        status: 400,
        json: { success: false, message: "User ID is required" },
      };
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("Invalid user ID format:", userId);
      return {
        status: 400,
        json: { success: false, message: "Invalid user ID format" },
      };
    }

    const user = await User.findById(userId).select(
      "smsPoints notificationPhoneNumber notificationPhoneVerified notificationType"
    );

    if (!user) {
      console.error("User not found:", userId);
      return {
        status: 404,
        json: { success: false, message: "User not found" },
      };
    }

    console.log("User found:", {
      id: user._id,
      smsPoints: user.smsPoints,
      notificationPhoneNumber: user.notificationPhoneNumber,
      notificationPhoneVerified: user.notificationPhoneVerified,
      notificationPhoneVerifiedType: typeof user.notificationPhoneVerified,
      notificationType: user.notificationType,
    });

    const notificationType = user.notificationType || "third-party";
    const notificationPhoneVerified =
      user.notificationPhoneVerified === true ||
      user.notificationPhoneVerified === "true";

    console.log("Returning data:", {
      notificationPhoneVerified,
      notificationPhoneNumber: user.notificationPhoneNumber || null,
      notificationType,
    });

    return {
      status: 200,
      json: {
        success: true,
        data: {
          smsPoints: user.smsPoints || 0,
          notificationPhoneNumber: user.notificationPhoneNumber || null,
          notificationPhoneVerified,
          notificationType,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching SMS points:", error);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);

    const errorMessage =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error";

    return {
      status: 500,
      json: {
        success: false,
        message: "Server error",
        error: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          stack: error.stack,
          name: error.name,
        }),
      },
    };
  }
}

module.exports = { updateNotificationSettings, getSmsPoints };

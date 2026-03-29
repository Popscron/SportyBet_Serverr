const bcrypt = require("bcryptjs");
const User = require("../../../models/user");
const PasswordChangeRequest = require("../../../models/PasswordChangeRequest");

async function requestPasswordChange({ userId, currentPassword, newPassword }) {
  try {
    if (!userId || !currentPassword || !newPassword) {
      return {
        status: 400,
        json: {
          message: "userId, currentPassword and newPassword are required",
        },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { message: "User not found" } };
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return { status: 401, json: { message: "Current password is incorrect" } };
    }

    const existingPending = await PasswordChangeRequest.findOne({
      userId,
      status: "pending",
    });
    if (existingPending) {
      return {
        status: 409,
        json: { message: "There is already a pending password change request" },
      };
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const requestDoc = await PasswordChangeRequest.create({
      userId,
      newPasswordHash,
      status: "pending",
    });

    return {
      status: 201,
      json: {
        success: true,
        message:
          "Password change request submitted and pending admin approval",
        requestId: requestDoc._id,
      },
    };
  } catch (error) {
    console.error("Error creating password change request:", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function listPasswordChangeRequests(query) {
  try {
    const { status } = query;
    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }
    const requests = await PasswordChangeRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "name email username mobileNumber");
    return { status: 200, json: { success: true, requests } };
  } catch (error) {
    console.error("Error listing password change requests:", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function approvePasswordChangeRequest(id) {
  try {
    const requestDoc = await PasswordChangeRequest.findById(id);
    if (!requestDoc) {
      return { status: 404, json: { message: "Request not found" } };
    }
    if (requestDoc.status !== "pending") {
      return {
        status: 400,
        json: { message: "Only pending requests can be approved" },
      };
    }

    await User.findByIdAndUpdate(requestDoc.userId, {
      password: requestDoc.newPasswordHash,
    });

    requestDoc.status = "approved";
    await requestDoc.save();

    return {
      status: 200,
      json: { success: true, message: "Password updated and request approved" },
    };
  } catch (error) {
    console.error("Error approving password change request:", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function rejectPasswordChangeRequest(id, body) {
  try {
    const { reason } = body;
    const requestDoc = await PasswordChangeRequest.findById(id);
    if (!requestDoc) {
      return { status: 404, json: { message: "Request not found" } };
    }
    if (requestDoc.status !== "pending") {
      return {
        status: 400,
        json: { message: "Only pending requests can be rejected" },
      };
    }

    requestDoc.status = "rejected";
    requestDoc.rejectedReason = reason || "";
    await requestDoc.save();

    return {
      status: 200,
      json: { success: true, message: "Password change request rejected" },
    };
  } catch (error) {
    console.error("Error rejecting password change request:", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function adminSetUserPassword(userId, body) {
  try {
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Password is required and must be at least 6 characters long",
        },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return {
        status: 404,
        json: { success: false, message: "User not found" },
      };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      isDefaultPassword: false,
    });

    return {
      status: 200,
      json: {
        success: true,
        message: `Password has been set successfully.`,
        passwordSet: true,
      },
    };
  } catch (error) {
    console.error("Error setting user password:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function userChangePassword(userId, { currentPassword, newPassword }) {
  try {
    if (!currentPassword || !newPassword) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Current password and new password are required",
        },
      };
    }

    if (newPassword.length < 6) {
      return {
        status: 400,
        json: {
          success: false,
          message: "New password must be at least 6 characters long",
        },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return {
        status: 401,
        json: { success: false, message: "Current password is incorrect" },
      };
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(userId, {
      password: hashedNewPassword,
      isDefaultPassword: false,
    });

    return {
      status: 200,
      json: { success: true, message: "Password changed successfully" },
    };
  } catch (error) {
    console.error("Error changing password:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

module.exports = {
  requestPasswordChange,
  listPasswordChangeRequests,
  approvePasswordChangeRequest,
  rejectPasswordChangeRequest,
  adminSetUserPassword,
  userChangePassword,
};

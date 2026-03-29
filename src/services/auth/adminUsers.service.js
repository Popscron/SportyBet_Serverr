const User = require("../../../models/user");

async function getAllUsers() {
  try {
    const allUsers = await User.find()
      .sort({ createdAt: -1 })
      .lean();
    return { status: 200, json: { success: true, allUsers } };
  } catch (error) {
    console.error("Error fetching all users", error);
    return {
      status: 500,
      json: { message: "Server error", errorr: error },
    };
  }
}

async function deleteUser(id) {
  try {
    const user = await User.findById(id);
    if (!user) {
      return {
        status: 404,
        json: { success: false, message: "User not found" },
      };
    }
    await User.findByIdAndDelete(id);
    return {
      status: 200,
      json: { success: true, message: "User deleted successfully." },
    };
  } catch (error) {
    console.log(error);
    return {
      status: 500,
      json: { success: false, message: "Server error" },
    };
  }
}

async function getAllUsersByStatus() {
  try {
    const allActiveUsers = await User.find({ accountStatus: "Active" })
      .sort({ createdAt: -1 })
      .lean();
    const allDisableUsers = await User.find({ accountStatus: "Hold" })
      .sort({ createdAt: -1 })
      .lean();
    return {
      status: 200,
      json: { success: true, allActiveUsers, allDisableUsers },
    };
  } catch (error) {
    console.error("Error fetching all users", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function disableUserAccountStatus(id) {
  try {
    const user = await User.findById(id);
    if (!user) {
      return {
        status: 404,
        json: { success: false, message: "User not found" },
      };
    }
    await User.findByIdAndUpdate(id, { accountStatus: "Hold" });
    return {
      status: 200,
      json: { success: true, message: "User disabled successfully." },
    };
  } catch (error) {
    console.error("Error disabling user", error);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function activeUserAccountStatus(id) {
  try {
    const user = await User.findOne({ _id: id, accountStatus: "Hold" });
    if (!user) {
      return {
        status: 404,
        json: {
          success: false,
          message: "User not found or not on Hold",
        },
      };
    }
    await User.findByIdAndUpdate(id, { accountStatus: "Active" });
    return {
      status: 200,
      json: { success: true, message: "User activated successfully." },
    };
  } catch (error) {
    console.error("Error activating user", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function getExpiredUsers() {
  try {
    const currentDate = new Date();
    const expiredUsers = await User.find({
      expiry: { $lt: currentDate },
    }).lean();
    return { status: 200, json: { success: true, expiredUsers } };
  } catch (error) {
    console.error("Error fetching expired users:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function activeUserAccount(id, body) {
  const { expiryDate } = body;
  try {
    if (!expiryDate || expiryDate === "none") {
      return {
        status: 400,
        json: { success: false, message: "Select a valid expiry period" },
      };
    }

    const expiryDays = Number(expiryDate);
    if (isNaN(expiryDays) || expiryDays <= 0) {
      return {
        status: 400,
        json: { success: false, message: "Invalid expiry date" },
      };
    }

    const user = await User.findById(id);
    if (!user) {
      return {
        status: 404,
        json: { success: false, message: "User not found" },
      };
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expiryDays);

    const expiryMap = {
      7: "1 Week",
      14: "2 Weeks",
      21: "3 Weeks",
      30: "1 Month",
      60: "2 Months",
      90: "3 Months",
    };

    const expiryValue = expiryMap[expiryDate];

    await User.findByIdAndUpdate(id, {
      expiry,
      expiryPeriod: expiryValue,
    });

    return {
      status: 200,
      json: { success: true, message: "User activated successfully." },
    };
  } catch (error) {
    console.error("Error activating user", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function updateUserFields(body) {
  try {
    const { userId, username, subscription, expiry } = body;

    if (!userId) {
      return {
        status: 400,
        json: { success: false, message: "User ID is required" },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return {
        status: 404,
        json: { success: false, message: "User not found" },
      };
    }

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (subscription !== undefined) updateData.subscription = subscription;
    if (expiry !== undefined) {
      updateData.expiry = expiry ? new Date(expiry) : null;
    }

    if (Object.keys(updateData).length === 0) {
      return {
        status: 400,
        json: { success: false, message: "No fields to update" },
      };
    }

    await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: false,
    });

    return {
      status: 200,
      json: { success: true, message: "User fields updated successfully" },
    };
  } catch (error) {
    console.error("Error updating user fields:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error", error: error.message },
    };
  }
}

module.exports = {
  getAllUsers,
  deleteUser,
  getAllUsersByStatus,
  disableUserAccountStatus,
  activeUserAccountStatus,
  getExpiredUsers,
  activeUserAccount,
  updateUserFields,
};

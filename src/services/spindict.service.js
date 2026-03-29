const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SpindictTransaction = require("../../models/SpindictTransaction");
const SpindictUser = require("../../models/SpindictUser");
const User = require("../../models/user");
const { jwtSecret } = require("../config/auth.config");

async function login(body) {
  const { identifier, password } = body;

  if (!identifier || !password) {
    return {
      status: 400,
      json: { success: false, message: "Both fields are required" },
    };
  }

  try {
    const user = await SpindictUser.findOne({
      $or: [
        { email: identifier.toLowerCase() },
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

    if (user.accountStatus !== "Active") {
      return {
        status: 403,
        json: {
          success: false,
          message: "Account is not active. Please contact support.",
        },
      };
    }

    const token = jwt.sign({ id: user._id, email: user.email }, jwtSecret, {
      expiresIn: "7d",
    });

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      subscription: user.subscription,
      accountStatus: user.accountStatus,
    };

    return {
      status: 200,
      json: {
        success: true,
        token,
        user: userData,
      },
    };
  } catch (error) {
    console.error("Login error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function createTransaction(userId, body) {
  try {
    const { amount, packageType, paymentMethod } = body;

    if (!amount || !packageType) {
      return {
        status: 400,
        json: { message: "Amount and package type are required" },
      };
    }

    const transaction = new SpindictTransaction({
      user: userId,
      amount,
      packageType,
      paymentMethod: paymentMethod || "Online",
      status: "pending",
    });

    await transaction.save();
    await transaction.populate("user", "name email");

    return {
      status: 201,
      json: {
        success: true,
        transaction,
      },
    };
  } catch (error) {
    console.error("Create transaction error:", error);
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

async function listMyTransactions(userId) {
  try {
    const transactions = await SpindictTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("user", "name email");

    return {
      status: 200,
      json: {
        success: true,
        transactions,
      },
    };
  } catch (error) {
    console.error("Get transactions error:", error);
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

async function updateTransactionStatus(transactionId, body) {
  try {
    const { status } = body;

    if (!["pending", "completed", "failed"].includes(status)) {
      return { status: 400, json: { message: "Invalid status" } };
    }

    const updateData = { status };
    if (status === "completed") {
      updateData.completedAt = new Date();
    }

    const transaction = await SpindictTransaction.findByIdAndUpdate(
      transactionId,
      updateData,
      { new: true }
    ).populate("user", "name email");

    if (!transaction) {
      return { status: 404, json: { message: "Transaction not found" } };
    }

    return {
      status: 200,
      json: {
        success: true,
        transaction,
      },
    };
  } catch (error) {
    console.error("Update transaction error:", error);
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

async function getAdminUsers() {
  try {
    const users = await User.find({ platform: "spindict" })
      .select("-password -token")
      .sort({ createdAt: -1 });

    return {
      status: 200,
      json: {
        success: true,
        users,
        total: users.length,
      },
    };
  } catch (error) {
    console.error("Get users error:", error);
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

async function getAdminPaidUsers() {
  try {
    const paidUserIds = await SpindictTransaction.distinct("user", {
      status: "completed",
    });

    const paidUsers = await SpindictUser.find({ _id: { $in: paidUserIds } })
      .select("-password")
      .sort({ createdAt: -1 });

    return {
      status: 200,
      json: {
        success: true,
        users: paidUsers,
        total: paidUsers.length,
      },
    };
  } catch (error) {
    console.error("Get paid users error:", error);
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

async function getAdminStatistics() {
  try {
    const totalUsers = await SpindictUser.countDocuments({});

    const paidUserIds = await SpindictTransaction.distinct("user", {
      status: "completed",
    });
    const totalPaidUsers = paidUserIds.length;

    const revenueResult = await SpindictTransaction.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    const packageStats = await SpindictTransaction.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$packageType",
          count: { $sum: 1 },
          revenue: { $sum: "$amount" },
        },
      },
    ]);

    const statusStats = await SpindictTransaction.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentTransactions = await SpindictTransaction.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    return {
      status: 200,
      json: {
        success: true,
        statistics: {
          totalUsers,
          totalPaidUsers,
          totalRevenue,
          packageStats,
          statusStats,
          recentTransactions,
        },
      },
    };
  } catch (error) {
    console.error("Get statistics error:", error);
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

async function getAdminAllTransactions() {
  try {
    const transactions = await SpindictTransaction.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return {
      status: 200,
      json: {
        success: true,
        transactions,
        total: transactions.length,
      },
    };
  } catch (error) {
    console.error("Get all transactions error:", error);
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

module.exports = {
  login,
  createTransaction,
  listMyTransactions,
  updateTransactionStatus,
  getAdminUsers,
  getAdminPaidUsers,
  getAdminStatistics,
  getAdminAllTransactions,
};

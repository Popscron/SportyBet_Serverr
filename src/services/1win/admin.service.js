const User = require("../../../models/1win/User");
const PaymentTransaction = require("../../../models/1win/PaymentTransaction");
const { generateUniqueInviteCode } = require("../../../utils/inviteCodeGenerator");

async function getUsers() {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    return { status: 200, json: { success: true, data: users } };
  } catch (error) {
    console.error("Get users error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error fetching users" },
    };
  }
}

async function getWebsiteUsers() {
  try {
    const users = await User.find({ registeredFromWebsite: true })
      .select("-password")
      .sort({ createdAt: -1 });
    return { status: 200, json: { success: true, data: users } };
  } catch (error) {
    console.error("Get website users error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error fetching website users" },
    };
  }
}

async function getUserById(id) {
  try {
    const user = await User.findById(id).select("-password");
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }
    return { status: 200, json: { success: true, data: user } };
  } catch (error) {
    console.error("Get user error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error fetching user" },
    };
  }
}

async function createUser(body) {
  try {
    const {
      email,
      phone,
      password,
      name,
      currency,
      balance,
      subscriptionType,
      subscriptionExpiry,
      role,
    } = body;

    if (!email && !phone) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Either email or phone number is required",
        },
      };
    }

    const userRole = role === "admin" ? "admin" : "user";
    const isAdmin = userRole === "admin";

    const existingUser = await User.findOne({
      $or: [{ email: email?.toLowerCase() }, { phone }],
    });

    if (existingUser) {
      return {
        status: 400,
        json: {
          success: false,
          message: "User already exists with this email or phone",
        },
      };
    }

    const user = await User.create({
      email: email?.toLowerCase(),
      phone,
      password,
      name,
      currency: currency || "GHS",
      balance: balance || 0,
      subscriptionType: subscriptionType || null,
      subscriptionExpiry: subscriptionExpiry || null,
      role: userRole,
      isAdmin: isAdmin,
    });

    const userResponse = await User.findById(user._id).select("-password");

    return {
      status: 201,
      json: {
        success: true,
        data: userResponse,
        message: "User created successfully",
      },
    };
  } catch (error) {
    console.error("Create user error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error creating user" },
    };
  }
}

async function updateUser(id, body) {
  try {
    const {
      email,
      phone,
      name,
      currency,
      balance,
      subscriptionType,
      subscriptionExpiry,
      subscriptionExpiresAt,
      isActive,
      role,
    } = body;

    const normalizedSubscriptionType = subscriptionType === "" ? null : subscriptionType;

    const user = await User.findById(id);

    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    if (email !== undefined) user.email = email?.toLowerCase();
    if (phone !== undefined) {
      user.phone = phone === "" ? null : phone;
    }
    if (name !== undefined) user.name = name;
    if (currency !== undefined) user.currency = currency;
    if (balance !== undefined) user.balance = parseFloat(balance);
    if (normalizedSubscriptionType !== undefined) user.subscriptionType = normalizedSubscriptionType;

    const expiryValue =
      subscriptionExpiresAt !== undefined ? subscriptionExpiresAt : subscriptionExpiry;
    if (expiryValue !== undefined) {
      user.subscriptionExpiresAt =
        expiryValue === "" || expiryValue === null ? null : expiryValue;
    }

    if (isActive !== undefined) user.isActive = isActive;

    if (role !== undefined) {
      user.role = role === "admin" ? "admin" : "user";
      user.isAdmin = role === "admin";
    }

    await user.save();

    const userResponse = await User.findById(user._id).select("-password");

    return {
      status: 200,
      json: {
        success: true,
        data: userResponse,
        message: "User updated successfully",
      },
    };
  } catch (error) {
    console.error("Update user error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      status: 500,
      json: {
        success: false,
        message: error.message || "Server error updating user",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
    };
  }
}

async function deleteUser(id) {
  try {
    const user = await User.findById(id);

    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    await User.findByIdAndDelete(id);

    return {
      status: 200,
      json: { success: true, message: "User deleted successfully" },
    };
  } catch (error) {
    console.error("Delete user error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error deleting user" },
    };
  }
}

async function toggleUserStatus(id, body) {
  try {
    const { isActive } = body;

    const user = await User.findById(id);

    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    user.isActive = isActive !== undefined ? isActive : !user.isActive;
    await user.save();

    return {
      status: 200,
      json: {
        success: true,
        data: user,
        message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
      },
    };
  } catch (error) {
    console.error("Toggle status error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error updating user status" },
    };
  }
}

async function getExpiredUsers() {
  try {
    const now = new Date();
    const users = await User.find({
      subscriptionExpiresAt: { $lte: now, $ne: null },
    })
      .select("-password")
      .sort({ subscriptionExpiresAt: -1 });

    return { status: 200, json: { success: true, data: users } };
  } catch (error) {
    console.error("Get expired users error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error fetching expired users" },
    };
  }
}

async function getDisabledUsers() {
  try {
    const users = await User.find({
      isActive: false,
    })
      .select("-password")
      .sort({ updatedAt: -1 });

    return { status: 200, json: { success: true, data: users } };
  } catch (error) {
    console.error("Get disabled users error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error fetching disabled users" },
    };
  }
}

async function getAdminsList() {
  try {
    console.log("📋 Fetching admins list...");

    const admins = await User.find({
      $or: [{ role: "admin" }, { isAdmin: true }],
    })
      .select("-password")
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${admins.length} admin(s)`);
    console.log(
      "Admin details:",
      admins.map((a) => ({
        email: a.email,
        role: a.role,
        isAdmin: a.isAdmin,
      }))
    );

    let updatedCount = 0;
    for (const admin of admins) {
      if (admin.role === "admin" && !admin.isAdmin) {
        console.log(`🔧 Fixing: ${admin.email} - has role 'admin' but isAdmin is false`);
        admin.isAdmin = true;
        await admin.save();
        updatedCount++;
      } else if (admin.isAdmin && admin.role !== "admin") {
        console.log(`🔧 Fixing: ${admin.email} - has isAdmin true but role is not 'admin'`);
        admin.role = "admin";
        await admin.save();
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`✅ Fixed ${updatedCount} inconsistent admin record(s)`);
    }

    const refreshed = await User.find({
      $or: [{ role: "admin" }, { isAdmin: true }],
    })
      .select("-password")
      .sort({ createdAt: -1 });

    return { status: 200, json: { success: true, data: refreshed } };
  } catch (error) {
    console.error("❌ Get admins list error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error fetching admins",
        error: error.message,
      },
    };
  }
}

async function getAdminsWithStats() {
  try {
    const admins = await User.find({
      $or: [{ role: "admin" }, { isAdmin: true }],
    })
      .select("-password")
      .sort({ createdAt: -1 });

    for (const admin of admins) {
      if (admin.role === "admin" && !admin.isAdmin) {
        admin.isAdmin = true;
        await admin.save();
      } else if (admin.isAdmin && admin.role !== "admin") {
        admin.role = "admin";
        await admin.save();
      }
    }

    const adminsReloaded = await User.find({
      $or: [{ role: "admin" }, { isAdmin: true }],
    })
      .select("-password")
      .sort({ createdAt: -1 });

    const adminsWithStats = await Promise.all(
      adminsReloaded.map(async (admin) => {
        const payments = await PaymentTransaction.find({
          referringAdminId: admin._id,
          status: "completed",
        });

        const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
        const totalEarnings = payments.reduce(
          (sum, payment) => sum + payment.referringAdminShare,
          0
        );

        return {
          ...admin.toObject(),
          totalPayments: payments.length,
          totalAmount,
          totalEarnings,
        };
      })
    );

    return { status: 200, json: { success: true, data: adminsWithStats } };
  } catch (error) {
    console.error("Get admins error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error fetching admins" },
    };
  }
}

async function createAdmin(body) {
  try {
    const { email, password, name } = body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return {
        status: 400,
        json: {
          success: false,
          message: "User already exists with this email",
        },
      };
    }

    const inviteCode = await generateUniqueInviteCode();

    const admin = await User.create({
      email: email.toLowerCase(),
      password,
      name: name || "Admin User",
      isAdmin: true,
      role: "admin",
      inviteCode,
    });

    console.log("Admin created:", {
      id: admin._id,
      email: admin.email,
      isAdmin: admin.isAdmin,
      role: admin.role,
      inviteCode: admin.inviteCode,
    });

    const adminResponse = await User.findById(admin._id).select("-password");

    return {
      status: 201,
      json: {
        success: true,
        data: adminResponse,
        message: "Admin user created successfully",
      },
    };
  } catch (error) {
    console.error("Create admin error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error creating admin" },
    };
  }
}

async function updateAdminRole(id, body) {
  try {
    const { role } = body;

    const admin = await User.findById(id);

    if (!admin || !admin.isAdmin) {
      return {
        status: 404,
        json: { success: false, message: "Admin user not found" },
      };
    }

    admin.role = role;
    await admin.save();

    const adminResponse = await User.findById(admin._id).select("-password");

    return {
      status: 200,
      json: {
        success: true,
        data: adminResponse,
        message: "Admin role updated successfully",
      },
    };
  } catch (error) {
    console.error("Update admin role error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error updating admin role" },
    };
  }
}

async function generateAdminInviteCode(id) {
  try {
    const admin = await User.findById(id);

    if (!admin || !admin.isAdmin) {
      return {
        status: 404,
        json: { success: false, message: "Admin user not found" },
      };
    }

    const newInviteCode = await generateUniqueInviteCode();
    admin.inviteCode = newInviteCode;
    await admin.save();

    return {
      status: 200,
      json: {
        success: true,
        data: {
          inviteCode: newInviteCode,
          inviteLink: `${process.env.FRONTEND_URL || "http://localhost:5173"}/${newInviteCode}`,
        },
        message: "Invite code generated successfully",
      },
    };
  } catch (error) {
    console.error("Generate invite code error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error generating invite code" },
    };
  }
}

async function getAdminStats(id) {
  try {
    const admin = await User.findById(id);

    if (!admin || !admin.isAdmin) {
      return {
        status: 404,
        json: { success: false, message: "Admin user not found" },
      };
    }

    const payments = await PaymentTransaction.find({
      referringAdminId: admin._id,
      status: "completed",
    }).sort({ createdAt: -1 });

    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const mainAdminShare = payments.reduce((sum, payment) => sum + payment.mainAdminShare, 0);
    const referringAdminShare = payments.reduce(
      (sum, payment) => sum + payment.referringAdminShare,
      0
    );

    return {
      status: 200,
      json: {
        success: true,
        data: {
          admin: {
            id: admin._id,
            email: admin.email,
            name: admin.name,
            inviteCode: admin.inviteCode,
          },
          stats: {
            totalPayments: payments.length,
            totalAmount,
            mainAdminShare,
            referringAdminShare,
          },
          payments: payments.map((p) => ({
            id: p._id,
            amount: p.amount,
            currency: p.currency,
            planType: p.planType,
            mainAdminShare: p.mainAdminShare,
            referringAdminShare: p.referringAdminShare,
            createdAt: p.createdAt,
          })),
        },
      },
    };
  } catch (error) {
    console.error("Get admin stats error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error fetching admin stats" },
    };
  }
}

function getMyInviteLink(admin) {
  try {
    console.log("📞 /my-invite-link route called");
    console.log("Admin details:", {
      id: admin._id,
      email: admin.email,
      isAdmin: admin.isAdmin,
      inviteCode: admin.inviteCode,
    });

    if (!admin.inviteCode) {
      console.log("⚠️ Admin has no invite code");
      return {
        status: 404,
        json: {
          success: false,
          message: "Invite code not found. Please contact super admin.",
        },
      };
    }

    const frontendUrl = process.env.ONEWIN_FRONTEND_URL || "http://localhost:5177";
    const inviteLink = `${frontendUrl}/${admin.inviteCode}`;
    console.log("Generated invite link:", inviteLink);

    return {
      status: 200,
      json: {
        success: true,
        data: {
          inviteCode: admin.inviteCode,
          inviteLink,
        },
      },
    };
  } catch (error) {
    console.error("Get invite link error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error fetching invite link" },
    };
  }
}

async function getMyEarnings(adminId) {
  try {
    console.log("📞 /my-earnings route called");
    console.log("Admin ID for earnings:", adminId);

    const payments = await PaymentTransaction.find({
      referringAdminId: adminId,
      status: "completed",
    }).sort({ createdAt: -1 });

    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalEarnings = payments.reduce(
      (sum, payment) => sum + payment.referringAdminShare,
      0
    );

    return {
      status: 200,
      json: {
        success: true,
        data: {
          totalPayments: payments.length,
          totalAmount,
          totalEarnings,
          payments: payments.map((p) => ({
            id: p._id,
            amount: p.amount,
            currency: p.currency,
            planType: p.planType,
            earnings: p.referringAdminShare,
            createdAt: p.createdAt,
          })),
        },
      },
    };
  } catch (error) {
    console.error("Get earnings error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error fetching earnings" },
    };
  }
}

async function generateAllInviteCodes() {
  try {
    const adminsWithoutCodes = await User.find({
      $and: [
        {
          $or: [{ role: "admin" }, { isAdmin: true }],
        },
        {
          $or: [{ inviteCode: { $exists: false } }, { inviteCode: null }, { inviteCode: "" }],
        },
      ],
    });

    if (adminsWithoutCodes.length === 0) {
      return {
        status: 200,
        json: {
          success: true,
          message: "All admins already have invite codes",
          data: { generated: 0 },
        },
      };
    }

    const results = [];
    for (const admin of adminsWithoutCodes) {
      try {
        const newInviteCode = await generateUniqueInviteCode();
        admin.inviteCode = newInviteCode;
        await admin.save();
        results.push({
          adminId: admin._id,
          email: admin.email,
          inviteCode: newInviteCode,
          success: true,
        });
      } catch (error) {
        console.error(`Error generating code for admin ${admin.email}:`, error);
        results.push({
          adminId: admin._id,
          email: admin.email,
          success: false,
          error: error.message,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const frontendUrl = process.env.ONEWIN_FRONTEND_URL || "http://localhost:5177";

    return {
      status: 200,
      json: {
        success: true,
        message: `Invite codes generated for ${successful} admin(s)`,
        data: {
          generated: successful,
          total: adminsWithoutCodes.length,
          results: results.map((r) => ({
            ...r,
            inviteLink: r.inviteCode ? `${frontendUrl}/${r.inviteCode}` : null,
          })),
        },
      },
    };
  } catch (error) {
    console.error("Generate all invite codes error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error generating invite codes" },
    };
  }
}

async function getMyReferredUsers(adminId) {
  try {
    console.log("📞 /my-referred-users route called");
    console.log("Admin ID for referred users:", adminId);

    const referredUsers = await User.find({
      referredBy: adminId,
    })
      .select("-password")
      .sort({ createdAt: -1 });

    const userIds = referredUsers.map((u) => u._id);
    const payments = await PaymentTransaction.find({
      userId: { $in: userIds },
      status: "completed",
    }).sort({ createdAt: -1 });

    const userPaymentsMap = {};
    payments.forEach((payment) => {
      const uid = payment.userId.toString();
      if (!userPaymentsMap[uid]) {
        userPaymentsMap[uid] = [];
      }
      userPaymentsMap[uid].push(payment);
    });

    const usersWithPaymentStatus = referredUsers.map((user) => {
      const userPayments = userPaymentsMap[user._id.toString()] || [];
      const hasActiveSubscription =
        user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date();
      const totalPaid = userPayments.reduce((sum, p) => sum + p.amount, 0);
      const lastPayment = userPayments.length > 0 ? userPayments[0] : null;

      return {
        id: user._id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        accountId: user.accountId,
        registeredAt: user.createdAt,
        subscriptionType: user.subscriptionType,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        hasActiveSubscription,
        paymentStatus: hasActiveSubscription
          ? "paid"
          : userPayments.length > 0
            ? "expired"
            : "not_paid",
        totalPayments: userPayments.length,
        totalPaid,
        lastPayment: lastPayment
          ? {
              planType: lastPayment.planType,
              amount: lastPayment.amount,
              currency: lastPayment.currency,
              date: lastPayment.createdAt,
            }
          : null,
      };
    });

    return {
      status: 200,
      json: {
        success: true,
        data: {
          totalReferredUsers: referredUsers.length,
          paidUsers: usersWithPaymentStatus.filter((u) => u.hasActiveSubscription).length,
          unpaidUsers: usersWithPaymentStatus.filter(
            (u) => !u.hasActiveSubscription && u.totalPayments === 0
          ).length,
          expiredUsers: usersWithPaymentStatus.filter(
            (u) => !u.hasActiveSubscription && u.totalPayments > 0
          ).length,
          users: usersWithPaymentStatus,
        },
      },
    };
  } catch (error) {
    console.error("Get referred users error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error fetching referred users" },
    };
  }
}

module.exports = {
  getUsers,
  getWebsiteUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getExpiredUsers,
  getDisabledUsers,
  getAdminsList,
  getAdminsWithStats,
  createAdmin,
  updateAdminRole,
  generateAdminInviteCode,
  getAdminStats,
  getMyInviteLink,
  getMyEarnings,
  generateAllInviteCodes,
  getMyReferredUsers,
};

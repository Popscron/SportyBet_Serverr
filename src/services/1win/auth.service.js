const User = require("../../../models/1win/User");
const PromoCode = require("../../../models/1win/PromoCode");
const Transaction = require("../../../models/1win/Transaction");
const Stats = require("../../../models/1win/Stats");
const { generateToken } = require("../../../config/1win/jwt");

async function register(body) {
  try {
    const { email, phone, accountId, password, name, currency, promoCode, inviteCode } = body;

    if (!email && !phone && !accountId) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Either email, phone number, or account ID is required",
        },
      };
    }

    let referringAdmin = null;
    if (inviteCode) {
      referringAdmin = await User.findOne({
        inviteCode: inviteCode.toUpperCase(),
        isAdmin: true,
      });
    }

    const queryConditions = [];
    if (email) queryConditions.push({ email: email.toLowerCase() });
    if (phone) queryConditions.push({ phone });
    if (accountId) queryConditions.push({ accountId });

    const existingUser =
      queryConditions.length > 0 ? await User.findOne({ $or: queryConditions }) : null;

    if (existingUser) {
      return {
        status: 400,
        json: {
          success: false,
          message: "User already exists with this email or phone",
        },
      };
    }

    let bonusAmount = 0;
    if (promoCode) {
      try {
        const promo = await PromoCode.findOne({
          code: promoCode.toUpperCase(),
          isActive: true,
          $or: [{ validUntil: { $gte: new Date() } }, { validUntil: null }],
        });

        if (promo && (promo.maxUses === null || promo.usedCount < promo.maxUses)) {
          if (promo.isPercentage) {
            bonusAmount = (promo.value / 100) * 0;
          } else {
            bonusAmount = promo.value;
          }
          promo.usedCount += 1;
          await promo.save();
        }
      } catch (promoError) {
        console.error("Promo code validation error:", promoError);
      }
    }

    const userData = {
      password,
      currency: currency || "GHS",
      registeredFromWebsite: true,
    };

    if (email) userData.email = email.toLowerCase();
    if (phone) userData.phone = phone;
    if (accountId) userData.accountId = accountId;
    if (name) userData.name = name;
    if (promoCode) userData.promoCode = promoCode.toUpperCase();
    if (referringAdmin) userData.referredBy = referringAdmin._id;

    const user = await User.create(userData);

    if (bonusAmount > 0) {
      user.balance += bonusAmount;
      await user.save();

      await Transaction.create({
        userId: user._id,
        type: "bonus",
        amount: bonusAmount,
        currency: user.currency,
        status: "completed",
        description: `Welcome bonus from promo code: ${promoCode}`,
        balanceBefore: 0,
        balanceAfter: bonusAmount,
      });
    }

    const token = generateToken(user._id);

    return {
      status: 201,
      json: {
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            phone: user.phone,
            name: user.name,
            currency: user.currency,
            balance: user.balance,
          },
          token,
        },
      },
    };
  } catch (error) {
    console.error("Registration error:", error);
    console.error("Error stack:", error.stack);

    if (error.code === 11000 || error.name === "MongoServerError") {
      const field = Object.keys(error.keyPattern || {})[0];
      return {
        status: 400,
        json: {
          success: false,
          message: `User already exists with this ${field}`,
        },
      };
    }

    if (error.name === "ValidationError") {
      return {
        status: 400,
        json: {
          success: false,
          message: "Validation error",
          errors: Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.message,
          })),
        },
      };
    }

    return {
      status: 500,
      json: {
        success: false,
        message: "Server error during registration",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
    };
  }
}

async function login(body) {
  try {
    const { emailOrPhone, password, source } = body;

    console.log("Login attempt:", {
      emailOrPhone,
      passwordLength: password?.length,
      source,
    });

    const user = await User.findOne({
      $or: [
        { email: emailOrPhone.toLowerCase() },
        { phone: emailOrPhone },
        { accountId: emailOrPhone },
      ],
    });

    if (!user) {
      console.log("User not found for:", emailOrPhone);
      return {
        status: 401,
        json: { success: false, message: "User does not exist" },
      };
    }

    console.log("User found:", {
      email: user.email,
      accountId: user.accountId,
      name: user.name,
      role: user.role,
    });

    if (source === "mobile" || source === "app") {
      if (user.role !== "admin" && !user.isAdmin) {
        console.log("Mobile app login denied: User is not an admin");
        return {
          status: 403,
          json: {
            success: false,
            message: "Access denied. Only admin users can login to the 1Win mobile app.",
          },
        };
      }
    }

    const isMatch = await user.comparePassword(password);
    console.log("Password match:", isMatch);

    if (!isMatch) {
      return {
        status: 401,
        json: { success: false, message: "Credentials wrong" },
      };
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    return {
      status: 200,
      json: {
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            phone: user.phone,
            name: user.name,
            currency: user.currency,
            balance: user.balance,
            isAdmin: user.isAdmin || false,
            subscriptionType: user.subscriptionType,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
            hasActiveSubscription: user.isSubscriptionActive(),
            accountId: user.accountId,
          },
          token,
        },
      },
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error during login" },
    };
  }
}

async function me(userId) {
  try {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    return {
      status: 200,
      json: {
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            phone: user.phone,
            name: user.name,
            currency: user.currency,
            balance: user.balance,
            isAdmin: user.isAdmin || false,
            role: user.role || (user.isAdmin ? "admin" : "user"),
            inviteCode: user.inviteCode || null,
            subscriptionType: user.subscriptionType,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
            hasActiveSubscription: user.isSubscriptionActive(),
            accountId: user.accountId,
          },
        },
      },
    };
  } catch (error) {
    console.error("Get user error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function adminLogin(body) {
  try {
    const { email, password } = body;

    console.log("Admin login attempt:", { email: email.toLowerCase() });

    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      console.log("Admin login failed: User not found");
      return {
        status: 401,
        json: { success: false, message: "User does not exist" },
      };
    }

    console.log("User found:", {
      email: user.email,
      isAdmin: user.isAdmin,
      role: user.role,
    });

    if (!user.isAdmin) {
      console.log("Admin login failed: Not an admin");
      return {
        status: 403,
        json: {
          success: false,
          message: "Access denied. Admin privileges required.",
        },
      };
    }

    const isMatch = await user.comparePassword(password);
    console.log("Password match:", isMatch);

    if (!isMatch) {
      console.log("Admin login failed: Wrong password");
      return {
        status: 401,
        json: { success: false, message: "Credentials wrong" },
      };
    }

    console.log("Admin login successful:", user.email);

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    return {
      status: 200,
      json: {
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            isAdmin: true,
          },
          token,
        },
      },
    };
  } catch (error) {
    console.error("Admin login error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error during login" },
    };
  }
}

async function getMinePattern(userId) {
  try {
    const user = await User.findById(userId).select(
      "minePattern minePatternTraps minePatternRevealedSpots minePatternGeneratedAt subscriptionType subscriptionExpiresAt"
    );

    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    if (!user.minePattern || !user.minePatternTraps) {
      return {
        status: 200,
        json: {
          success: true,
          data: {
            pattern: null,
            traps: null,
            message: "No pattern found",
          },
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        data: {
          pattern: user.minePattern,
          traps: user.minePatternTraps,
          revealedSpots: user.minePatternRevealedSpots || [],
          generatedAt: user.minePatternGeneratedAt,
        },
      },
    };
  } catch (error) {
    console.error("Get mine pattern error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function generateMinePattern(userId, body) {
  try {
    const { traps, force } = body;
    const user = await User.findById(userId);

    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    const validTraps = [1, 3, 5, 7];
    const numTraps = parseInt(traps, 10);

    console.log(
      `🔍 Generate pattern request - User: ${user.email}, Requested traps: ${traps}, Parsed: ${numTraps}, Force: ${force}`
    );
    console.log(
      `   Current user pattern - Traps: ${user.minePatternTraps}, Pattern exists: ${!!user.minePattern}`
    );

    if (isNaN(numTraps) || !validTraps.includes(numTraps)) {
      console.error(`❌ Invalid traps value: ${traps} (parsed: ${numTraps})`);
      return {
        status: 400,
        json: {
          success: false,
          message: "Invalid number of traps. Must be 1, 3, 5, or 7",
        },
      };
    }

    if (user.minePattern && user.minePatternTraps && !force) {
      if (user.minePatternTraps === numTraps) {
        console.log(`✅ Using existing pattern with ${numTraps} traps`);
        return {
          status: 200,
          json: {
            success: true,
            data: {
              pattern: user.minePattern,
              traps: user.minePatternTraps,
              revealedSpots: user.minePatternRevealedSpots || [],
              generatedAt: user.minePatternGeneratedAt,
              message: "Using existing pattern",
            },
          },
        };
      }
      console.log(
        `⚠️ Trap count mismatch: existing=${user.minePatternTraps}, requested=${numTraps}. Regenerating pattern.`
      );
    }

    const totalTiles = 25;
    const minePositions = [];
    while (minePositions.length < numTraps) {
      const pos = Math.floor(Math.random() * totalTiles);
      if (!minePositions.includes(pos)) {
        minePositions.push(pos);
      }
    }

    const safeSpots = Array.from({ length: totalTiles }, (_, i) => i).filter(
      (pos) => !minePositions.includes(pos)
    );
    const shuffled = [...safeSpots].sort(() => 0.5 - Math.random());
    const revealedSpots = shuffled.slice(0, 3);

    user.minePattern = minePositions;
    user.minePatternTraps = numTraps;
    user.minePatternRevealedSpots = revealedSpots;
    user.minePatternGeneratedAt = new Date();
    await user.save();

    console.log(`✅ Mine pattern generated for user ${user.email} (${user._id}):`);
    console.log(`   - Traps: ${numTraps}`);
    console.log(`   - Mine positions: ${minePositions.join(", ")}`);
    console.log(`   - Revealed safe spots: ${revealedSpots.join(", ")}`);
    console.log(`   - Total safe spots: ${safeSpots.length}`);

    return {
      status: 200,
      json: {
        success: true,
        data: {
          pattern: minePositions,
          traps: numTraps,
          revealedSpots: revealedSpots,
          generatedAt: user.minePatternGeneratedAt,
        },
      },
    };
  } catch (error) {
    console.error("❌ Generate mine pattern error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function getTransactions(userId, query) {
  try {
    const limit = parseInt(query.limit, 10) || 50;
    const page = parseInt(query.page, 10) || 1;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .select("-metadata");

    const total = await Transaction.countDocuments({ userId });

    return {
      status: 200,
      json: {
        success: true,
        data: {
          transactions,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
        },
      },
    };
  } catch (error) {
    console.error("Get transactions error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function updateAccountId(userId, body) {
  try {
    const { accountId } = body;
    const user = await User.findById(userId);

    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    const existingUser = await User.findOne({
      accountId,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      return {
        status: 400,
        json: {
          success: false,
          message: "This Account ID is already registered to another user",
        },
      };
    }

    user.accountId = accountId;
    await user.save();

    return {
      status: 200,
      json: {
        success: true,
        message: "Account ID updated successfully",
        data: {
          user: {
            id: user._id,
            accountId: user.accountId,
          },
        },
      },
    };
  } catch (error) {
    console.error("Update account ID error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error during account ID update" },
    };
  }
}

async function getStats() {
  try {
    const stats = await Stats.checkAndUpdate();

    return {
      status: 200,
      json: {
        success: true,
        data: {
          playedToday: stats.playedToday,
          totalPlayed: stats.totalPlayed,
        },
      },
    };
  } catch (error) {
    console.error("Get stats error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function validateInvite(code) {
  try {
    const inviteCode = code.toUpperCase();

    const admin = await User.findOne({
      inviteCode,
      isAdmin: true,
    });

    if (!admin) {
      return {
        status: 404,
        json: { success: false, message: "Invalid invite code" },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        data: {
          inviteCode,
          adminName: admin.name || admin.email,
        },
      },
    };
  } catch (error) {
    console.error("Validate invite code error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error validating invite code" },
    };
  }
}

function logout() {
  return {
    status: 200,
    json: {
      success: true,
      message: "Logged out successfully",
    },
  };
}

module.exports = {
  register,
  login,
  me,
  adminLogin,
  getMinePattern,
  generateMinePattern,
  getTransactions,
  updateAccountId,
  getStats,
  validateInvite,
  logout,
};

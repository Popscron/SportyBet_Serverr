const HeroCrashRound = require("../../models/HeroCrashRound");
const HeroCrashBet = require("../../models/HeroCrashBet");
const User = require("../../models/user");

function isPremiumPlusActive(user) {
  if (!user) return false;
  const isActive = !user.expiry || new Date(user.expiry) > new Date();
  return isActive && user.subscription === "Premium Plus";
}

/**
 * @returns {{ user: object } | { error: { status, json } }}
 */
async function checkPremiumPlusAccess(userId) {
  if (!userId) {
    return {
      error: {
        status: 400,
        json: { success: false, error: "userId is required" },
      },
    };
  }
  const user = await User.findById(userId).select("subscription expiry role");
  if (!user) {
    return {
      error: {
        status: 404,
        json: { success: false, error: "User not found" },
      },
    };
  }
  if (user.role === "admin") return { user };
  if (!isPremiumPlusActive(user)) {
    return {
      error: {
        status: 403,
        json: {
          success: false,
          error: "Premium Plus subscription required",
          subscriptionType: user.subscription || "Basic",
        },
      },
    };
  }
  return { user };
}

function generateRoundId() {
  return `HERO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateCrashPoint() {
  const value = Math.random() * 5 + 1;
  return parseFloat(value.toFixed(2));
}

async function getCurrentResult() {
  try {
    const now = new Date();

    let currentRound = await HeroCrashRound.findOne({
      expiresAt: { $gt: now },
      isUsed: false,
    }).sort({ createdAt: -1 });

    if (!currentRound) {
      const crashPoint = generateCrashPoint();
      const roundId = generateRoundId();
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

      currentRound = new HeroCrashRound({
        crashPoint,
        roundId,
        expiresAt,
        isUsed: false,
      });

      await currentRound.save();
    }

    return {
      status: 200,
      json: {
        success: true,
        data: {
          crashPoint: currentRound.crashPoint,
          roundId: currentRound.roundId,
          expiresAt: currentRound.expiresAt,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching sporty hero result:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch sporty hero result",
        message: error.message,
      },
    };
  }
}

async function markUsed(body) {
  try {
    const { roundId } = body;

    if (!roundId) {
      return {
        status: 400,
        json: {
          success: false,
          error: "roundId is required",
        },
      };
    }

    const round = await HeroCrashRound.findOneAndUpdate(
      { roundId, isUsed: false },
      { isUsed: true },
      { new: true }
    );

    if (!round) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Round not found or already used",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Round marked as used",
      },
    };
  } catch (error) {
    console.error("Error marking sporty hero round as used:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to mark sporty hero round as used",
        message: error.message,
      },
    };
  }
}

async function placeBet(body) {
  try {
    const { userId, roundId, panelId, stake, currencyType } = body;

    if (!userId || !roundId || !panelId || stake === undefined) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Missing required fields: userId, roundId, panelId, stake",
        },
      };
    }

    const access = await checkPremiumPlusAccess(userId);
    if (access.error) return access.error;

    const bet = new HeroCrashBet({
      userId,
      roundId,
      panelId,
      stake,
      crashPoint: 0,
      status: "active",
      currencyType: currencyType || "NGN",
    });

    await bet.save();

    return {
      status: 201,
      json: {
        success: true,
        data: bet,
        message: "Bet saved successfully",
      },
    };
  } catch (error) {
    console.error("Error saving sporty hero bet:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to save bet",
        message: error.message,
      },
    };
  }
}

async function cashout(body) {
  try {
    const { userId, roundId, panelId, cashoutMultiplier } = body;

    if (!userId || !roundId || !panelId || cashoutMultiplier === undefined) {
      return {
        status: 400,
        json: {
          success: false,
          error:
            "Missing required fields: userId, roundId, panelId, cashoutMultiplier",
        },
      };
    }

    const access = await checkPremiumPlusAccess(userId);
    if (access.error) return access.error;

    const bet = await HeroCrashBet.findOne({
      userId,
      roundId,
      panelId,
      status: "active",
    });

    if (!bet) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Active bet not found",
        },
      };
    }

    const winAmount = bet.stake * cashoutMultiplier;

    bet.cashoutMultiplier = cashoutMultiplier;
    bet.winAmount = winAmount;
    bet.status = "cashed_out";

    await bet.save();

    return {
      status: 200,
      json: {
        success: true,
        data: bet,
        message: "Cashout recorded successfully",
      },
    };
  } catch (error) {
    console.error("Error recording cashout:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to record cashout",
        message: error.message,
      },
    };
  }
}

async function applyCrash(body) {
  try {
    const { roundId, crashPoint } = body;

    if (!roundId || crashPoint === undefined) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Missing required fields: roundId, crashPoint",
        },
      };
    }

    const result = await HeroCrashBet.updateMany(
      { roundId, status: "active" },
      {
        $set: {
          crashPoint,
          status: "crashed",
          winAmount: 0,
        },
      }
    );

    return {
      status: 200,
      json: {
        success: true,
        message: "Bets updated after crash",
        updatedCount: result.modifiedCount,
      },
    };
  } catch (error) {
    console.error("Error updating bets after crash:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to update bets after crash",
        message: error.message,
      },
    };
  }
}

async function betHistory(query) {
  try {
    const { userId, filter = "all", limit = 100 } = query;

    let filterQuery = {};

    if (userId) {
      const access = await checkPremiumPlusAccess(userId);
      if (access.error) return access.error;

      filterQuery.userId = userId;
    }

    if (filter === "top-wins") {
      filterQuery.status = "cashed_out";
      filterQuery.winAmount = { $gt: 0 };
    }

    let bets = await HeroCrashBet.find(filterQuery)
      .populate("userId", "name phoneNumber")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    if (filter === "top-wins") {
      bets = [...bets].sort((a, b) => b.winAmount - a.winAmount);
    }

    return {
      status: 200,
      json: {
        success: true,
        data: bets,
        count: bets.length,
      },
    };
  } catch (error) {
    console.error("Error fetching bet history:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch bet history",
        message: error.message,
      },
    };
  }
}

module.exports = {
  getCurrentResult,
  markUsed,
  placeBet,
  cashout,
  applyCrash,
  betHistory,
};

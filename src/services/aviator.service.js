const AviatorRound = require("../../models/AviatorRound");
const AviatorBet = require("../../models/AviatorBet");
const User = require("../../models/user");
const { GAME_IDS } = require("../constants/subscriptionTiers");
const { assertGameAccess } = require("./auth/subscription.helper");

/**
 * @returns {{ user: object } | { error: { status, json } }}
 */
async function checkAviatorAccess(userId) {
  if (!userId) {
    return {
      error: {
        status: 400,
        json: { success: false, error: "userId is required" },
      },
    };
  }
  const user = await User.findById(userId).select(
    "subscription expiry role allowedGames smsPoints"
  );
  if (!user) {
    return {
      error: {
        status: 404,
        json: { success: false, error: "User not found" },
      },
    };
  }
  const access = assertGameAccess(user, GAME_IDS.AVIATOR);
  if (!access.ok) {
    return { error: { status: access.status, json: access.json } };
  }
  return { user };
}

function generateRoundId() {
  return `AVI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Same long-tail distribution as the client's local fallback, so a round
 * generated here "feels" like the rest of the Aviator round history. */
function generateCrashPoint(minPoint = 1) {
  const instantCrashChance = 0.03;
  const houseEdge = 0.03;
  for (let i = 0; i < 50; i++) {
    const r = Math.random();
    let point;
    if (r < instantCrashChance) point = 1.0;
    else {
      const raw = (1 - houseEdge) / (1 - r);
      point = Math.round(Math.min(Math.max(raw, 1.01), 1000) * 100) / 100;
    }
    if (point >= minPoint) return point;
  }
  return Math.max(minPoint, 2);
}

async function getCurrentResult() {
  try {
    const now = new Date();

    let currentRound = await AviatorRound.findOne({
      expiresAt: { $gt: now },
      isUsed: false,
    }).sort({ createdAt: -1 });

    if (!currentRound) {
      const crashPoint = generateCrashPoint();
      const roundId = generateRoundId();
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

      currentRound = new AviatorRound({
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
    console.error("Error fetching aviator result:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch aviator result",
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
        json: { success: false, error: "roundId is required" },
      };
    }

    const round = await AviatorRound.findOneAndUpdate(
      { roundId, isUsed: false },
      { isUsed: true },
      { new: true }
    );

    if (!round) {
      return {
        status: 404,
        json: { success: false, error: "Round not found or already used" },
      };
    }

    return {
      status: 200,
      json: { success: true, message: "Round marked as used" },
    };
  } catch (error) {
    console.error("Error marking aviator round as used:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to mark aviator round as used",
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

    const access = await checkAviatorAccess(userId);
    if (access.error) return access.error;

    const bet = new AviatorBet({
      userId,
      roundId,
      panelId,
      stake,
      crashPoint: 0,
      status: "active",
      currencyType: currencyType || "GHS",
    });

    await bet.save();

    return {
      status: 201,
      json: { success: true, data: bet, message: "Bet saved successfully" },
    };
  } catch (error) {
    console.error("Error saving aviator bet:", error);
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

/** Voids a still-active bet (the panel cancelled it before its round took
 * off) — no crash-point equivalent exists for this in HeroCrash, since its
 * client doesn't support a pre-flight cancel. */
async function cancelBet(body) {
  try {
    const { userId, roundId, panelId } = body;

    if (!userId || !roundId || !panelId) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Missing required fields: userId, roundId, panelId",
        },
      };
    }

    const bet = await AviatorBet.findOneAndUpdate(
      { userId, roundId, panelId, status: "active" },
      { $set: { status: "cancelled" } },
      { new: true, sort: { createdAt: -1 } }
    );

    if (!bet) {
      return {
        status: 404,
        json: { success: false, error: "Active bet not found" },
      };
    }

    return {
      status: 200,
      json: { success: true, data: bet, message: "Bet cancelled" },
    };
  } catch (error) {
    console.error("Error cancelling aviator bet:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to cancel bet",
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

    const access = await checkAviatorAccess(userId);
    if (access.error) return access.error;

    const bet = await AviatorBet.findOne({
      userId,
      roundId,
      panelId,
      status: "active",
    });

    if (!bet) {
      return {
        status: 404,
        json: { success: false, error: "Active bet not found" },
      };
    }

    const winAmount = bet.stake * cashoutMultiplier;

    bet.cashoutMultiplier = cashoutMultiplier;
    bet.winAmount = winAmount;
    bet.status = "cashed_out";

    await bet.save();

    return {
      status: 200,
      json: { success: true, data: bet, message: "Cashout recorded successfully" },
    };
  } catch (error) {
    console.error("Error recording aviator cashout:", error);
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
        json: { success: false, error: "Missing required fields: roundId, crashPoint" },
      };
    }

    const result = await AviatorBet.updateMany(
      { roundId, status: "active" },
      { $set: { crashPoint, status: "crashed", winAmount: 0 } }
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
    console.error("Error updating aviator bets after crash:", error);
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
      const access = await checkAviatorAccess(userId);
      if (access.error) return access.error;

      filterQuery.userId = userId;
    }

    if (filter === "top-wins") {
      filterQuery.status = "cashed_out";
      filterQuery.winAmount = { $gt: 0 };
    }

    let bets = await AviatorBet.find(filterQuery)
      .populate("userId", "name phoneNumber")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    if (filter === "top-wins") {
      bets = [...bets].sort((a, b) => b.winAmount - a.winAmount);
    }

    return {
      status: 200,
      json: { success: true, data: bets, count: bets.length },
    };
  } catch (error) {
    console.error("Error fetching aviator bet history:", error);
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
  cancelBet,
  cashout,
  applyCrash,
  betHistory,
};

const SpinBottle = require("../../models/SpinBottle");
const SpinBottleBet = require("../../models/SpinBottleBet");

function generateRoundId() {
  return `SPIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateResult() {
  const random = Math.random();
  return random < 0.5 ? "up" : "down";
}

function generateBetCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

async function getCurrentResult() {
  try {
    const now = new Date();
    let currentResult = await SpinBottle.findOne({
      expiresAt: { $gt: now },
      isUsed: false,
    }).sort({ createdAt: -1 });

    if (!currentResult) {
      const result = generateResult();
      const roundId = generateRoundId();
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

      currentResult = new SpinBottle({
        result,
        roundId,
        expiresAt,
        isUsed: false,
      });

      await currentResult.save();
    }

    return {
      status: 200,
      json: {
        success: true,
        data: {
          result: currentResult.result,
          roundId: currentResult.roundId,
          expiresAt: currentResult.expiresAt,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching spin bottle result:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch spin bottle result",
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

    const result = await SpinBottle.findOneAndUpdate(
      { roundId, isUsed: false },
      { isUsed: true },
      { new: true }
    );

    if (!result) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Result not found or already used",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Result marked as used",
      },
    };
  } catch (error) {
    console.error("Error marking result as used:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to mark result as used",
        message: error.message,
      },
    };
  }
}

async function placeBet(body) {
  try {
    const {
      userId,
      roundId,
      betDirection,
      stake,
      result,
      winAmount,
      currencyType,
    } = body;

    if (
      !userId ||
      !roundId ||
      !betDirection ||
      stake === undefined ||
      !result
    ) {
      return {
        status: 400,
        json: {
          success: false,
          error:
            "Missing required fields: userId, roundId, betDirection, stake, result",
        },
      };
    }

    const status = betDirection === result ? "won" : "lost";

    let betCode;
    let isUnique = false;
    while (!isUnique) {
      betCode = generateBetCode();
      const existingBet = await SpinBottleBet.findOne({ betCode });
      if (!existingBet) {
        isUnique = true;
      }
    }

    const bet = new SpinBottleBet({
      userId,
      roundId,
      betDirection,
      stake,
      result,
      status,
      winAmount: winAmount || (status === "won" ? stake * 2 : 0),
      currencyType: currencyType || "NGN",
      betCode,
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
    console.error("Error saving bet:", error);
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

async function betHistory(query) {
  try {
    const { userId } = query;

    if (!userId) {
      return {
        status: 400,
        json: {
          success: false,
          error: "userId is required",
        },
      };
    }

    const bets = await SpinBottleBet.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100);

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
  betHistory,
};

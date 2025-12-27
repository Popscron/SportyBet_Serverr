const express = require("express");
const router = express.Router();
const SpinBottle = require("../models/SpinBottle");
const SpinBottleBet = require("../models/SpinBottleBet");

// Generate a unique round ID
const generateRoundId = () => {
  return `SPIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Generate result: only "up" or "down"
const generateResult = () => {
  const random = Math.random();
  // 50% chance for each; adjust weights here if you want a bias
  return random < 0.5 ? "up" : "down";
};

// Generate a unique 5-digit bet code
const generateBetCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

// GET /api/spin-bottle/result - Get the upcoming result
router.get("/spin-bottle/result", async (req, res) => {
  try {
    // Find the current active (unused and not expired) result
    const now = new Date();
    let currentResult = await SpinBottle.findOne({
      expiresAt: { $gt: now },
      isUsed: false,
    }).sort({ createdAt: -1 });

    // If no active result exists, create a new one
    if (!currentResult) {
      const result = generateResult();
      const roundId = generateRoundId();
      // Result expires after 5 minutes
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

      currentResult = new SpinBottle({
        result,
        roundId,
        expiresAt,
        isUsed: false,
      });

      await currentResult.save();
    }

    res.status(200).json({
      success: true,
      data: {
        result: currentResult.result,
        roundId: currentResult.roundId,
        expiresAt: currentResult.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error fetching spin bottle result:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch spin bottle result",
      message: error.message,
    });
  }
});

// POST /api/spin-bottle/mark-used - Mark a result as used (called after spin)
router.post("/spin-bottle/mark-used", async (req, res) => {
  try {
    const { roundId } = req.body;

    if (!roundId) {
      return res.status(400).json({
        success: false,
        error: "roundId is required",
      });
    }

    const result = await SpinBottle.findOneAndUpdate(
      { roundId, isUsed: false },
      { isUsed: true },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Result not found or already used",
      });
    }

    res.status(200).json({
      success: true,
      message: "Result marked as used",
    });
  } catch (error) {
    console.error("Error marking result as used:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark result as used",
      message: error.message,
    });
  }
});

// POST /api/spin-bottle/bet - Save a bet
router.post("/spin-bottle/bet", async (req, res) => {
  try {
    const { userId, roundId, betDirection, stake, result, winAmount, currencyType } = req.body;

    // Validate required fields
    if (!userId || !roundId || !betDirection || stake === undefined || !result) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, roundId, betDirection, stake, result",
      });
    }

    // Determine status
    const status = betDirection === result ? "won" : "lost";

    // Generate unique 5-digit bet code
    let betCode;
    let isUnique = false;
    while (!isUnique) {
      betCode = generateBetCode();
      const existingBet = await SpinBottleBet.findOne({ betCode });
      if (!existingBet) {
        isUnique = true;
      }
    }

    // Create bet record
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

    res.status(201).json({
      success: true,
      data: bet,
      message: "Bet saved successfully",
    });
  } catch (error) {
    console.error("Error saving bet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save bet",
      message: error.message,
    });
  }
});

// GET /api/spin-bottle/bet-history - Get bet history for a user
router.get("/spin-bottle/bet-history", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Fetch bets for the user, sorted by most recent first
    const bets = await SpinBottleBet.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100); // Limit to last 100 bets

    res.status(200).json({
      success: true,
      data: bets,
      count: bets.length,
    });
  } catch (error) {
    console.error("Error fetching bet history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bet history",
      message: error.message,
    });
  }
});

module.exports = router;


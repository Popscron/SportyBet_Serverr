const express = require("express");
const router = express.Router();
const SportyHeroRound = require("../models/SportyHeroRound");

// Generate a unique round ID for Sporty Hero
const generateRoundId = () => {
  return `HERO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Generate a crash multiplier similar to client logic: between 1.00x and 6.00x
const generateCrashPoint = () => {
  const value = Math.random() * 5 + 1; // [1, 6)
  return parseFloat(value.toFixed(2));
};

// GET /api/sporty-hero/result - Get the upcoming crash multiplier
router.get("/sporty-hero/result", async (req, res) => {
  try {
    const now = new Date();

    // Find latest active (unused and not expired) round
    let currentRound = await SportyHeroRound.findOne({
      expiresAt: { $gt: now },
      isUsed: false,
    }).sort({ createdAt: -1 });

    // If no active round exists, create one
    if (!currentRound) {
      const crashPoint = generateCrashPoint();
      const roundId = generateRoundId();
      // Result expires after 5 minutes
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

      currentRound = new SportyHeroRound({
        crashPoint,
        roundId,
        expiresAt,
        isUsed: false,
      });

      await currentRound.save();
    }

    res.status(200).json({
      success: true,
      data: {
        crashPoint: currentRound.crashPoint,
        roundId: currentRound.roundId,
        expiresAt: currentRound.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error fetching sporty hero result:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sporty hero result",
      message: error.message,
    });
  }
});

// POST /api/sporty-hero/mark-used - Mark a round as used after game finishes
router.post("/sporty-hero/mark-used", async (req, res) => {
  try {
    const { roundId } = req.body;

    if (!roundId) {
      return res.status(400).json({
        success: false,
        error: "roundId is required",
      });
    }

    const round = await SportyHeroRound.findOneAndUpdate(
      { roundId, isUsed: false },
      { isUsed: true },
      { new: true }
    );

    if (!round) {
      return res.status(404).json({
        success: false,
        error: "Round not found or already used",
      });
    }

    res.status(200).json({
      success: true,
      message: "Round marked as used",
    });
  } catch (error) {
    console.error("Error marking sporty hero round as used:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark sporty hero round as used",
      message: error.message,
    });
  }
});

module.exports = router;



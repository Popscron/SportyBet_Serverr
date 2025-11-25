const express = require("express");
const router = express.Router();
const SpinBottle = require("../models/SpinBottle");

// Generate a unique round ID
const generateRoundId = () => {
  return `SPIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Generate result: 45% up, 45% down, 10% middle
const generateResult = () => {
  const random = Math.random();
  if (random < 0.45) {
    return "up";
  } else if (random < 0.9) {
    return "down";
  } else {
    return "middle";
  }
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

module.exports = router;


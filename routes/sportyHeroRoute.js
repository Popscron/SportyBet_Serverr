const express = require("express");
const router = express.Router();
const SportyHeroRound = require("../models/SportyHeroRound");
const SportyHeroBet = require("../models/SportyHeroBet");
const User = require("../models/user");

const isPremiumPlusActive = (user) => {
  if (!user) return false;
  const isActive = !user.expiry || new Date(user.expiry) > new Date();
  return isActive && user.subscription === "Premium Plus";
};

const requirePremiumPlusForUserId = async (userId, res) => {
  if (!userId) {
    res.status(400).json({ success: false, error: "userId is required" });
    return null;
  }
  const user = await User.findById(userId).select("subscription expiry role");
  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return null;
  }
  if (user.role === "admin") return user;
  if (!isPremiumPlusActive(user)) {
    res.status(403).json({
      success: false,
      error: "Premium Plus subscription required",
      subscriptionType: user.subscription || "Basic",
    });
    return null;
  }
  return user;
};

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

// POST /api/sporty-hero/bet - Save a bet when user places it
router.post("/sporty-hero/bet", async (req, res) => {
  try {
    const { userId, roundId, panelId, stake, currencyType } = req.body;

    if (!userId || !roundId || !panelId || stake === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, roundId, panelId, stake",
      });
    }

    // Enforce Premium Plus access
    const user = await requirePremiumPlusForUserId(userId, res);
    if (!user) return;

    // Create bet record with status "active"
    const bet = new SportyHeroBet({
      userId,
      roundId,
      panelId,
      stake,
      crashPoint: 0, // Will be updated when round crashes
      status: "active",
      currencyType: currencyType || "NGN",
    });

    await bet.save();

    res.status(201).json({
      success: true,
      data: bet,
      message: "Bet saved successfully",
    });
  } catch (error) {
    console.error("Error saving sporty hero bet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save bet",
      message: error.message,
    });
  }
});

// POST /api/sporty-hero/cashout - Update bet when user cashes out
router.post("/sporty-hero/cashout", async (req, res) => {
  try {
    const { userId, roundId, panelId, cashoutMultiplier } = req.body;

    if (!userId || !roundId || !panelId || cashoutMultiplier === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, roundId, panelId, cashoutMultiplier",
      });
    }

    // Enforce Premium Plus access
    const user = await requirePremiumPlusForUserId(userId, res);
    if (!user) return;

    // Find the active bet for this user, round, and panel
    const bet = await SportyHeroBet.findOne({
      userId,
      roundId,
      panelId,
      status: "active",
    });

    if (!bet) {
      return res.status(404).json({
        success: false,
        error: "Active bet not found",
      });
    }

    // Calculate win amount
    const winAmount = bet.stake * cashoutMultiplier;

    // Update bet
    bet.cashoutMultiplier = cashoutMultiplier;
    bet.winAmount = winAmount;
    bet.status = "cashed_out";

    await bet.save();

    res.status(200).json({
      success: true,
      data: bet,
      message: "Cashout recorded successfully",
    });
  } catch (error) {
    console.error("Error recording cashout:", error);
    res.status(500).json({
      success: false,
      error: "Failed to record cashout",
      message: error.message,
    });
  }
});

// POST /api/sporty-hero/crash - Update all active bets when round crashes
router.post("/sporty-hero/crash", async (req, res) => {
  try {
    const { roundId, crashPoint } = req.body;

    if (!roundId || crashPoint === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: roundId, crashPoint",
      });
    }

    // Update all active bets for this round to "crashed" status
    const result = await SportyHeroBet.updateMany(
      { roundId, status: "active" },
      {
        $set: {
          crashPoint: crashPoint,
          status: "crashed",
          winAmount: 0, // Lost bets get 0 win amount
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Bets updated after crash",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error updating bets after crash:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update bets after crash",
      message: error.message,
    });
  }
});

// GET /api/sporty-hero/bet-history - Get bet history with filters
router.get("/sporty-hero/bet-history", async (req, res) => {
  try {
    const { userId, filter = "all", limit = 100 } = req.query;

    let query = {};

    // Filter by user if provided
    if (userId) {
      // Enforce Premium Plus access when requesting user-specific history
      const user = await requirePremiumPlusForUserId(userId, res);
      if (!user) return;

      query.userId = userId;
    }

    // Apply status filter
    if (filter === "my-bets" && userId) {
      // Already filtered by userId above
    } else if (filter === "top-wins") {
      query.status = "cashed_out";
      query.winAmount = { $gt: 0 };
    }
    // "all" shows everything

    // Fetch bets sorted by most recent first
    const bets = await SportyHeroBet.find(query)
      .populate("userId", "name phoneNumber") // Populate user info
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // For top wins, sort by winAmount descending
    if (filter === "top-wins") {
      bets.sort((a, b) => b.winAmount - a.winAmount);
    }

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



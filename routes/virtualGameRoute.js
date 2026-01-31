const express = require("express");
const router = express.Router();
const VirtualGameBet = require("../models/VirtualGameBet");
const Deposit = require("../models/deposite");
const User = require("../models/user");

// Generate 25-character booking code (must contain lowercase, uppercase, and a number)
const generateBookingCode25 = () => {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const all = lower + upper + digits;

  // Guarantee at least 1 of each requirement, then fill the rest randomly.
  const chars = [
    lower[Math.floor(Math.random() * lower.length)],
    upper[Math.floor(Math.random() * upper.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ];
  while (chars.length < 25) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Shuffle to avoid predictable prefix
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
};

const isValidBookingCode25 = (code) => {
  if (!code) return false;
  const s = String(code).trim();
  if (s.length !== 25) return false;
  if (!/^[A-Za-z0-9]{25}$/.test(s)) return false;
  if (!/[a-z]/.test(s)) return false;
  if (!/[A-Z]/.test(s)) return false;
  if (!/[0-9]/.test(s)) return false;
  return true;
};

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

// POST /api/virtual-game/bet - Save a virtual game bet
router.post("/virtual-game/bet", async (req, res) => {
  try {
    const {
      userId,
      ticketId,
      bookingCode,
      stake,
      totalOdds,
      potentialWin,
      matches,
      betPick,
      market,
      currencyType,
    } = req.body;

    // Enforce Premium Plus access
    const user = await requirePremiumPlusForUserId(userId, res);
    if (!user) return;

    // Validate required fields (bookingCode is generated if missing/invalid)
    if (!userId || !ticketId || stake === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, ticketId, stake",
      });
    }

    // Check if ticketId already exists
    const existingBet = await VirtualGameBet.findOne({ ticketId });
    if (existingBet) {
      return res.status(400).json({
        success: false,
        error: "Bet with this ticket ID already exists",
      });
    }

    // Deduct stake from user balance (if needed)
    // Uncomment if you want to deduct balance when bet is placed
    /*
    const deposit = await Deposit.findOne({ userId });
    if (!deposit || deposit.amount < stake) {
      return res.status(400).json({
        success: false,
        error: "Insufficient balance",
      });
    }
    deposit.amount -= stake;
    await deposit.save();
    */

    const normalizedBookingCode = isValidBookingCode25(bookingCode)
      ? String(bookingCode).trim()
      : generateBookingCode25();

    // Create bet record
    const bet = new VirtualGameBet({
      userId,
      ticketId,
      bookingCode: normalizedBookingCode,
      stake: parseFloat(stake),
      totalOdds: parseFloat(totalOdds) || 1.0,
      potentialWin: parseFloat(potentialWin) || 0,
      matches: matches || [],
      betPick: betPick || "Home",
      market: market || "1X2",
      currencyType: currencyType || "GHS",
      status: "Pending",
    });

    await bet.save();

    res.status(201).json({
      success: true,
      data: bet,
      message: "Virtual game bet saved successfully",
    });
  } catch (error) {
    console.error("Error saving virtual game bet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save bet",
      message: error.message,
    });
  }
});

// GET /api/virtual-game/bets/:userId - Get all virtual game bets for a user
router.get("/virtual-game/bets/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query; // Optional status filter

    // Enforce Premium Plus access
    const user = await requirePremiumPlusForUserId(userId, res);
    if (!user) return;

    let query = { userId };
    if (status && status !== "All") {
      query.status = status;
    }

    const bets = await VirtualGameBet.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .exec();

    res.status(200).json({
      success: true,
      data: bets,
      count: bets.length,
    });
  } catch (error) {
    console.error("Error fetching virtual game bets:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bets",
      message: error.message,
    });
  }
});

// GET /api/virtual-game/bet/:ticketId - Get a specific bet by ticket ID
router.get("/virtual-game/bet/:ticketId", async (req, res) => {
  try {
    const { ticketId } = req.params;

    const bet = await VirtualGameBet.findOne({ ticketId });

    if (!bet) {
      return res.status(404).json({
        success: false,
        error: "Bet not found",
      });
    }

    // Enforce Premium Plus access for the bet owner
    const user = await requirePremiumPlusForUserId(bet.userId, res);
    if (!user) return;

    res.status(200).json({
      success: true,
      data: bet,
    });
  } catch (error) {
    console.error("Error fetching virtual game bet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bet",
      message: error.message,
    });
  }
});

// PUT /api/virtual-game/bet/:ticketId - Update a virtual game bet (e.g., after game result)
router.put("/virtual-game/bet/:ticketId", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const {
      scoreA,
      scoreB,
      halfTimeScoreA,
      halfTimeScoreB,
      totalReturn,
      status,
      matchHome,
      matchAway,
      market,
      outcome,
    } = req.body;

    const bet = await VirtualGameBet.findOne({ ticketId });

    if (!bet) {
      return res.status(404).json({
        success: false,
        error: "Bet not found",
      });
    }

    // Enforce Premium Plus access for the bet owner
    const user = await requirePremiumPlusForUserId(bet.userId, res);
    if (!user) return;

    // Update fields
    if (scoreA !== undefined) bet.scoreA = scoreA;
    if (scoreB !== undefined) bet.scoreB = scoreB;
    if (halfTimeScoreA !== undefined) bet.halfTimeScoreA = halfTimeScoreA;
    if (halfTimeScoreB !== undefined) bet.halfTimeScoreB = halfTimeScoreB;
    if (totalReturn !== undefined) bet.totalReturn = parseFloat(totalReturn);
    if (status) bet.status = status;
    if (matchHome) bet.matchHome = matchHome;
    if (matchAway) bet.matchAway = matchAway;
    if (market) bet.market = market;
    if (outcome !== undefined) bet.outcome = String(outcome || "");

    bet.updatedAt = Date.now();
    await bet.save();

    // If bet is won, add winnings to user balance
    if (status === "Won" && bet.totalReturn > 0) {
      try {
        const deposit = await Deposit.findOne({ userId: bet.userId });
        if (deposit) {
          deposit.amount += bet.totalReturn;
          await deposit.save();
        }
      } catch (balanceError) {
        console.error("Error updating user balance:", balanceError);
        // Don't fail the request if balance update fails
      }
    }

    res.status(200).json({
      success: true,
      data: bet,
      message: "Bet updated successfully",
    });
  } catch (error) {
    console.error("Error updating virtual game bet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update bet",
      message: error.message,
    });
  }
});

// DELETE /api/virtual-game/bet/:ticketId - Delete a virtual game bet
router.delete("/virtual-game/bet/:ticketId", async (req, res) => {
  try {
    const { ticketId } = req.params;

    const existing = await VirtualGameBet.findOne({ ticketId });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Bet not found",
      });
    }

    // Enforce Premium Plus access for the bet owner
    const user = await requirePremiumPlusForUserId(existing.userId, res);
    if (!user) return;

    const bet = await VirtualGameBet.findOneAndDelete({ ticketId });

    if (!bet) {
      return res.status(404).json({
        success: false,
        error: "Bet not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Bet deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting virtual game bet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete bet",
      message: error.message,
    });
  }
});

// GET /api/virtual-game/bets/:userId/status/:status - Get bets by status
router.get("/virtual-game/bets/:userId/status/:status", async (req, res) => {
  try {
    const { userId, status } = req.params;

    // Enforce Premium Plus access
    const user = await requirePremiumPlusForUserId(userId, res);
    if (!user) return;

    const bets = await VirtualGameBet.find({ userId, status })
      .sort({ createdAt: -1 })
      .exec();

    res.status(200).json({
      success: true,
      data: bets,
      count: bets.length,
    });
  } catch (error) {
    console.error("Error fetching bets by status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bets",
      message: error.message,
    });
  }
});

module.exports = router;

// routes/betRoutes.js
const express = require("express");
const router = express.Router();
const BetModel = require("../models/bet");
const BookingModel = require("../models/BookingCode");
const MultBet = require("../models/multibets"); // 🟩 Import your multbet model
const UserBalance = require("../models/UserBalance");


// Helper function to format date
const formatDate = (date) => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  // Always use current time from device
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");

  return `${day}/${month}, ${hours}:${minutes}`;
};
;

router.post("/place", async (req, res) => {
  const { betId, stake, userId } = req.body; // userId is the logged-in user's ID

  if (!betId || !stake || stake <= 0 || !userId) {
    return res.status(400).json({ message: "Invalid input" });
  }

  try {
    let bet = await BetModel.findById(betId);

    if (!bet) {
      return res.status(404).json({ message: "Bet not found" });
    }

    let updatedBet;
    let message = "Bet placed successfully. Matches updated.";
    const currentTime = formatDate(new Date()); // ✅ current time

    if (bet.userId.toString() !== userId) {
      // Copy bet to the logged-in user's account
      const newBet = new BetModel({
        userId: userId,
        betCode: bet.betCode,
        date: currentTime, // ✅ store current time
        odd: bet.odd,
        bookingCode: bet.bookingCode,
        percentage: bet.percentage,
        stake: stake,
      });
      await newBet.save();

      const newBetId = newBet._id;

      // Copy matches to the new bet
      const originalMatches = await MultBet.find({ userId: betId });
      const newMatches = originalMatches.map((match) => ({
        ...match.toObject(),
        _id: undefined, // Clear the old _id to create new documents
        userId: newBetId, // userId here refers to betId
        userId1: userId, // userId1 refers to the logged-in user
        status: "Not Started",
      }));

      if (newMatches.length > 0) {
        await MultBet.insertMany(newMatches);
      }

      // Create booking for the new bet
      const newBooking = new BookingModel({ betId: newBetId });
      await newBooking.save();

      updatedBet = newBet;
      message = "Bet copied and placed successfully in your account. Matches added.";
    } else {
      // Update existing bet for the logged-in user
      updatedBet = await BetModel.findByIdAndUpdate(
        betId,
        { 
          stake,
          date: currentTime // ✅ update to current time
        },
        { new: true }
      );

      // Update status of matches
      await MultBet.updateMany(
        { userId: betId },
        { $set: { status: "Not Started" } }
      );

      // Create booking if it doesn't exist
      const existingBooking = await BookingModel.findOne({ betId });
      if (!existingBooking) {
        const newBooking = new BookingModel({ betId });
        await newBooking.save();
      }
    }

    res.status(200).json({
      message,
      bet: updatedBet,
    });
  } catch (err) {
    console.error("Error placing bet:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// New endpoint to place bet from collapsed modal (create new bet with matches)
router.post("/place-from-collapsed", async (req, res) => {
  const { userId, stake, matches, totalOdd, bookingCode } = req.body;

  if (!userId || !stake || stake <= 0) {
    return res.status(400).json({ message: "Invalid input: userId and stake are required" });
  }

  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return res.status(400).json({ message: "Matches array is required" });
  }

  try {
    // Check and deduct balance
    const userBalance = await UserBalance.findOne({ userId });
    if (!userBalance || userBalance.amount < stake) {
      return res.status(400).json({ 
        message: "Insufficient balance",
        balance: userBalance?.amount || 0 
      });
    }

    // Deduct stake from balance
    userBalance.amount -= stake;
    await userBalance.save();

    // Generate betCode and bookingCode if not provided
    const generateCode = (length = 6) => {
      const chars = '0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const betCode = generateCode(6);
    const finalBookingCode = bookingCode || generateCode(6);
    const currentTime = formatDate(new Date());

    // Calculate total odd from matches if not provided
    const calculatedOdd = totalOdd || matches.reduce((acc, match) => {
      return acc * parseFloat(match.odd || 1);
    }, 1).toFixed(2);

    // Create new bet
    const newBet = new BetModel({
      userId: userId,
      betCode: betCode,
      date: currentTime,
      odd: calculatedOdd.toString(),
      bookingCode: finalBookingCode,
      stake: stake,
      percentage: 10, // Default percentage
    });
    const savedBet = await newBet.save();

    // Create matches with status "Not Started"
    const matchesToInsert = matches.map((match) => {
      // Handle both formats: stored matches (team) and API format (teams)
      const teamsValue = match.team || match.teams || "N/A";
      // Handle market type: stored matches use 'type' for market, API uses 'market' or 'marketType'
      const marketValue = match.marketType || match.market || match.type || "N/A";
      // Handle sport type: stored matches use 'sportType', API uses 'type' for sport
      const sportTypeValue = match.sportType || "Football";
      
      return {
        userId: savedBet._id, // Reference to bet _id
        userId1: userId, // Reference to user _id
        gameId: match.gameId || null,
       dateTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        teams: teamsValue,
        ftScore: match.ftScore || "N/A",
        pick: match.pick || "N/A",
        market: marketValue,
        outcome: match.pick || match.outcome || "N/A",
        odd: (match.odd || 1.0).toString(),
        status: "Not Started", // Set status as "Not Started"
        type: sportTypeValue,
        chatNumber: Math.floor(Math.random() * 100) + 1,
      };
    });

    if (matchesToInsert.length > 0) {
      await MultBet.insertMany(matchesToInsert);
    }

    // Create booking for the new bet
    const newBooking = new BookingModel({ betId: savedBet._id });
    await newBooking.save();

    // Create cashout entry
    const cashout = require("../models/cashOut");
    const cashData = {
      betId: savedBet._id,
      amount: 0,
      cashoutStatus: "cashout"
    };
    await cashout.create(cashData);

    res.status(200).json({
      message: "Bet placed successfully from collapsed modal",
      bet: savedBet,
      balance: userBalance.amount,
    });
  } catch (err) {
    console.error("Error placing bet from collapsed modal:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});


module.exports = router;

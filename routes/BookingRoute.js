// routes/betRoutes.js
const express = require("express");
const router = express.Router();
const BetModel = require("../models/bet");
const BookingModel = require("../models/BookingCode");
const MultBet = require("../models/multibets"); // 🟩 Import your multbet model
const UserBalance = require("../models/UserBalance");


// Helper function to format date
// IMPORTANT: Always uses SERVER time, not device time
const formatDate = (date) => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  // Use SERVER time (the date parameter passed in)
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${day}/${month}, ${hours}:${minutes}`;
};
;

router.post("/place", async (req, res) => {
  const { betId, stake, userId } = req.body; // userId is the logged-in user's ID

  if (!betId || !stake || stake <= 0 || !userId) {
    return res.status(400).json({ message: "Invalid input" });
  }

  try {
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
    let bet = await BetModel.findById(betId);

    if (!bet) {
      return res.status(404).json({ message: "Bet not found" });
    }

    let updatedBet;
    let message = "Bet placed successfully. Matches updated.";
    const currentTime = formatDate(new Date()); // ✅ current time

    if (bet.userId.toString() !== userId) {
      // Copy bet to the logged-in user's account
      // Explicitly set timestamp to server time
      const serverTimestamp = new Date();
      const newBet = new BetModel({
        userId: userId,
        betCode: bet.betCode,
        date: currentTime, // ✅ store current server time
        odd: bet.odd,
        bookingCode: bet.bookingCode,
        percentage: bet.percentage,
        stake: stake,
        timestamp: serverTimestamp, // Explicitly set server timestamp
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
      // Explicitly set timestamp to server time
      const serverTimestamp = new Date();
      updatedBet = await BetModel.findByIdAndUpdate(
        betId,
        { 
          stake,
          date: currentTime, // ✅ update to current server time
          timestamp: serverTimestamp, // Update timestamp to current server time
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

const formatOneDayAgo = () => {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const day = String(oneDayAgo.getDate()).padStart(2, '0');
  const month = String(oneDayAgo.getMonth() + 1).padStart(2, '0');
  const hours = String(oneDayAgo.getHours()).padStart(2, '0');
  const minutes = String(oneDayAgo.getMinutes()).padStart(2, '0');

  return `${day}/${month} ${hours}:${minutes}`;
};

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

    // Generate random code
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

    // Calculate total odd if not provided
    const calculatedOdd = totalOdd || matches.reduce((acc, match) => {
      return acc * parseFloat(match.odd || 1);
    }, 1).toFixed(2);

    // Create new bet
    // Explicitly set timestamp to server time to ensure consistency
    const serverTimestamp = new Date();
    const newBet = new BetModel({
      userId,
      betCode,
      date: currentTime,
      odd: calculatedOdd.toString(),
      bookingCode: finalBookingCode,
      stake,
      percentage: 10, // Default percentage
      timestamp: serverTimestamp, // Explicitly set server timestamp
    });
    const savedBet = await newBet.save();

    // Generate "1 day ago" datetime
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Create matches
    const matchesToInsert = matches.map((match) => {
      const teamsValue = match.team || match.teams || "N/A";
      const marketValue = match.marketType || match.market || match.type || "N/A";
      const sportTypeValue = match.sportType || "Football";

      return {
        userId: savedBet._id, // Reference to bet
        userId1: userId, // Reference to user
        gameId: match.gameId || null,
        // ✅ store datetime 1 day ago
        dateTime: formatOneDayAgo(),
        teams: teamsValue,
        ftScore: match.ftScore || "N/A",
        pick: match.pick || "N/A",
        market: marketValue,
        outcome: match.pick || match.outcome || "N/A",
        odd: (match.odd || 1.0).toString(),
        status: "Not Started",
        type: sportTypeValue,
        chatNumber: Math.floor(Math.random() * 100) + 1,
      };
    });

    if (matchesToInsert.length > 0) {
      await MultBet.insertMany(matchesToInsert);
    }

    // Create booking
    const newBooking = new BookingModel({ betId: savedBet._id });
    await newBooking.save();

    // Create cashout entry
    const cashout = require("../models/cashOut");
    await cashout.create({
      betId: savedBet._id,
      amount: 0,
      cashoutStatus: "cashout",
    });

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

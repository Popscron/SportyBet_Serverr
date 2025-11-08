const express = require("express");
const router = express.Router();
const Bet = require("../models/bet");
const Deposit =  require("../models/UserBalance")
const Match = require("../models/multibets")
const mongoose = require("mongoose");
const VerifyCode = require("../models/verifycode");
// Fetch Bets for Logged-in User

router.get("/bets", async (req, res) => {
  try {
    const bets = await Bet.find(); // Fetch all bets from DB
    res.status(200).json(bets);
  } catch (error) {
    console.error("Error fetching all bets:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

router.get("/bets/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const bets = await Bet.find({ userId }); // Fetch bets for specific user
    res.json(bets);
  } catch (error) {
    res.status(500).json({ error: "Error fetching bets" });
  }
});

const generateBookingCode = (length = 6) => {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Add a Bet
router.post("/bets", async (req, res) => {
  try {
    const { userId, date,betCode, stake, odd } = req.body;

    // Validate required fields
    if (!userId || !date  || !betCode || !stake) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (isNaN(stake) || stake <= 0) {
      return res.status(400).json({ error: "Invalid stake value" });
    }

    const deposit = await Deposit.findOne({ userId });

    if (!deposit || deposit.amount < stake) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    deposit.amount -= stake;
    await deposit.save();

    // Generate unique booking code
    const bookingCode = generateBookingCode();

    const newBet = new Bet({ userId, date, betCode, stake, odd, bookingCode });
    const savedBet = await newBet.save();

    res.status(201).json(savedBet);
  } catch (error) {
    console.error("Error adding bet:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});


router.post("/bets1", async (req, res) => {
  try {
    const { userId, date, stake, odd, bookingCode} = req.body;

    // Validate required fields
    if (!userId || !date || !bookingCode || !stake) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Generate unique booking code
    const betCode = generateBookingCode(6)

    const newBet = new Bet({ userId, date, betCode, stake, odd, bookingCode });
    const savedBet = await newBet.save();

    res.status(201).json(savedBet);
  } catch (error) {
    console.error("Error adding bet:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});


router.put("/bets/:betId", async (req, res) => {
  try {
    const { betId } = req.params;
    const { odd } = req.body;

    // Validate the odd value
    if (!odd || isNaN(odd) || odd <= 0) {
      return res.status(400).json({ error: "Invalid odd value" });
    }

    // Find and update the bet
    const updatedBet = await Bet.findByIdAndUpdate(
      betId,
      { $set: { odd } },
      { new: true }
    );

    if (!updatedBet) {
      return res.status(404).json({ error: "Bet not found" });
    }

    await VerifyCode.deleteOne({ betId });

    res.json(updatedBet);
  } catch (error) {
    console.error("Error updating bet odd:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

router.put("/ticketId/:betId", async (req, res) => {
  try {
    const { betId } = req.params;
    const { betCode, date, stake, percentage } = req.body;

    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(betId)) {
      return res.status(400).json({ error: "Invalid betId" });
    }

    const bet = await Bet.findById(betId);
    if (!bet) {
      return res.status(404).json({ error: "Bet not found" });
    }

    const updateFields = {};

    // Handle betCode update
    if (betCode !== undefined) {
      if (typeof betCode !== "string" || betCode.trim() === "") {
        return res.status(400).json({ error: "Invalid betCode value" });
      }
      updateFields.betCode = betCode.trim();
    }

    // Handle date update
    if (date !== undefined) {
      if (typeof date !== "string" || !/^\d{2}\/\d{2} \d{2}:\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Invalid date format. Expected DD/MM HH:mm" });
      }
      updateFields.date = date;
    }

    // Handle stake update
    if (stake !== undefined) {
      const newStake = parseFloat(stake);
      if (isNaN(newStake) || newStake <= 0) {
        return res.status(400).json({ error: "Invalid stake value" });
      }

      const deposit = await Deposit.findOne({ userId: bet.userId });
      if (!deposit) {
        return res.status(400).json({ error: "Deposit record not found for user" });
      }

      const stakeDifference = newStake - bet.stake;

      if (stakeDifference > 0 && deposit.amount < stakeDifference) {
        return res.status(400).json({ error: "Insufficient balance to increase stake" });
      }

      // Adjust deposit based on the stake change
      deposit.amount -= stakeDifference;
      await deposit.save();

      updateFields.stake = newStake;
    }

    if (percentage !== undefined) {
      const newPercentage = parseFloat(percentage);
      if (isNaN(newPercentage) || newPercentage < 0 || newPercentage > 100) {
        return res.status(400).json({ error: "Percentage must be a number between 0 and 100" });
      }
      updateFields.percentage = newPercentage;
    }

    await VerifyCode.deleteOne({ betId });
    // Update the bet
    const updatedBet = await Bet.findByIdAndUpdate(
      betId,
      { $set: updateFields },
      { new: true }
    );

    res.json(updatedBet);
  } catch (error) {
    console.error("Error updating bet:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});




router.put("/bookingcode/:betId", async (req, res) => {
  try {
    const { betId } = req.params;
    const { bookingCode } = req.body;


    // Find and update the bet
    const updatedBet = await Bet.findByIdAndUpdate(
      betId,
      { $set: { bookingCode } },
      { new: true }
    );

    if (!updatedBet) {
      return res.status(404).json({ error: "Bet not found" });
    }
    await VerifyCode.deleteOne({ betId });

    res.json(updatedBet);
  } catch (error) {
    console.error("Error updating bet odd:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

router.delete("/bets/:betId", async (req, res) => {
  try {
    const { betId } = req.params;

    // Find the bet
    const bet = await Bet.findById(betId);
    if (!bet) {
      return res.status(404).json({ error: "Bet not found" });
    }

    // Find the user's deposit and refund the stake
    const deposit = await Deposit.findOne({ userId: bet.userId });
    if (deposit) {
      deposit.amount += bet.stake; // Refund the stake amount
      await deposit.save();
    }

    // Delete related matches
    await Match.deleteMany({ betId });

    // Delete the bet
    await Bet.findByIdAndDelete(betId);
    await VerifyCode.deleteOne({ betId });

    res.json({ message: "Bet and related matches deleted successfully" });
  } catch (error) {
    console.error("Error deleting bet:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

router.delete("/aLLbets/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Find all bets of the user
    const userBets = await Bet.find({ userId });

    if (!userBets.length) {
      return res.status(404).json({ message: "No bets found for this user." });
    }

    // Delete related matches for each bet
    for (const bet of userBets) {
      await Match.deleteMany({ betId: bet._id });
    }

    // Delete all bets of the user
    await Bet.deleteMany({ userId });

    res.json({ message: `All bets and related matches for user ${userId} deleted successfully.` });
  } catch (error) {
    console.error("Error deleting user bets:", error.message);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

router.get("/bets/booking/:bookingCode", async (req, res) => {
  try {
    const { bookingCode } = req.params;

    const bet = await Bet.findOne({
      bookingCode: bookingCode, // exact match
    });

    if (!bet) {
      return res.status(404).json({ message: "No bet found with this booking code" });
    }

    res.status(200).json(bet);
  } catch (error) {
    console.error("Error fetching bet:", error);
    res.status(500).json({ message: "Server error" });
  }
});




module.exports = router;



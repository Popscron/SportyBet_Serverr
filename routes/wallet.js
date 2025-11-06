const express = require("express");
const router = express.Router();
const Deposit = require("../models/Deposit");
const Withdraw = require("../models/Withdraw");
const UserBalance = require("../models/UserBalance");
const moment = require("moment");
const Bet = require("../models/bet");
const Winning = require("../models/winningModel");
const User = require("../models/user");
const NotificationBalance = require("../models/NotificationBalance");

// Twilio setup (Make sure your .env file contains these variables)
// // Or your approved Vonage number or sender ID

// 📥 POST /api/wallet/deposit
router.post("/deposit", async (req, res) => {
  const { userId, amount, currencyType = "GHS" } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ message: "Invalid deposit data" });
  }

  try {
    await Deposit.create({ userId, amount, currencyType });

    const balance = await UserBalance.findOneAndUpdate(
      { userId },
      { $inc: { amount: amount }, $set: { currencyType } },
      { new: true, upsert: true }
    );

    // For virtual (notification) balance: when a user deposits, deduct from currentBalance
    await NotificationBalance.findOneAndUpdate(
      { userId },
      { $inc: { currentBalance: -amount } },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: "Deposit successful", balance });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 💸 POST /api/wallet/withdraw
router.post("/withdraw", async (req, res) => {
  const { userId, amount, method = 'mobile_money', currencyType = "NGN" } = req.body;

  if (!userId || !amount || amount <= 0 || !method) {
    return res.status(400).json({ message: "Invalid withdrawal data" });
  }

  try {
    const userBalance = await UserBalance.findOne({ userId });

    if (!userBalance || userBalance.amount < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Record withdrawal
    await Withdraw.create({ userId, amount, method, currencyType });

    // Update user balances
    userBalance.amount -= amount;
    await userBalance.save();

   // For virtual (notification) balance: when a user withdraws, add back to currentBalance
   const currentBalance = await NotificationBalance.findOne({userId})
  currentBalance.currentBalance + amount 
  await NotificationBalance.save()

    const user = await User.findById(userId);

    res.status(200).json({ message: "Withdrawal successful", balance: userBalance });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// 📊 GET /api/wallet/history/:userId
const parseDateString = (dateStr) => {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JS Date
        let year = parseInt(parts[2], 10);
        if (year < 100) {
            year += (year > (new Date().getFullYear() % 100) + 10) ? 1900 : 2000;
        }
        return new Date(year, month, day);
    }
    return null;
};

router.get("/history/:userId", async (req, res) => {
    const { userId } = req.params;
    const { dateRange, category } = req.query;

    console.log('Received Request:', { userId, dateRange, category });

    let filter = { userId: userId };
    let startDate, endDate;

    // 1. Handle Date Range Filtering
    if (dateRange) {
        if (dateRange.includes('-')) {
            const [startStr, endStr] = dateRange.split('-');
            startDate = parseDateString(startStr);
            endDate = parseDateString(endStr);

            if (startDate && endDate) {
                endDate.setHours(23, 59, 59, 999);
            } else {
                return res.status(400).json({ message: "Invalid dateRange format (DD/MM/YY-DD/MM/YY)." });
            }
        } else if (dateRange.startsWith('Last ')) {
            const numDays = parseInt(dateRange.replace('Last ', '').replace(' days', ''), 10);
            if (!isNaN(numDays)) {
                endDate = moment().endOf('day').toDate();
                startDate = moment().subtract(numDays - 1, 'days').startOf('day').toDate();
            } else {
                return res.status(400).json({ message: "Invalid dateRange format for relative dates." });
            }
        }
        if (startDate && endDate) {
            filter.date = { $gte: startDate, $lte: endDate };
        }
    } else {
        endDate = moment().endOf('day').toDate();
        startDate = moment().subtract(6, 'days').startOf('day').toDate();
        filter.date = { $gte: startDate, $lte: endDate };
    }

    console.log('MongoDB Filter:', filter);

    try {
        let deposits = [];
        let withdrawals = [];
        let bets = [];
        let winnings = [];

        // 2. Handle Category Filtering
        if (!category || category === 'All Categories' || category === 'deposits') {
            deposits = await Deposit.find(filter).lean();
            console.log(`Deposits found: ${deposits.length}`);
            if (deposits.length > 0) console.log('Sample Deposit:', deposits[0]);
        }
        if (!category || category === 'All Categories' || category === 'withdrawals') {
            withdrawals = await Withdraw.find(filter).lean();
            console.log(`Withdrawals found: ${withdrawals.length}`);
            if (withdrawals.length > 0) console.log('Sample Withdrawal:', withdrawals[0]);
        }
        if (!category || category === 'All Categories' || category === 'winnings') {
            winnings = await Winning.find(filter).lean();
            console.log(`Winnings found: ${winnings.length}`);
            if (winnings.length > 0) console.log('Sample Winning:', winnings[0]);
        }
        if (!category || category === 'All Categories' || category === 'bets') {
            // Adjust filter for Bet collection (string-based date in DD/MM or DD/MM, HH:mm)
            const betFilter = { ...filter };
            if (filter.date) {
                // Extract date part only, ignoring time
                betFilter.date = {
                    $gte: moment(filter.date.$gte).format('DD/MM'),
                    $lte: moment(filter.date.$lte).format('DD/MM')
                };
                // Use regex to match DD/MM or DD/MM, HH:mm
                betFilter.date = {
                    $regex: `^(${moment(filter.date.$gte).format('DD/MM')}|${moment(filter.date.$lte).format('DD/MM')}|\\d{2}/\\d{2}(, \\d{2}:\\d{2})?$)`,
                    $options: 'i'
                };
            }
            bets = await Bet.find(betFilter).lean();
            console.log(`Bets found: ${bets.length}`);
            if (bets.length > 0) console.log('Sample Bet:', bets[0]);
        }

        // 3. Combine and Map to a consistent format
        const combinedHistory = [
            ...deposits.map(d => ({
                id: d._id.toString(),
                type: 'Deposits',
                date: d.date,
                amount: d.amount,
                description: d.description || 'Deposit',
                status: d.status || 'Completed'
            })),
            ...withdrawals.map(w => ({
                id: w._id.toString(),
                type: 'Withdrawals',
                date: w.date,
                amount: w.amount * -1,
                description: w.description || 'Withdrawal',
                status: w.status || 'Completed'
            })),
            ...winnings.map(w => ({
                id: w._id.toString(),
                type: 'Winnings',
                date: w.date,
                amount: w.amount,
                description: w.description || 'Winning',
                status: w.status || 'Completed'
            })),
            ...bets.map(b => ({
                id: b._id.toString(),
                type: 'Bets - Real Sport',
                date: b.date,
                amount: b.stake * -1,
                description: b.description || 'Bet',
                status: b.status || 'Completed'
            })),
        ];

        // Sort by date (most recent first)
        combinedHistory.sort((a, b) => {
            // Handle string dates for bets (DD/MM or DD/MM, HH:mm)
            const dateA = typeof a.date === 'string' ? parseStringDate(a.date) : new Date(a.date);
            const dateB = typeof b.date === 'string' ? parseStringDate(b.date) : new Date(b.date);
            return dateB - dateA;
        });

        console.log('Combined History:', combinedHistory);

        res.status(200).json(combinedHistory);
    } catch (error) {
        console.error("Server error fetching history:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Helper to parse DD/MM or DD/MM, HH:mm string dates to Date objects for sorting
const parseStringDate = (dateStr) => {
    if (typeof dateStr !== 'string') return new Date(dateStr);
    // Handle both DD/MM and DD/MM, HH:mm
    const datePart = dateStr.split(', ')[0]; // Get DD/MM part
    const [day, month] = datePart.split('/').map(Number);
    const year = new Date().getFullYear(); // Assume current year
    return new Date(year, month - 1, day);
};

// 📟 GET /api/wallet/balance/:userId
router.get("/deposite/:userId", async (req, res) => {
  try {
    const balance = await UserBalance.findOne({ userId: req.params.userId });

    // if (!balance) return res.status(404).json({ message: "No balance found" });

    res.status(200).json({ balance });
  } catch (error) {
    // res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.put("/update-currency", async (req, res) => {
  const { userId, currencyType } = req.body;

  if (!userId || !currencyType || !["GHS", "NGN"].includes(currencyType)) {
    return res.status(400).json({ message: "Invalid request data" });
  }

  try {
    // Update only the currencyType field
    const deposit = await UserBalance.findOneAndUpdate(
      { userId },
      { currencyType },
      { new: true }
    );

    if (!deposit) {
      return res.status(404).json({ message: "Deposit record not found" });
    }

    res.status(200).json({ message: "Currency updated successfully", deposit });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});


router.delete("/transaction/:transactionId", async (req, res) => {
  const { transactionId } = req.params;

  try {
    let deletedCount = 0;

    // Try to delete from Deposit collection
    const depositResult = await Deposit.deleteOne({ _id: transactionId });
    if (depositResult.deletedCount > 0) {
      deletedCount++;
    }

    // Try to delete from Withdraw collection
    const withdrawResult = await Withdraw.deleteOne({ _id: transactionId });
    if (withdrawResult.deletedCount > 0) {
      deletedCount++;
    }

    // Try to delete from Winning collection
    const winningResult = await Winning.deleteOne({ _id: transactionId });
    if (winningResult.deletedCount > 0) {
      deletedCount++;
    }

    // Try to delete from Bet collection
    const betResult = await Bet.deleteOne({ _id: transactionId });
    if (betResult.deletedCount > 0) {
      deletedCount++;
    }

    if (deletedCount > 0) {
      return res.status(200).json({ message: "Transaction deleted successfully across collections.", deletedCount });
    } else {
      return res.status(404).json({ message: "Transaction not found in any collection." });
    }
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


router.delete("/transactions/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const depositResult = await Deposit.deleteMany({ userId });
    const withdrawResult = await Withdraw.deleteMany({ userId });

    const totalDeleted = depositResult.deletedCount + withdrawResult.deletedCount;

    res.status(200).json({
      message: `Deleted ${totalDeleted} transaction(s) for user ${userId}`,
      depositsDeleted: depositResult.deletedCount,
      withdrawalsDeleted: withdrawResult.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


module.exports = router;

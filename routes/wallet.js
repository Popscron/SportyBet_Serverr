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
const TransactionHistory = require("../models/TransactionHistory");
const { sendSMS } = require("../utils/smsService");

const TYPE_LABELS = {
  Deposit: "Deposits",
  Withdraw: "Withdrawals",
  Winning: "Winnings",
  Bet: "Bets - Real Sport",
};

const CATEGORY_TO_TYPES = {
  "All Categories": null,
  deposits: [TYPE_LABELS.Deposit],
  withdrawals: [TYPE_LABELS.Withdraw],
  winnings: [TYPE_LABELS.Winning],
  bets: [TYPE_LABELS.Bet],
};

const upsertTransactionHistory = async ({
  userId,
  sourceId,
  sourceCollection,
  type,
  amount,
  currencyType,
  status,
  description,
  displayDate,
  eventDate,
  metadata,
}) => {
  if (!userId || !sourceId || !sourceCollection || !type || amount === undefined) {
    return;
  }

  try {
    const existingEntry = await TransactionHistory.findOne({
      sourceCollection,
      sourceId,
    }).select("isDeleted");

    if (existingEntry && existingEntry.isDeleted) {
      return existingEntry;
    }

    await TransactionHistory.findOneAndUpdate(
      { sourceCollection, sourceId },
      {
        userId,
        type,
        amount,
        currencyType,
        status,
        description,
        displayDate: displayDate ?? eventDate ?? new Date(),
        eventDate: eventDate ?? new Date(),
        metadata: metadata || {},
        isDeleted: false,
        deletedAt: null,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    console.error("Failed to record transaction history entry:", error);
  }
};

const syncHistoryForCollection = async ({
  docs,
  sourceCollection,
  typeLabel,
  buildEntry,
}) => {
  if (!Array.isArray(docs) || docs.length === 0) {
    return;
  }

  const sourceIds = docs.map((doc) => doc._id);
  const existingEntries = await TransactionHistory.find({
    sourceCollection,
    sourceId: { $in: sourceIds },
  }).select("sourceId isDeleted");

  const deletedSet = new Set(
    existingEntries
      .filter((entry) => entry.isDeleted)
      .map((entry) => entry.sourceId?.toString())
      .filter(Boolean)
  );

  const operations = [];

  docs.forEach((doc) => {
    const idString = doc._id?.toString();
    if (!idString || deletedSet.has(idString)) {
      return;
    }

    const entryPayload = buildEntry(doc);
    if (!entryPayload) {
      return;
    }

    operations.push({
      updateOne: {
        filter: { sourceCollection, sourceId: doc._id },
        update: {
          $set: {
            ...entryPayload,
            type: typeLabel,
            isDeleted: false,
            deletedAt: null,
          },
        },
        upsert: true,
      },
    });
  });

  if (operations.length > 0) {
    await TransactionHistory.bulkWrite(operations, { ordered: false });
  }
};

const ensureTransactionHistory = async ({ userId, startDate, endDate }) => {
  const dateFilter =
    startDate && endDate ? { $gte: startDate, $lte: endDate } : undefined;

  const buildMetadata = (doc, extra = {}) => ({
    currencyType: doc.currencyType,
    status: doc.status,
    ...extra,
  });

  const depositQuery = { userId };
  if (dateFilter) {
    depositQuery.date = dateFilter;
  }
  const deposits = await Deposit.find(depositQuery).lean();
  await syncHistoryForCollection({
    docs: deposits,
    sourceCollection: "Deposit",
    typeLabel: TYPE_LABELS.Deposit,
    buildEntry: (doc) => ({
      userId: doc.userId,
      amount: doc.amount,
      currencyType: doc.currencyType,
      status: doc.status || "Completed",
      description: "Deposit",
      displayDate: doc.date,
      eventDate: doc.date,
      metadata: buildMetadata(doc),
    }),
  });

  const withdrawQuery = { userId };
  if (dateFilter) {
    withdrawQuery.date = dateFilter;
  }
  const withdrawals = await Withdraw.find(withdrawQuery).lean();
  await syncHistoryForCollection({
    docs: withdrawals,
    sourceCollection: "Withdraw",
    typeLabel: TYPE_LABELS.Withdraw,
    buildEntry: (doc) => ({
      userId: doc.userId,
      amount: doc.amount * -1,
      currencyType: doc.currencyType,
      status: doc.status || "Completed",
      description: doc.method ? `Withdrawal (${doc.method})` : "Withdrawal",
      displayDate: doc.date,
      eventDate: doc.date,
      metadata: buildMetadata(doc, { method: doc.method }),
    }),
  });

  const winningQuery = { userId };
  if (dateFilter) {
    winningQuery.date = dateFilter;
  }
  const winnings = await Winning.find(winningQuery).lean();
  await syncHistoryForCollection({
    docs: winnings,
    sourceCollection: "Winning",
    typeLabel: TYPE_LABELS.Winning,
    buildEntry: (doc) => ({
      userId: doc.userId,
      amount: doc.amount,
      currencyType: doc.currencyType,
      status: doc.status || "Completed",
      description: "Winning",
      displayDate: doc.date,
      eventDate: doc.date,
      metadata: buildMetadata(doc),
    }),
  });

  const betQuery = { userId };
  if (dateFilter) {
    betQuery.timestamp = dateFilter;
  }
  const bets = await Bet.find(betQuery).lean();
  await syncHistoryForCollection({
    docs: bets,
    sourceCollection: "Bet",
    typeLabel: TYPE_LABELS.Bet,
    buildEntry: (doc) => ({
      userId: doc.userId,
      amount: doc.stake * -1,
      currencyType: doc.currencyType,
      status: doc.status || "Completed",
      description: "Bet",
      displayDate: doc.date,
      eventDate: doc.timestamp || new Date(),
      metadata: {
        betCode: doc.betCode,
        odd: doc.odd,
        stake: doc.stake,
        bookingCode: doc.bookingCode,
      },
    }),
  });
};

// Twilio setup (Make sure your .env file contains these variables)
// // Or your approved Vonage number or sender ID

// 📥 POST /api/wallet/deposit
router.post("/deposit", async (req, res) => {
  const { userId, amount, currencyType = "GHS" } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ message: "Invalid deposit data" });
  }

  try {
    const deposit = await Deposit.create({ userId, amount, currencyType });

    const balance = await UserBalance.findOneAndUpdate(
      { userId },
      { $inc: { amount: amount }, $set: { currencyType } },
      { new: true, upsert: true }
    );

    // For virtual (notification) balance: when a user deposits, deduct from currentBalance
//  const numericAmount = Number(amount);
//     if (!userId || Number.isNaN(numericAmount)) {
//       return res.status(400).json({ message: "Invalid userId or amount" });
//   }


//       let balanceDoc = await NotificationBalance.findOne({ userId });
  
//       if (!balanceDoc) {
//         balanceDoc = await NotificationBalance.create({
//           userId,
//           currentBalance: 0,
//         });
//       }
  
//       balanceDoc.currentBalance -= numericAmount;
//       await balanceDoc.save();
    await upsertTransactionHistory({
      userId,
      sourceId: deposit._id,
      sourceCollection: "Deposit",
      type: TYPE_LABELS.Deposit,
      amount,
      currencyType,
      status: deposit.status || "Completed",
      description: "Deposit",
      displayDate: deposit.date,
      eventDate: deposit.date,
      metadata: { currencyType },
    });

    // Send SMS notification for deposit
    try {
      const user = await User.findById(userId);
      if (user && user.notificationPhoneNumber && user.notificationPhoneVerified) {
        const message = `💰 Deposit Successful\nAmount: ${currencyType} ${amount.toFixed(2)}\nNew Balance: ${currencyType} ${balance.amount.toFixed(2)}\n\nThank you for using SportyBet!`;
        
        if (user.notificationType === "third-party") {
          // Check if user has points
          if (user.smsPoints > 0) {
            const smsResult = await sendSMS(user.notificationPhoneNumber, message);
            if (smsResult.success) {
              // Deduct 1 point
              user.smsPoints = Math.max(0, (user.smsPoints || 0) - 1);
              await user.save();
            }
          }
        } else {
          // Inbuilt SMS (free, unlimited)
          await sendSMS(user.notificationPhoneNumber, message);
        }
      }
    } catch (smsError) {
      // Don't fail the deposit if SMS fails
      console.error("Error sending deposit SMS notification:", smsError);
    }

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
    const withdrawal = await Withdraw.create({ userId, amount, method, currencyType });

    // Update user balances
    userBalance.amount -= amount;
    await userBalance.save();

   // For virtual (notification) balance: when a user withdraws, add back to currentBalance
  //  const numericAmount = Number(amount);
  //   if (!userId || Number.isNaN(numericAmount)) {
  //     return res.status(400).json({ message: "Invalid userId or amount" });
  // }


  //     let balanceDoc = await NotificationBalance.findOne({ userId });
  
  //     if (!balanceDoc) {
  //       balanceDoc = await NotificationBalance.create({
  //         userId,
  //         currentBalance: 0,
  //       });
  //     }
  //   balanceDoc.currentBalance += numericAmount;
  //     await balanceDoc.save();
    const user = await User.findById(userId);

    await upsertTransactionHistory({
      userId,
      sourceId: withdrawal._id,
      sourceCollection: "Withdraw",
      type: TYPE_LABELS.Withdraw,
      amount: amount * -1,
      currencyType,
      status: withdrawal.status || "Completed",
      description: `Withdrawal (${method})`,
      displayDate: withdrawal.date,
      eventDate: withdrawal.date,
      metadata: { method, currencyType },
    });

    // Send SMS notification for withdrawal
    try {
      const user = await User.findById(userId);
      if (user && user.notificationPhoneNumber && user.notificationPhoneVerified) {
        // Use the same message format as shown in the app notification
        const message = `Payment received for ${currencyType} ${amount.toFixed(2)} from Inv \nCredit Current Balance: ${currencyType} ${userBalance.amount.toFixed(2)} . Available...`;
        
        if (user.notificationType === "third-party") {
          // Check if user has points
          if (user.smsPoints > 0) {
            const smsResult = await sendSMS(user.notificationPhoneNumber, message);
            if (smsResult.success) {
              // Deduct 1 point
              user.smsPoints = Math.max(0, (user.smsPoints || 0) - 1);
              await user.save();
              console.log(`SMS sent for withdrawal. Remaining points: ${user.smsPoints}`);
            } else {
              console.error("Failed to send SMS:", smsResult.error);
            }
          } else {
            console.log("User has no SMS points. Skipping SMS notification.");
          }
        } else {
          // Inbuilt SMS (free, unlimited)
          await sendSMS(user.notificationPhoneNumber, message);
          console.log("SMS sent via inbuilt service for withdrawal");
        }
      } else {
        console.log("SMS not sent - user phone not verified or not set");
      }
    } catch (smsError) {
      // Don't fail the withdrawal if SMS fails
      console.error("Error sending withdrawal SMS notification:", smsError);
    }

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
    } else {
        endDate = moment().endOf('day').toDate();
        startDate = moment().subtract(6, 'days').startOf('day').toDate();
    }

    try {
        await ensureTransactionHistory({ userId, startDate, endDate });

        const historyFilter = { userId };
        historyFilter.isDeleted = { $ne: true };
        if (startDate && endDate) {
            historyFilter.eventDate = { $gte: startDate, $lte: endDate };
        }

        if (category && CATEGORY_TO_TYPES[category]) {
            historyFilter.type = { $in: CATEGORY_TO_TYPES[category] };
        }

        const historyEntries = await TransactionHistory.find(historyFilter)
            .sort({ eventDate: -1, createdAt: -1 })
            .lean();

        const combinedHistory = historyEntries.map((entry) => ({
            id: entry._id.toString(),
            type: entry.type,
            date: entry.displayDate || entry.eventDate,
            amount: entry.amount,
            description: entry.description || entry.type,
            status: entry.status || "Completed",
        }));

        console.log('Combined History:', combinedHistory);

        res.status(200).json(combinedHistory);
    } catch (error) {
        console.error("Server error fetching history:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

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
    const transaction = await TransactionHistory.findByIdAndUpdate(
      transactionId,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (transaction) {
      return res
        .status(200)
        .json({ message: "Transaction removed from history." });
    } else {
      return res
        .status(404)
        .json({ message: "Transaction history entry not found." });
    }
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


router.delete("/transactions/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await TransactionHistory.updateMany(
      { userId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    res.status(200).json({
      message: `Deleted ${result.modifiedCount} history record(s) for user ${userId}`,
      deleted: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


module.exports = router;

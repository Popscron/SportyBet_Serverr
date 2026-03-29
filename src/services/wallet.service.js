const moment = require("moment");
const Deposit = require("../../models/Deposit");
const Withdraw = require("../../models/Withdraw");
const UserBalance = require("../../models/UserBalance");
const Bet = require("../../models/bet");
const Winning = require("../../models/winningModel");
const User = require("../../models/user");
const NotificationBalance = require("../../models/NotificationBalance");
const TransactionHistory = require("../../models/TransactionHistory");
const { sendSMS } = require("../../utils/smsService");

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

async function upsertTransactionHistory({
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
}) {
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
}

async function syncHistoryForCollection({
  docs,
  sourceCollection,
  typeLabel,
  buildEntry,
}) {
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
}

async function ensureTransactionHistory({ userId, startDate, endDate }) {
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
}

function parseDateString(dateStr) {
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) {
      year += year > (new Date().getFullYear() % 100) + 10 ? 1900 : 2000;
    }
    return new Date(year, month, day);
  }
  return null;
}

async function deposit(body) {
  const { userId, amount, currencyType = "GHS" } = body;

  if (!userId || !amount || amount <= 0) {
    return { status: 400, json: { message: "Invalid deposit data" } };
  }

  try {
    const depositDoc = await Deposit.create({ userId, amount, currencyType });

    const balance = await UserBalance.findOneAndUpdate(
      { userId },
      { $inc: { amount }, $set: { currencyType } },
      { new: true, upsert: true }
    );

    await upsertTransactionHistory({
      userId,
      sourceId: depositDoc._id,
      sourceCollection: "Deposit",
      type: TYPE_LABELS.Deposit,
      amount,
      currencyType,
      status: depositDoc.status || "Completed",
      description: "Deposit",
      displayDate: depositDoc.date,
      eventDate: depositDoc.date,
      metadata: { currencyType },
    });

    return {
      status: 200,
      json: { message: "Deposit successful", balance },
    };
  } catch (error) {
    return { status: 500, json: { message: "Server error", error: error.message } };
  }
}

async function depositSendSms(body) {
  const { userId, amount, currencyType = "GHS" } = body;

  if (!userId || !amount || amount <= 0) {
    return {
      status: 400,
      json: { success: false, message: "Invalid deposit data" },
    };
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    if (!user.notificationPhoneNumber || !user.notificationPhoneVerified) {
      return {
        status: 400,
        json: {
          success: false,
          message: "User phone number not verified",
        },
      };
    }

    const userBalance = await UserBalance.findOne({ userId });
    if (!userBalance) {
      return {
        status: 404,
        json: { success: false, message: "User balance not found" },
      };
    }

    let virtualBalance = 0;
    try {
      const notificationBalance = await NotificationBalance.findOne({ userId });
      virtualBalance = notificationBalance
        ? notificationBalance.currentBalance || 0
        : 0;
    } catch (balanceError) {
      console.error("Error fetching notification balance:", balanceError);
      virtualBalance = 0;
    }

    const randomDigits = Math.floor(
      100000000 + Math.random() * 900000000
    ).toString();
    const transactionId = `727${randomDigits}`;

    const calculatedBalance = parseFloat(amount) - parseFloat(virtualBalance || 0);
    const calculatedBalanceValue = calculatedBalance.toFixed(2);
    const message = `Payment for ${currencyType}${amount.toFixed(
      2
    )} to Debit.Inv2 ..Current Balance: ${currencyType} ${calculatedBalanceValue} Transaction Id: ${transactionId}. Fee charged: ${currencyType}0.00,Tax Charged 0.Download the MoMo App for a Faster & Easier Experience. Click here: https://bit.ly/downloadMyMoMo`;

    if (user.notificationType === "third-party") {
      if (user.smsPoints > 0) {
        const smsResult = await sendSMS(user.notificationPhoneNumber, message);
        if (smsResult.success) {
          user.smsPoints = Math.max(0, (user.smsPoints || 0) - 1);
          await user.save();
          console.log(
            `✅ SMS sent for deposit. Remaining points: ${user.smsPoints}`
          );
          return {
            status: 200,
            json: {
              success: true,
              message: "SMS sent successfully",
              transactionId,
            },
          };
        }
        console.error(
          "❌ Failed to send SMS - points NOT deducted:",
          smsResult.error
        );
        return {
          status: 500,
          json: {
            success: false,
            message: "Failed to send SMS notification. Please try again later.",
            error: smsResult.error,
          },
        };
      }
      console.log("⚠️ User has no SMS points. Skipping SMS notification.");
      return {
        status: 400,
        json: { success: false, message: "User has no SMS points" },
      };
    }
    return {
      status: 400,
      json: {
        success: false,
        message: "User notification type is not third-party",
      },
    };
  } catch (error) {
    console.error("Error sending deposit SMS notification:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Failed to send SMS notification. Please try again later.",
        error: "Internal server error",
      },
    };
  }
}

async function withdraw(body) {
  const {
    userId,
    amount,
    method = "mobile_money",
    currencyType = "NGN",
  } = body;

  if (!userId || !amount || amount <= 0 || !method) {
    return { status: 400, json: { message: "Invalid withdrawal data" } };
  }

  try {
    const userBalance = await UserBalance.findOne({ userId });

    if (!userBalance || userBalance.amount < amount) {
      return { status: 400, json: { message: "Insufficient balance" } };
    }

    const thirtySecondsAgo = new Date(Date.now() - 30000);
    const recentWithdrawal = await Withdraw.findOne({
      userId,
      amount: parseFloat(amount),
      method,
      currencyType,
      date: { $gte: thirtySecondsAgo },
    });

    if (recentWithdrawal) {
      console.log(
        `⚠️ Duplicate withdrawal detected for user ${userId}, amount ${amount}. Returning existing withdrawal.`
      );
      return {
        status: 200,
        json: {
          message: "Withdrawal successful",
          balance: userBalance,
          isDuplicate: true,
        },
      };
    }

    const randomDigits = Math.floor(
      100000000 + Math.random() * 900000000
    ).toString();
    const transactionId = `727${randomDigits}`;

    const withdrawal = await Withdraw.create({
      userId,
      amount,
      method,
      currencyType,
      transactionId,
      smsSent: false,
    });

    userBalance.amount -= amount;
    await userBalance.save();

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

    try {
      const user = await User.findById(userId);
      if (user && user.notificationPhoneNumber && user.notificationPhoneVerified) {
        let virtualBalance = 0;
        try {
          const notificationBalance = await NotificationBalance.findOne({
            userId,
          });
          virtualBalance = notificationBalance
            ? notificationBalance.currentBalance || 0
            : 0;
        } catch (balanceError) {
          console.error("Error fetching notification balance:", balanceError);
          virtualBalance = 0;
        }

        const txId = withdrawal.transactionId;

        if (withdrawal.smsSent) {
          console.log(
            `⚠️ SMS already sent for withdrawal ${withdrawal._id}. Skipping duplicate SMS.`
          );
        } else if (user.notificationType === "third-party") {
          const calculatedBalance =
            parseFloat(amount) + parseFloat(virtualBalance || 0);
          const calculatedBalanceValue = calculatedBalance.toFixed(2);
          const message = `Payment received for ${currencyType} ${amount.toFixed(
            2
          )} from Inv Credit Current Balance: ${currencyType} ${calculatedBalanceValue}. Available Balance: ${currencyType} ${calculatedBalanceValue}. Reference: Inv Credit ,23xxxxxx73,SportyBet from Hubtel. Transaction ID: ${txId}. TRANSACTION FEE: 0.00`;

          if (user.smsPoints > 0) {
            const smsResult = await sendSMS(
              user.notificationPhoneNumber,
              message
            );
            console.log("SMS send result:", smsResult);

            if (smsResult.success) {
              user.smsPoints = Math.max(0, (user.smsPoints || 0) - 1);
              await user.save();

              withdrawal.smsSent = true;
              await withdrawal.save();

              console.log(
                `✅ SMS sent for withdrawal ${withdrawal._id}. Transaction ID: ${txId}. Remaining points: ${user.smsPoints}`
              );
            } else {
              console.error(
                "❌ Failed to send SMS - points NOT deducted:",
                smsResult.error
              );
              console.error("SMS error code:", smsResult.code);
            }
          } else {
            console.log("⚠️ User has no SMS points. Skipping SMS notification.");
          }
        } else {
          console.log("⚠️ Inbuilt SMS disabled - using Real SMS only");
        }
      } else {
        console.log("⚠️ SMS not sent - user phone not verified or not set");
      }
    } catch (smsError) {
      console.error("❌ Error sending withdrawal SMS notification:", smsError);
      console.error("Error stack:", smsError.stack);
    }

    return {
      status: 200,
      json: { message: "Withdrawal successful", balance: userBalance },
    };
  } catch (error) {
    return { status: 500, json: { message: "Server error", error: error.message } };
  }
}

async function getHistory(userId, query) {
  const { dateRange, category } = query;

  console.log("Received Request:", { userId, dateRange, category });

  let startDate;
  let endDate;

  if (dateRange) {
    if (dateRange.includes("-")) {
      const [startStr, endStr] = dateRange.split("-");
      startDate = parseDateString(startStr);
      endDate = parseDateString(endStr);

      if (startDate && endDate) {
        endDate.setHours(23, 59, 59, 999);
      } else {
        return {
          status: 400,
          json: { message: "Invalid dateRange format (DD/MM/YY-DD/MM/YY)." },
        };
      }
    } else if (dateRange.startsWith("Last ")) {
      const numDays = parseInt(
        dateRange.replace("Last ", "").replace(" days", ""),
        10
      );
      if (!isNaN(numDays)) {
        endDate = moment().endOf("day").toDate();
        startDate = moment()
          .subtract(numDays - 1, "days")
          .startOf("day")
          .toDate();
      } else {
        return {
          status: 400,
          json: { message: "Invalid dateRange format for relative dates." },
        };
      }
    }
  } else {
    endDate = moment().endOf("day").toDate();
    startDate = moment().subtract(6, "days").startOf("day").toDate();
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

    console.log("Combined History:", combinedHistory);

    return { status: 200, json: combinedHistory };
  } catch (error) {
    console.error("Server error fetching history:", error);
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

async function getBalance(userId) {
  try {
    const balance = await UserBalance.findOne({ userId });
    return { status: 200, json: { balance } };
  } catch (error) {
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

async function updateCurrency(body) {
  const { userId, currencyType } = body;

  if (!userId || !currencyType || !["GHS", "NGN"].includes(currencyType)) {
    return { status: 400, json: { message: "Invalid request data" } };
  }

  try {
    const deposit = await UserBalance.findOneAndUpdate(
      { userId },
      { currencyType },
      { new: true }
    );

    if (!deposit) {
      return { status: 404, json: { message: "Deposit record not found" } };
    }

    return {
      status: 200,
      json: { message: "Currency updated successfully", deposit },
    };
  } catch (error) {
    return { status: 500, json: { message: "Server error", error } };
  }
}

async function deleteTransaction(transactionId) {
  try {
    const transaction = await TransactionHistory.findByIdAndUpdate(
      transactionId,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (transaction) {
      return {
        status: 200,
        json: { message: "Transaction removed from history." },
      };
    }
    return {
      status: 404,
      json: { message: "Transaction history entry not found." },
    };
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

async function deleteAllUserTransactions(userId) {
  try {
    const result = await TransactionHistory.updateMany(
      { userId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    return {
      status: 200,
      json: {
        message: `Deleted ${result.modifiedCount} history record(s) for user ${userId}`,
        deleted: result.modifiedCount,
      },
    };
  } catch (error) {
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

module.exports = {
  deposit,
  depositSendSms,
  withdraw,
  getHistory,
  getBalance,
  updateCurrency,
  deleteTransaction,
  deleteAllUserTransactions,
};

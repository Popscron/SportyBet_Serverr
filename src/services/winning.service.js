const Winning = require("../../models/winningModel");
const UserBalance = require("../../models/UserBalance");
const TransactionHistory = require("../../models/TransactionHistory");

async function recordWinningHistory({ userId, winning, currencyType }) {
  if (!winning?._id || !userId) {
    return;
  }
  try {
    await TransactionHistory.findOneAndUpdate(
      { sourceCollection: "Winning", sourceId: winning._id },
      {
        userId,
        type: "Winnings",
        amount: winning.amount,
        currencyType,
        status: winning.status || "Completed",
        description: "Winning",
        displayDate: winning.date,
        eventDate: winning.date,
        metadata: { currencyType },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error("Failed to record winning history entry:", error);
  }
}

function getCleanedAmount(val) {
  if (typeof val === "string") {
    const cleaned = val.replace(/,/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
      throw new Error("Invalid amount format");
    }
    return num;
  }
  if (typeof val === "number") {
    return val;
  }
  throw new Error("Amount must be a number or string");
}

async function postWinning(body) {
  const { userId, amount, currencyType = "NGN" } = body;

  if (!userId) {
    return { status: 400, json: { message: "userId is required" } };
  }

  try {
    const cleanedAmount = getCleanedAmount(amount);

    const winning = await Winning.create({
      userId,
      amount: cleanedAmount,
      currencyType,
      date: new Date(),
    });

    const balance = await UserBalance.findOneAndUpdate(
      { userId },
      { $inc: { amount: cleanedAmount }, $set: { currencyType } },
      { new: true, upsert: true }
    );

    await recordWinningHistory({ userId, winning, currencyType });

    return {
      status: 200,
      json: { message: "Winning added successfully", balance },
    };
  } catch (error) {
    console.error("Error processing winning:", error);
    return {
      status: 400,
      json: { message: error.message || "Server error" },
    };
  }
}

module.exports = { postWinning };

const NotificationBalance = require("../../models/NotificationBalance.js");

async function getBalance(userId) {
  try {
    let balanceDoc = await NotificationBalance.findOne({ userId });

    if (!balanceDoc) {
      balanceDoc = await NotificationBalance.create({
        userId,
        currentBalance: 0,
      });
    }

    return { status: 200, json: { currentBalance: balanceDoc.currentBalance } };
  } catch (error) {
    console.error("Balance Fetch Error:", error);
    return { status: 500, json: { message: "Failed to fetch balance" } };
  }
}

async function updateBalance(body) {
  try {
    const { userId, amount, mode } = body;

    const numericAmount = Number(amount);
    if (!userId || Number.isNaN(numericAmount)) {
      return {
        status: 400,
        json: { message: "Invalid userId or amount" },
      };
    }

    let balanceDoc = await NotificationBalance.findOne({ userId });

    if (!balanceDoc) {
      balanceDoc = await NotificationBalance.create({
        userId,
        currentBalance: 0,
      });
    }

    if ((mode || "").toLowerCase() === "set") {
      balanceDoc.currentBalance = numericAmount;
    } else {
      balanceDoc.currentBalance += numericAmount;
    }
    await balanceDoc.save();

    return {
      status: 200,
      json: { currentBalance: balanceDoc.currentBalance },
    };
  } catch (error) {
    console.error("Balance Update Error:", error);
    return { status: 500, json: { message: "Failed to update balance" } };
  }
}

module.exports = { getBalance, updateBalance };

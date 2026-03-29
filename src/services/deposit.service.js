const Deposit = require("../../models/deposite");

async function postDeposit(body) {
  const { userId, amount } = body;

  if (!userId || !amount || amount <= 0) {
    return { status: 400, json: { message: "Invalid deposit data" } };
  }

  try {
    const deposit = await Deposit.findOneAndUpdate(
      { userId },
      { $inc: { amount } },
      { new: true, upsert: true }
    );

    return {
      status: 200,
      json: { message: "Deposit processed successfully", deposit },
    };
  } catch (error) {
    console.error("Deposit error:", error);
    return { status: 500, json: { message: "Server error", error } };
  }
}

async function listByUser(userId) {
  try {
    const deposits = await Deposit.find({ userId }).sort({ date: -1 }).lean();
    return { status: 200, json: deposits };
  } catch (error) {
    console.error("Get deposits error:", error);
    return { status: 500, json: { message: "Server error", error } };
  }
}

async function withdraw(body) {
  const { userId, amount } = body;

  if (!userId || !amount || amount <= 0) {
    return { status: 400, json: { message: "Invalid withdrawal data" } };
  }

  try {
    const deposit = await Deposit.findOne({ userId });

    if (!deposit || deposit.amount < amount) {
      return { status: 400, json: { message: "Insufficient balance" } };
    }

    deposit.amount -= amount;
    await deposit.save();

    return {
      status: 200,
      json: { message: "Withdrawal successful", deposit },
    };
  } catch (error) {
    console.error("Withdrawal error:", error);
    return { status: 500, json: { message: "Server error", error } };
  }
}

async function updateCurrency(body) {
  const { userId, currencyType } = body;

  if (!userId || !currencyType || !["GHS", "NGN"].includes(currencyType)) {
    return { status: 400, json: { message: "Invalid request data" } };
  }

  try {
    const deposit = await Deposit.findOneAndUpdate(
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
    console.error("Currency update error:", error);
    return { status: 500, json: { message: "Server error", error } };
  }
}

module.exports = {
  postDeposit,
  listByUser,
  withdraw,
  updateCurrency,
};

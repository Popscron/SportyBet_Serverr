const CashOutModel = require("../../models/cashOut");

async function upsertByBetId(betId, body) {
  const { cashStatus, amount } = body;

  try {
    let bet = await CashOutModel.findOne({ betId });

    if (bet) {
      bet.cashStatus = cashStatus;
      bet.amount = amount;
      await bet.save();
      return {
        status: 200,
        json: { success: true, message: "Cashout status updated", bet },
      };
    }

    bet = new CashOutModel({ betId, cashStatus, amount });
    await bet.save();
    return {
      status: 200,
      json: { success: true, message: "record added", bet },
    };
  } catch (error) {
    return {
      status: 500,
      json: { success: false, message: "Server error", error },
    };
  }
}

async function getByBetId(betId) {
  try {
    const bet = await CashOutModel.findOne({ betId });
    if (bet) {
      return { status: 200, json: { success: true, bet } };
    }
    return {
      status: 404,
      json: { success: false, message: "No record found" },
    };
  } catch (error) {
    return {
      status: 500,
      json: { success: false, message: "Server error", error },
    };
  }
}

async function listAll() {
  try {
    const bet = await CashOutModel.find();
    if (bet) {
      return { status: 200, json: { success: true, bet } };
    }
    return {
      status: 404,
      json: { success: false, message: "No record found" },
    };
  } catch (error) {
    return {
      status: 500,
      json: { success: false, message: "Server error", error },
    };
  }
}

module.exports = { upsertByBetId, getByBetId, listAll };

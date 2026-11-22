const Bet = require("../../models/bet");
const CashOutModel = require("../../models/cashOut");
const UserBalance = require("../../models/UserBalance");
const Winning = require("../../models/winningModel");
const TransactionHistory = require("../../models/TransactionHistory");

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Stake still in play (full stake until the first cashout). */
function remainingStakeOf(bet) {
  return typeof bet.cashoutRemainingStake === "number" ? bet.cashoutRemainingStake : bet.stake;
}

/**
 * Cash out a bet, fully or partly (real SportyBet "Cashout now").
 *
 * The value comes from the operator's cashout setting for the bet (models/cashOut
 * `amount`, the full-stake value — the stake when none is set), scaled to the
 * stake still in play. The client only sends `fraction` (0–1] of that stake,
 * never an amount.
 */
async function cashoutBet(betId, body = {}) {
  const { userId, currencyType = "NGN" } = body;
  const fraction = Number(body.fraction ?? 1);
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
    return { status: 400, json: { success: false, message: "fraction must be between 0 and 1" } };
  }

  let bet;
  try {
    bet = await Bet.findById(betId);
  } catch (_) {
    return { status: 400, json: { success: false, message: "Invalid bet id" } };
  }
  if (!bet) return { status: 404, json: { success: false, message: "Bet not found" } };
  if (!userId || String(bet.userId) !== String(userId)) {
    return { status: 403, json: { success: false, message: "This bet does not belong to the user" } };
  }

  const remaining = remainingStakeOf(bet);
  if (!(remaining > 0.004)) {
    return { status: 409, json: { success: false, message: "Bet is already fully cashed out" } };
  }

  const setting = await CashOutModel.findOne({ betId: String(bet._id) }).lean();
  if (setting?.cashStatus === "unavailable") {
    return { status: 409, json: { success: false, message: "Cashout is currently unavailable" } };
  }

  const fullValue = setting?.amount > 0 ? setting.amount : bet.stake;
  const available = fullValue * (remaining / bet.stake);
  const full = fraction >= 0.999;
  const amount = round2(full ? available : available * fraction);
  if (!(amount >= 0.01)) {
    return { status: 400, json: { success: false, message: "Cashout amount is too low" } };
  }
  const stakeUsed = full ? remaining : round2(remaining * fraction);
  const newRemaining = full ? 0 : round2(remaining - stakeUsed);
  const now = new Date();

  // Only applies if nobody cashed out in between (same remaining stake as read above).
  const remainingFilter =
    typeof bet.cashoutRemainingStake === "number"
      ? { cashoutRemainingStake: bet.cashoutRemainingStake }
      : { cashoutRemainingStake: { $exists: false } };
  const updated = await Bet.findOneAndUpdate(
    { _id: bet._id, ...remainingFilter },
    {
      $set: { cashoutRemainingStake: newRemaining, lastCashoutAt: now },
      $inc: { totalCashout: amount },
      $push: { cashouts: { amount, stake: stakeUsed, at: now } },
    },
    { new: true }
  );
  if (!updated) {
    return { status: 409, json: { success: false, message: "Bet changed, please try again" } };
  }

  const balance = await UserBalance.findOneAndUpdate(
    { userId: bet.userId },
    { $inc: { amount }, $set: { currencyType } },
    { new: true, upsert: true }
  );

  try {
    const winning = await Winning.create({ userId: bet.userId, amount, currencyType, date: now });
    await TransactionHistory.create({
      userId: bet.userId,
      sourceCollection: "Winning",
      sourceId: winning._id,
      type: "Cashout",
      amount,
      currencyType,
      status: "Completed",
      description: "Cashout",
      displayDate: now,
      eventDate: now,
      metadata: { currencyType, betId: String(bet._id), stake: stakeUsed },
    });
  } catch (error) {
    // Balance is already credited; history is best-effort like winnings.
    console.error("Failed to record cashout history:", error);
  }

  return {
    status: 200,
    json: {
      success: true,
      amount,
      fullCashout: newRemaining === 0,
      bet: updated,
      balance,
    },
  };
}

module.exports = { cashoutBet, remainingStakeOf };

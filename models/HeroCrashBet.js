const mongoose = require("mongoose");

const heroCrashBetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  roundId: {
    type: String,
    required: true,
  },
  panelId: {
    type: String,
    required: true, // "1" or "2" to identify which betting panel
  },
  stake: {
    type: Number,
    required: true,
    min: 0.1,
  },
  crashPoint: {
    type: Number,
    required: true, // The multiplier at which the round crashed
  },
  cashoutMultiplier: {
    type: Number,
    default: null, // If user cashed out, this is the multiplier they cashed out at
  },
  status: {
    type: String,
    enum: ["active", "cashed_out", "crashed"], // active = still flying, cashed_out = won, crashed = lost
    required: true,
    default: "active",
  },
  winAmount: {
    type: Number,
    default: 0, // Amount won (stake * cashoutMultiplier if cashed out, 0 if crashed)
  },
  currencyType: {
    type: String,
    default: "NGN",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for faster queries
heroCrashBetSchema.index({ userId: 1, createdAt: -1 });
heroCrashBetSchema.index({ roundId: 1 });
heroCrashBetSchema.index({ status: 1 });

// Keep registered model name for existing MongoDB collection compatibility
module.exports = mongoose.model("SportyHeroBet", heroCrashBetSchema);


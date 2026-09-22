const mongoose = require("mongoose");

const aviatorBetSchema = new mongoose.Schema({
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
    required: true, // "1" or "2" — Aviator supports two simultaneous bet slots
  },
  stake: {
    type: Number,
    required: true,
    min: 0.1,
  },
  crashPoint: {
    type: Number,
    default: 0, // Filled in once the round crashes
  },
  cashoutMultiplier: {
    type: Number,
    default: null, // If the user cashed out, the multiplier they cashed out at
  },
  status: {
    type: String,
    enum: ["active", "cashed_out", "crashed", "cancelled"],
    required: true,
    default: "active",
  },
  winAmount: {
    type: Number,
    default: 0,
  },
  currencyType: {
    type: String,
    default: "GHS",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

aviatorBetSchema.index({ userId: 1, createdAt: -1 });
aviatorBetSchema.index({ roundId: 1 });
aviatorBetSchema.index({ status: 1 });

module.exports = mongoose.model("AviatorBet", aviatorBetSchema);

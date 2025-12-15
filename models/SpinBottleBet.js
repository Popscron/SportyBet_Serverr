const mongoose = require("mongoose");

const SpinBottleBetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  roundId: {
    type: String,
    required: true,
  },
  betDirection: {
    type: String,
    enum: ["up", "down"],
    required: true,
  },
  stake: {
    type: Number,
    required: true,
    min: 0.5,
  },
  result: {
    type: String,
    enum: ["up", "down"],
    required: true,
  },
  status: {
    type: String,
    enum: ["won", "lost"],
    required: true,
  },
  winAmount: {
    type: Number,
    default: 0,
  },
  currencyType: {
    type: String,
    default: "NGN",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Create indexes for faster queries
SpinBottleBetSchema.index({ userId: 1, createdAt: -1 });
SpinBottleBetSchema.index({ roundId: 1 });

const SpinBottleBet = mongoose.model("SpinBottleBet", SpinBottleBetSchema);

module.exports = SpinBottleBet;


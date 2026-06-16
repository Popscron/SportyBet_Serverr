const mongoose = require("mongoose");

const CardSchema = new mongoose.Schema(
  {
    rank: { type: String, default: null },
    suit: { type: String, required: true },
    color: { type: String, enum: ["RED", "BLACK", "GREEN"], required: true },
  },
  { _id: false }
);

const RedBlackBetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  roundId: {
    type: String,
    required: true,
  },
  turnNumber: {
    type: Number,
    required: true,
    min: 1,
  },
  pick: {
    type: String,
    enum: ["RED", "BLACK"],
    required: true,
  },
  stake: {
    type: Number,
    required: true,
    min: 0.5,
  },
  card: {
    type: CardSchema,
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
  betCode: {
    type: String,
    sparse: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

RedBlackBetSchema.index({ userId: 1, createdAt: -1 });
RedBlackBetSchema.index({ roundId: 1, turnNumber: 1 });

module.exports = mongoose.model("RedBlackBet", RedBlackBetSchema);

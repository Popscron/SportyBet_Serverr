const mongoose = require("mongoose");

const CardSchema = new mongoose.Schema(
  {
    rank: { type: String, default: null },
    suit: { type: String, required: true },
    color: { type: String, enum: ["RED", "BLACK", "GREEN"], required: true },
  },
  { _id: false }
);

const RedBlackRoundSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  roundId: {
    type: String,
    required: true,
    unique: true,
  },
  deck: {
    type: [CardSchema],
    default: [],
  },
  drawnCards: {
    type: [CardSchema],
    default: [],
  },
  turnNumber: {
    type: Number,
    default: 1,
  },
  minBet: {
    type: Number,
    default: 10,
  },
  status: {
    type: String,
    enum: ["active", "ended"],
    default: "active",
  },
  currencyType: {
    type: String,
    default: "NGN",
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

RedBlackRoundSchema.index({ userId: 1, status: 1, expiresAt: -1 });

module.exports = mongoose.model("RedBlackRound", RedBlackRoundSchema);

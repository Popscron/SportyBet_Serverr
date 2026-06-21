const mongoose = require("mongoose");

const CardSchema = new mongoose.Schema(
  {
    rank: { type: String, default: null },
    suit: { type: String, default: "♥" },
    color: { type: String, enum: ["RED", "BLACK", "GREEN"], required: true },
  },
  { _id: false }
);

const RedBlackResultSchema = new mongoose.Schema({
  color: {
    type: String,
    enum: ["RED", "BLACK"],
    required: true,
  },
  card: {
    type: CardSchema,
    required: true,
  },
  roundId: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
});

RedBlackResultSchema.index({ expiresAt: 1, isUsed: 1 });

module.exports = mongoose.model("RedBlackResult", RedBlackResultSchema);

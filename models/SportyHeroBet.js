const mongoose = require("mongoose");

const SportyHeroBetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  roundId: {
    type: String,
    required: true,
    index: true,
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
    index: true,
  },
});

// Create indexes for faster queries
SportyHeroBetSchema.index({ userId: 1, createdAt: -1 });
SportyHeroBetSchema.index({ roundId: 1 });
SportyHeroBetSchema.index({ status: 1 });

const SportyHeroBet = mongoose.model("SportyHeroBet", SportyHeroBetSchema);

module.exports = SportyHeroBet;


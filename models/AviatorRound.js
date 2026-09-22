const mongoose = require("mongoose");

// Stores the upcoming crash multiplier for Aviator so the mobile game and
// website can both see the same result — mirrors SportyHeroRound.
const aviatorRoundSchema = new mongoose.Schema({
  crashPoint: {
    type: Number,
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
    // Auto-delete expired documents
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

// Faster queries for active round lookup
aviatorRoundSchema.index({ expiresAt: 1, isUsed: 1 });

module.exports = mongoose.model("AviatorRound", aviatorRoundSchema);

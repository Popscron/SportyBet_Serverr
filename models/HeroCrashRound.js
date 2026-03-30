const mongoose = require("mongoose");

// Stores upcoming crash multiplier for the crash-hero mini-game so
// the mobile game and website can both see the same result.
const heroCrashRoundSchema = new mongoose.Schema({
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
heroCrashRoundSchema.index({ expiresAt: 1, isUsed: 1 });

// Keep registered model name for existing MongoDB collection compatibility
module.exports = mongoose.model("SportyHeroRound", heroCrashRoundSchema);



const mongoose = require("mongoose");

const SpinBottleSchema = new mongoose.Schema({
  result: {
    type: String,
    enum: ["up", "down", "middle"],
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
    index: { expireAfterSeconds: 0 }, // Auto-delete expired documents
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

// Create index for faster queries
SpinBottleSchema.index({ expiresAt: 1, isUsed: 1 });

const SpinBottle = mongoose.model("SpinBottle", SpinBottleSchema);

module.exports = SpinBottle;


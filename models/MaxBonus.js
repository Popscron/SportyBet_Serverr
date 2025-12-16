const mongoose = require("mongoose");

const MaxBonusSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  bookingCode: {
    type: String,
    required: true,
    trim: true,
  },
  maxBonusPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
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

// Create indexes for faster queries
MaxBonusSchema.index({ userId: 1, bookingCode: 1 }, { unique: true });
MaxBonusSchema.index({ userId: 1 });

// Update the updatedAt field before saving
MaxBonusSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const MaxBonus = mongoose.model("MaxBonus", MaxBonusSchema);

module.exports = MaxBonus;


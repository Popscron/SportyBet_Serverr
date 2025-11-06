const mongoose = require('mongoose');

const manualCardSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  minute: {
    type: Number,
    required: true,
    min: 0
  },
  sport: {
    type: String,
    required: true,
    default: 'Sports'
  },
  duration: {
    type: Number,
    required: true,
    min: 1 // Minimum 1 minute
  },
  timeAgo: {
    type: String,
    required: true
  },
  isManual: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
manualCardSchema.index({ expiresAt: 1, isActive: 1 });
manualCardSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ManualCard', manualCardSchema);


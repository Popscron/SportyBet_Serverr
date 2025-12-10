const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: '1WinUser',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['deposit', 'withdrawal', 'bet', 'win', 'bonus', 'refund', 'adjustment'],
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'GHS',
      enum: ['GHS', 'PKR', 'USD', 'EUR', 'NGN', 'INR'],
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    description: {
      type: String,
    },
    balanceBefore: {
      type: Number,
    },
    balanceAfter: {
      type: Number,
    },
    reference: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('1WinTransaction', transactionSchema);


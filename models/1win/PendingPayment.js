const mongoose = require('mongoose');

const pendingPaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: '1WinUser',
      required: true,
    },
    planType: {
      type: String,
      required: true,
      enum: ['gold', 'diamond', 'platinum'],
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
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      comment: 'Mobile Money number to send payment to',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'expired'],
      default: 'pending',
    },
    expiresAt: {
      type: Date,
      required: true,
      comment: 'Payment request expiration time (e.g., 30 minutes)',
    },
    transactionId: {
      type: String,
      default: null,
      comment: 'Transaction ID from SMS when payment is detected',
    },
    detectedAt: {
      type: Date,
      default: null,
      comment: 'When payment was detected from SMS',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
pendingPaymentSchema.index({ userId: 1, status: 1 });
pendingPaymentSchema.index({ reference: 1 });
pendingPaymentSchema.index({ expiresAt: 1 });

// Check if payment is expired
pendingPaymentSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

module.exports = mongoose.model('1WinPendingPayment', pendingPaymentSchema);


const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: '1WinUser',
      required: true,
    },
    pendingPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: '1WinPendingPayment',
      default: null,
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
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    reference: {
      type: String,
      required: true,
    },
    smsMessage: {
      type: String,
      comment: 'Original SMS message received',
    },
    smsSender: {
      type: String,
      comment: 'Phone number that sent the SMS (AirtelTigo)',
    },
    detectedAmount: {
      type: Number,
      comment: 'Amount extracted from SMS',
    },
    detectedReference: {
      type: String,
      comment: 'Reference extracted from SMS',
    },
    senderPhoneNumber: {
      type: String,
      comment: 'Phone number of person who sent the money',
    },
    processedAt: {
      type: Date,
      default: null,
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
paymentTransactionSchema.index({ userId: 1, status: 1 });
paymentTransactionSchema.index({ reference: 1 });
paymentTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('1WinPaymentTransaction', paymentTransactionSchema);


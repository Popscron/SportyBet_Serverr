const mongoose = require('mongoose');

const spindictTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SpindictUser',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  packageType: {
    type: String,
    enum: ['Gold', 'Platinum', 'Diamond'],
    required: true,
  },
  paymentMethod: {
    type: String,
    required: true,
    default: 'Online',
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
});

// Indexes for better query performance
spindictTransactionSchema.index({ user: 1, createdAt: -1 });
spindictTransactionSchema.index({ status: 1 });
spindictTransactionSchema.index({ packageType: 1 });

module.exports = mongoose.model('SpindictTransaction', spindictTransactionSchema);





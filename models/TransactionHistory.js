const mongoose = require("mongoose");

const transactionHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    sourceCollection: {
      type: String,
      enum: ["Deposit", "Withdraw", "Winning", "Bet"],
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currencyType: {
      type: String,
    },
    status: {
      type: String,
      default: "Completed",
    },
    description: {
      type: String,
    },
    displayDate: {
      type: mongoose.Schema.Types.Mixed,
    },
    eventDate: {
      type: Date,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

transactionHistorySchema.index(
  {
    sourceCollection: 1,
    sourceId: 1,
  },
  {
    unique: true,
    partialFilterExpression: { sourceId: { $exists: true } },
  }
);

module.exports = mongoose.model(
  "TransactionHistory",
  transactionHistorySchema
);


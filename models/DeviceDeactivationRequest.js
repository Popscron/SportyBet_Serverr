const mongoose = require("mongoose");

const deviceDeactivationRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
deviceDeactivationRequestSchema.index({ userId: 1, status: 1 });
deviceDeactivationRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model("DeviceDeactivationRequest", deviceDeactivationRequestSchema);


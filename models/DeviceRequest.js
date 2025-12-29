const mongoose = require("mongoose");

const deviceRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceInfo: {
      deviceId: { type: String, required: true },
      deviceName: { type: String, required: true },
      modelName: { type: String },
      modelId: { type: String },
      deviceType: { type: String, enum: ["mobile", "tablet", "desktop", "unknown"], default: "unknown" },
      platform: { type: String, required: true },
      osVersion: { type: String },
      appVersion: { type: String },
      ipAddress: { type: String },
      location: { type: String },
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
    currentActiveDevices: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
    }],
    subscriptionType: {
      type: String,
      enum: ["Basic", "Premium"],
      default: "Basic",
    },
  },
  { timestamps: true }
);

// Index for efficient queries
deviceRequestSchema.index({ userId: 1, status: 1 });
deviceRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model("DeviceRequest", deviceRequestSchema);



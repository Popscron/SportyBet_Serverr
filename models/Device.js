const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    deviceName: {
      type: String,
      required: true,
    },
    modelName: {
      type: String,
    },
    modelId: {
      type: String, // e.g., "iPhone15,2" for iPhone 14 Pro
    },
    deviceType: {
      type: String,
      enum: ["mobile", "tablet", "desktop", "unknown"],
      default: "unknown",
    },
    platform: {
      type: String,
      required: true, // iOS, Android, Web, etc.
    },
    osVersion: {
      type: String,
    },
    appVersion: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    location: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
    lastLogoutAt: {
      type: Date,
    },
    loginCount: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model("Device", deviceSchema);

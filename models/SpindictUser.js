const mongoose = require("mongoose");

const spindictUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    subscription: {
      type: String,
      default: "Basic",
    },
    expiry: {
      type: Date,
    },
    expiryPeriod: {
      type: String,
    },
    accountStatus: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },
  },
  {
    timestamps: true, // This adds createdAt and updatedAt automatically
  }
);

// Indexes for better query performance
spindictUserSchema.index({ email: 1 });
spindictUserSchema.index({ username: 1 });
spindictUserSchema.index({ mobileNumber: 1 });
spindictUserSchema.index({ role: 1 });

// Prevent duplicate model registration in serverless environments
module.exports = mongoose.models.SpindictUser || mongoose.model("SpindictUser", spindictUserSchema);






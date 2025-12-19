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
      // unique: true already creates an index, so don't add schema.index() for this
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      // unique: true already creates an index, so don't add schema.index() for this
    },
    mobileNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      // unique: true already creates an index, so don't add schema.index() for this
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
// Note: email, username, and mobileNumber already have indexes from unique: true
// Only add index for role since it doesn't have unique constraint
spindictUserSchema.index({ role: 1 });

// Prevent duplicate model registration in serverless environments
module.exports = mongoose.models.SpindictUser || mongoose.model("SpindictUser", spindictUserSchema);






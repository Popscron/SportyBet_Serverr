const mongoose = require("mongoose");

const userProfileStatsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    giftsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    badgeCount: {
      type: Number,
      default: 1,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.UserProfileStats ||
  mongoose.model("UserProfileStats", userProfileStatsSchema);

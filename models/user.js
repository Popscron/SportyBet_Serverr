const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mobileNumber: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },

    loginMethod: {
      type: String,
      enum: ["mobileNumber", "username", "email"],
      default: "mobileNumber", // default login method
    },

    subscription: {
      type: String,
      enum: ["Premium"],
      default: "Premium",
    },
    expiry: { type: Date },
    expiryPeriod: {
      type: String
    },
    accountStatus: {
      type: String,
      enum: ["Active", "Hold", "Deactivated"],
      default: "Active",
    },

    grandAuditLimit: { type: Number, default: 0 },
    token: { type: String },
    role: {
      type: String,
      default: "user",
      enum: ["user", "admin"],
    },
    userIcon: {
      type: String,
      default:
        "https://res.cloudinary.com/dir5lv73s/image/upload/v1742455852/userProfile/3_1_absxgl.png",
    },
    darkMode: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

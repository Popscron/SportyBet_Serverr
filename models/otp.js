const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  mobileNumber: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  userId: { type: String } // Optional: store userId for verification
});

module.exports = mongoose.model("Otp", otpSchema);

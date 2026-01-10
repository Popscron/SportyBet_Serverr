const mongoose = require("mongoose");

const WithdrawSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ["mobile_money", "bank"], required: true },
  status: { type: String, enum: ["pending", "completed"], default: "completed" },
  currencyType: { type: String, enum: ["GHS", "NGN"], default: "NGN" },
  date: { type: Date, default: Date.now },
  transactionId: { type: String, default: null }, // Store transaction ID to prevent duplicate SMS
  smsSent: { type: Boolean, default: false }, // Track if SMS was sent for this withdrawal
});

module.exports = mongoose.model("Withdraw", WithdrawSchema);

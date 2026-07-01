const mongoose = require("mongoose");
const crypto = require("crypto");

const minigenLoginChallengeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  code: { type: String, required: true },
  deviceInfo: { type: Object, default: null },
  consumed: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

minigenLoginChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

function createRequestId() {
  return crypto.randomBytes(16).toString("hex");
}

function createLoginCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = mongoose.model("MinigenLoginChallenge", minigenLoginChallengeSchema);
module.exports.createRequestId = createRequestId;
module.exports.createLoginCode = createLoginCode;

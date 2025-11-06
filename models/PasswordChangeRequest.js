const mongoose = require("mongoose");

const passwordChangeRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    newPasswordHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectedReason: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PasswordChangeRequest", passwordChangeRequestSchema);





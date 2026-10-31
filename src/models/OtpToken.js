const mongoose = require("mongoose");

const otpTokenSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, unique: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastRequestedAt: { type: Date, default: null },
    dailyRequestCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("OtpToken", otpTokenSchema);

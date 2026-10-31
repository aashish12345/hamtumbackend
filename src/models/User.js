const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: "" },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "India" },
    landmark: { type: String, trim: true, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true },
);

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "Guest" },
    alternatePhone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    gender: { type: String, trim: true, default: "" },
    identifier: { type: String, required: true, unique: true, index: true },
    isVerified: { type: Boolean, default: false },
    addresses: [addressSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);

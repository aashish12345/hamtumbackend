const mongoose = require("mongoose");

const ADMIN_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN"
};

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    mobile: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(ADMIN_ROLES),
      default: ADMIN_ROLES.ADMIN
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = {
  Admin: mongoose.model("Admin", adminSchema),
  ADMIN_ROLES
};

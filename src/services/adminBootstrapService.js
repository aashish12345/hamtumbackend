const bcrypt = require("bcryptjs");
const env = require("../config/env");
const { Admin, ADMIN_ROLES } = require("../models/Admin");

async function ensureDefaultSuperAdmin() {
  const email = String(env.superAdminEmail || "").trim().toLowerCase();
  const password = String(env.superAdminPassword || "").trim();
  const name = String(env.superAdminName || "Super Admin").trim();
  const mobile = String(env.superAdminMobile || "").trim();

  if (!email || !password || !mobile) {
    console.warn("Skipping super admin bootstrap: SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD or SUPER_ADMIN_MOBILE is not set.");
    return;
  }

  const existingAdmin = await Admin.findOne({ email });
  if (existingAdmin) {
    const passwordHash = await bcrypt.hash(password, 12);
    existingAdmin.mobile = mobile;
    existingAdmin.passwordHash = passwordHash;
    if (existingAdmin.role !== ADMIN_ROLES.SUPER_ADMIN) {
      existingAdmin.role = ADMIN_ROLES.SUPER_ADMIN;
    }
    await existingAdmin.save();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({
    name,
    email,
    mobile,
    passwordHash,
    role: ADMIN_ROLES.SUPER_ADMIN,
    isActive: true
  });

  console.log(`Created default SUPER_ADMIN: ${email}`);
}

module.exports = {
  ensureDefaultSuperAdmin
};

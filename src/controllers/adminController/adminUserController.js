const bcrypt = require("bcryptjs");
const { Admin, ADMIN_ROLES } = require("../../models/Admin");
const { isPhone } = require("../../utils/validators");

async function createAdmin(req, res) {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const mobile = String(req.body.mobile || "").trim();

  if (!name || !email || !password || !mobile) {
    return res.status(400).json({ message: "name, email, password and mobile are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "password must be at least 8 characters long" });
  }

  if (!isPhone(mobile)) {
    return res.status(400).json({ message: "Enter a valid mobile number" });
  }

  const existingAdmin = await Admin.findOne({ $or: [{ email }, { mobile }] });
  if (existingAdmin) {
    return res.status(409).json({ message: "Admin with this email or mobile already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await Admin.create({
    name,
    email,
    mobile,
    passwordHash,
    role: ADMIN_ROLES.ADMIN,
    isActive: true
  });

  return res.status(201).json({
    message: "Admin created successfully",
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      mobile: admin.mobile,
      role: admin.role
    }
  });
}

module.exports = {
  createAdmin
};

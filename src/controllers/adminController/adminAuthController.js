const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const OtpToken = require("../../models/OtpToken");
const { Admin } = require("../../models/Admin");
const { generateOtpCode, hashOtp, sendOtp } = require("../../services/otpService");

const ADMIN_OTP_COOLDOWN_MS = 120000;

function signAdminToken(admin) {
  return jwt.sign(
    {
      adminId: admin._id,
      role: admin.role,
      tokenType: "admin"
    },
    env.jwtSecret,
    { expiresIn: env.adminJwtExpiresIn }
  );
}

function buildAdminLoginIdentifier(adminId) {
  return `admin-login:${adminId}`;
}

async function issueAdminLoginOtp(admin, enforceCooldown = true) {
  const identifier = buildAdminLoginIdentifier(admin._id);
  const existingOtpToken = await OtpToken.findOne({ identifier });
  const now = new Date();

  if (enforceCooldown && existingOtpToken && existingOtpToken.lastRequestedAt) {
    const elapsedMs = now.getTime() - new Date(existingOtpToken.lastRequestedAt).getTime();
    if (elapsedMs < ADMIN_OTP_COOLDOWN_MS) {
      const error = new Error("Please wait before requesting another OTP.");
      error.statusCode = 429;
      error.retryAfterSeconds = Math.ceil((ADMIN_OTP_COOLDOWN_MS - elapsedMs) / 1000);
      throw error;
    }
  }

  const otp = generateOtpCode(env.otpLength);
  const otpHash = hashOtp(identifier, otp);
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000);

  await OtpToken.findOneAndUpdate(
    { identifier },
    {
      identifier,
      codeHash: otpHash,
      expiresAt,
      attempts: 0,
      lastRequestedAt: now,
      dailyRequestCount: 0
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await sendOtp(admin.mobile, otp);

  const response = {
    message: "OTP sent to registered mobile number",
    otpSentTo: admin.mobile,
    retryAfterSeconds: Math.ceil(ADMIN_OTP_COOLDOWN_MS / 1000)
  };

  if (process.env.NODE_ENV !== "production") {
    response.devOtp = otp;
  }

  return response;
}

async function startAdminLogin(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const admin = await Admin.findOne({ email });
  if (!admin || !admin.isActive) {
    return res.status(401).json({ message: "Invalid admin credentials" });
  }

  const isMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid admin credentials" });
  }

  try {
    const response = await issueAdminLoginOtp(admin, true);
    return res.status(200).json(response);
  } catch (error) {
    if (error.statusCode === 429) {
      return res.status(429).json({
        message: `Please wait ${error.retryAfterSeconds} seconds before requesting another OTP.`,
        retryAfterSeconds: error.retryAfterSeconds
      });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function resendAdminLoginOtp(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ message: "email is required" });
  }

  const admin = await Admin.findOne({ email });
  if (!admin || !admin.isActive) {
    return res.status(401).json({ message: "Invalid admin credentials" });
  }

  const identifier = buildAdminLoginIdentifier(admin._id);
  const existingOtpToken = await OtpToken.findOne({ identifier });
  if (!existingOtpToken) {
    return res.status(400).json({ message: "OTP not requested. Please login again." });
  }

  try {
    const response = await issueAdminLoginOtp(admin, true);
    return res.status(200).json(response);
  } catch (error) {
    if (error.statusCode === 429) {
      return res.status(429).json({
        message: `Please wait ${error.retryAfterSeconds} seconds before requesting another OTP.`,
        retryAfterSeconds: error.retryAfterSeconds
      });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function verifyAdminLoginOtp(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const otp = String(req.body.otp || "").trim();

  if (!email || !otp) {
    return res.status(400).json({ message: "email and otp are required" });
  }

  if (!/^\d{4,8}$/.test(otp)) {
    return res.status(400).json({ message: "Invalid OTP format" });
  }

  const admin = await Admin.findOne({ email });
  if (!admin || !admin.isActive) {
    return res.status(401).json({ message: "Invalid admin credentials" });
  }

  const identifier = buildAdminLoginIdentifier(admin._id);
  const otpToken = await OtpToken.findOne({ identifier });

  if (!otpToken) {
    return res.status(400).json({ message: "OTP not requested. Please login again." });
  }

  if (otpToken.expiresAt.getTime() < Date.now()) {
    await OtpToken.deleteOne({ _id: otpToken._id });
    return res.status(400).json({ message: "OTP expired. Please login again." });
  }

  const otpHash = hashOtp(identifier, otp);
  if (otpHash !== otpToken.codeHash) {
    otpToken.attempts += 1;
    await otpToken.save();
    return res.status(400).json({ message: "Incorrect OTP" });
  }

  await OtpToken.deleteOne({ _id: otpToken._id });

  const token = signAdminToken(admin);
  return res.status(200).json({
    message: "Admin login successful",
    token,
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      mobile: admin.mobile,
      role: admin.role
    }
  });
}

async function getAdminProfile(req, res) {
  return res.status(200).json({
    admin: {
      id: req.admin._id,
      name: req.admin.name,
      email: req.admin.email,
      mobile: req.admin.mobile,
      role: req.admin.role
    }
  });
}

module.exports = {
  startAdminLogin,
  resendAdminLoginOtp,
  verifyAdminLoginOtp,
  getAdminProfile
};

const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const OtpToken = require("../../models/OtpToken");
const User = require("../../models/User");
const { generateOtpCode, hashOtp, sendOtp } = require("../../services/otpService");
const { normalizeIdentifier, isPhone } = require("../../utils/validators");


function signToken(userId) {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

async function requestOtp(req, res) {
  const phone = normalizeIdentifier(req.body.phone);
  if (!isPhone(phone)) {
    return res.status(400).json({
      message: "Enter a valid phone number"
    });
  }

  const now = new Date();
  const otpToken = await OtpToken.findOne({ identifier: phone });
  const otpCooldownMs = 120000;

  if (otpToken && otpToken.lastRequestedAt) {
    const elapsedMs = now.getTime() - new Date(otpToken.lastRequestedAt).getTime();
    if (elapsedMs < otpCooldownMs) {
      return res.status(429).json({
        message: "Please wait 120 seconds before requesting another OTP.",
        retryAfterSeconds: Math.ceil((otpCooldownMs - elapsedMs) / 1000)
      });
    }
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const alreadyRequestedToday = otpToken && otpToken.lastRequestedAt && new Date(otpToken.lastRequestedAt) >= todayStart;
  const dailyRequestCount = alreadyRequestedToday ? Number(otpToken.dailyRequestCount || 0) : 0;

  if (dailyRequestCount >= 3) {
    return res.status(429).json({
      message: "OTP request limit reached for today. Please try again tomorrow.",
      dailyLimitReached: true
    });
  }

  const otp = generateOtpCode(env.otpLength);
  const otpHash = hashOtp(phone, otp);
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000);
  const nextDailyRequestCount = alreadyRequestedToday ? dailyRequestCount + 1 : 1;

  await OtpToken.findOneAndUpdate(
    { identifier: phone },
    {
      identifier: phone,
      codeHash: otpHash,
      expiresAt,
      attempts: 0,
      lastRequestedAt: now,
      dailyRequestCount: nextDailyRequestCount
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await sendOtp(phone, otp);

  const response = { message: "OTP sent successfully" };
  if (process.env.NODE_ENV !== "production") {
    response.devOtp = otp;
  }

  return res.status(200).json(response);
}

async function verifyOtp(req, res) {
  const phone = normalizeIdentifier(req.body.phone || req.body.identifier);
  const otp = String(req.body.otp || "").trim();
  const name = String(req.body.name || "Guest").trim();

  if (!isPhone(phone)) {
    return res.status(400).json({ message: "Invalid phone number" });
  }

  if (!/^\d{4,8}$/.test(otp)) {
    return res.status(400).json({ message: "Invalid OTP format" });
  }

  const otpToken = await OtpToken.findOne({ identifier: phone });
  if (!otpToken) {
    return res.status(400).json({ message: "OTP not requested for this phone number" });
  }

  if (otpToken.expiresAt.getTime() < Date.now()) {
    await OtpToken.deleteOne({ _id: otpToken._id });
    return res.status(400).json({ message: "OTP expired. Request a new one." });
  }

  const otpHash = hashOtp(phone, otp);
  if (otpHash !== otpToken.codeHash) {
    otpToken.attempts += 1;
    await otpToken.save();
    return res.status(400).json({ message: "Incorrect OTP" });
  }

  await OtpToken.deleteOne({ _id: otpToken._id });

  let user = await User.findOne({ identifier: phone });
  if (!user) {
    user = await User.create({
      identifier: phone,
      phone: phone,
      name,
      isVerified: true
    });
  } else {
    user.phone = user.phone || phone;
    user.identifier = user.identifier || phone;
    user.isVerified = true;
    user.name = name || user.name || "Guest";
    await user.save();
  }

  const token = signToken(user._id);

  return res.status(200).json({
    message: "Authentication successful",
    token,
    user: {
      id: user._id,
      name: user.name,
      identifier: user.identifier,
      phone: user.phone || user.identifier,
      alternatePhone: user.alternatePhone || "",
      email: user.email || "",
      gender: user.gender || ""
    }
  });
}

module.exports = {
  requestOtp,
  verifyOtp
};

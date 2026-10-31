const crypto = require("crypto");
const nodemailer = require("nodemailer");
const env = require("../config/env");
const { isEmail } = require("../utils/validators");

function generateOtpCode(length) {
  const max = 10 ** length;
  const code = Math.floor(Math.random() * max).toString().padStart(length, "0");
  return code;
}

function hashOtp(identifier, otp) {
  return crypto.createHash("sha256").update(`${identifier}:${otp}`).digest("hex");
}

async function sendOtp(identifier, otp) {
  if (!isEmail(identifier)) {
    console.log(`[OTP][DEV] Send OTP ${otp} to ${identifier}`);
    return;
  }

  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    console.log(`[OTP][DEV] SMTP not configured. OTP for ${identifier}: ${otp}`);
    return;
  }

  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });

  await transport.sendMail({
    from: env.smtpFrom,
    to: identifier,
    subject: "HamTum OTP Verification Code",
    text: `Your HamTum OTP is ${otp}. It will expire in ${env.otpExpiryMinutes} minutes.`
  });
}

module.exports = {
  generateOtpCode,
  hashOtp,
  sendOtp
};

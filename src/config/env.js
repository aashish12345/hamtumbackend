const dotenv = require("dotenv");

dotenv.config();

const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hamtum",
  jwtSecret: process.env.JWT_SECRET || "development-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 10),
  otpLength: Number(process.env.OTP_LENGTH || 6),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "no-reply@hamtum.com",
  adminJwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "1d",
  superAdminName: process.env.SUPER_ADMIN_NAME || "Super Admin",
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || "aashishtyagi0131@gmail.com",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "HamTumMandi26@2027",
  superAdminMobile: process.env.SUPER_ADMIN_MOBILE || "9315820779",
  awsRegion: process.env.AWS_REGION || "",
  awsS3Bucket: process.env.AWS_S3_BUCKET || "",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
};

module.exports = env;

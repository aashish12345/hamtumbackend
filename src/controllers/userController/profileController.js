const { normalizeIdentifier, isPhone } = require("../../utils/validators");

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name || "Guest",
    phone: user.phone || user.identifier || "",
    alternatePhone: user.alternatePhone || "",
    email: user.email || "",
    gender: user.gender || "",
    identifier: user.identifier || "",
    isVerified: Boolean(user.isVerified)
  };
}

async function getProfile(req, res) {
  return res.status(200).json({
    message: "User profile fetched successfully",
    user: sanitizeUser(req.user)
  });
}

async function updateProfile(req, res) {
  const { name, phone, alternatePhone, email, gender } = req.body || {};
  const nextName = String(name ?? req.user.name ?? "").trim();
  const nextPhone = normalizeIdentifier(phone || req.user.phone || req.user.identifier || "");
  const nextAlternatePhone = String(alternatePhone ?? req.user.alternatePhone ?? "").trim();
  const nextEmail = String(email ?? req.user.email ?? "").trim();
  const nextGender = String(gender ?? req.user.gender ?? "").trim();

  if (!nextName) {
    return res.status(400).json({ message: "Name is required" });
  }

  if (!nextPhone || !isPhone(nextPhone)) {
    return res.status(400).json({ message: "Valid phone number is required" });
  }

  if (nextAlternatePhone && !isPhone(nextAlternatePhone)) {
    return res.status(400).json({ message: "Alternate phone number is invalid" });
  }

  if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  const profileUpdate = {
    name: nextName,
    phone: nextPhone,
    alternatePhone: nextAlternatePhone,
    email: nextEmail,
    gender: nextGender,
    identifier: nextPhone,
    isVerified: true
  };

  Object.assign(req.user, profileUpdate);
  await req.user.save();

  return res.status(200).json({
    message: "Profile updated successfully",
    user: sanitizeUser(req.user)
  });
}

module.exports = {
  getProfile,
  updateProfile
};

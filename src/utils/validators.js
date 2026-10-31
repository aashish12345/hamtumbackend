function normalizeIdentifier(rawIdentifier) {
  if (!rawIdentifier || typeof rawIdentifier !== "string") {
    return "";
  }

  return rawIdentifier.trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}


function isPhone(value) {
  return /^[6-9]\d{9}$/.test(value);
}


function isValidIdentifier(identifier) {
  return isEmail(identifier) || isPhone(identifier);
}

module.exports = {
  normalizeIdentifier,
  isEmail,
  isPhone,
  isValidIdentifier
};

const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { Admin } = require("../models/Admin");

async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Admin authentication required" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.tokenType !== "admin") {
      return res.status(401).json({ message: "Invalid admin token" });
    }

    const admin = await Admin.findById(payload.adminId);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Admin not found or inactive" });
    }

    req.admin = admin;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired admin token" });
  }
}

function requireAdminRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ message: "Insufficient admin permissions" });
    }
    return next();
  };
}

module.exports = {
  adminAuth,
  requireAdminRole
};

const ContactMessage = require("../../models/ContactMessage");

function normalizeText(value) {
  return String(value || "").trim();
}

async function submitContactMessage(req, res) {
  const name = normalizeText(req.body.name);
  const phone = normalizeText(req.body.phone);
  const message = normalizeText(req.body.message);

  if (!name || !phone || !message) {
    return res.status(400).json({ message: "name, phone and message are required" });
  }

  const contactMessage = await ContactMessage.create({
    name,
    phone,
    message
  });

  return res.status(201).json({
    message: "Message sent successfully",
    contactMessage
  });
}

module.exports = {
  submitContactMessage
};

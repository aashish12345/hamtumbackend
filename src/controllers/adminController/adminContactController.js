const ContactMessage = require("../../models/ContactMessage");

async function listContactMessages(req, res) {
  const messages = await ContactMessage.find({}).sort({ createdAt: -1 });
  return res.status(200).json({ messages });
}

module.exports = {
  listContactMessages
};

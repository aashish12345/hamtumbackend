const express = require("express");
const { submitContactMessage } = require("../controllers/userController/contactController");

const router = express.Router();

router.post("/", submitContactMessage);

module.exports = router;

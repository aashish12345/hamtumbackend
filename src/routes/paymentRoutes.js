const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  createCheckoutOrder,
  verifyCheckoutPayment,
} = require("../controllers/userController/paymentController");

const router = express.Router();

router.use(authMiddleware);
router.post("/create-order", createCheckoutOrder);
router.post("/verify", verifyCheckoutPayment);

module.exports = router;

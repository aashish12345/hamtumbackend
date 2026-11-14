const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  getCart,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
} = require("../controllers/userController/cartController");

const router = express.Router();

router.use(authMiddleware);
router.get("/", getCart);
router.post("/items", addCartItem);
router.put("/items/:productId", updateCartItemQuantity);
router.delete("/items/:productId", removeCartItem);

module.exports = router;

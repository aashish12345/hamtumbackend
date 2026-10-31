const express = require("express");
const { getProductById, listProducts } = require("../controllers/userController/productController");

const router = express.Router();

router.get("/", listProducts);
router.get("/:productId", getProductById);

module.exports = router;

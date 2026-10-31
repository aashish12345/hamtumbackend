const express = require("express");
const { getProductById, listProducts, getDashboardData } = require("../controllers/userController/productController");

const router = express.Router();

router.get("/", listProducts);
router.get("/dashboard", getDashboardData);
router.get("/:productId", getProductById);


module.exports = router;

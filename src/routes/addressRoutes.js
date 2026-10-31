const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress
} = require("../controllers/userController/addressController");

const router = express.Router();

router.use(authMiddleware);
router.get("/", listAddresses);
router.post("/", addAddress);
router.put("/:addressId", updateAddress);
router.delete("/:addressId", deleteAddress);

module.exports = router;

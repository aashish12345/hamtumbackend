const express = require("express");
const { adminAuth, requireAdminRole } = require("../middleware/adminAuth");
const { ADMIN_ROLES } = require("../models/Admin");
const upload = require("../middleware/upload");
const {
  createProduct,
  listAdminProducts,
  getAdminProductById,
  updateProduct,
  deleteProduct
} = require("../controllers/adminController/adminController");
const { startAdminLogin, resendAdminLoginOtp, verifyAdminLoginOtp, getAdminProfile } = require("../controllers/adminController/adminAuthController");
const { createAdmin } = require("../controllers/adminController/adminUserController");
const {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  listSubcategories,
  getSubcategoryById,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory
} = require("../controllers/adminController/adminCategoryController");

const router = express.Router();

router.post("/auth/login/start", startAdminLogin);
router.post("/auth/login/resend-otp", resendAdminLoginOtp);
router.post("/auth/login/verify-otp", verifyAdminLoginOtp);
router.get("/auth/me", adminAuth, getAdminProfile);
router.post("/users/admins", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN), createAdmin);
router.get("/categories", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), listCategories);
router.get("/categories/:categoryId", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), getCategoryById);
router.post("/categories", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), createCategory);
router.put("/categories/:categoryId", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), updateCategory);
router.delete("/categories/:categoryId", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), deleteCategory);
router.get("/categories/:categoryId/subcategories", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), listSubcategories);
router.get("/categories/:categoryId/subcategories/:subcategoryId", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), getSubcategoryById);
router.post("/categories/:categoryId/subcategories", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), createSubcategory);
router.put("/categories/:categoryId/subcategories/:subcategoryId", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), updateSubcategory);
router.delete("/categories/:categoryId/subcategories/:subcategoryId", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), deleteSubcategory);

router.post(
  "/products",
  adminAuth,
  requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN),
  upload.fields([
    { name: "image", maxCount: 3 },
    { name: "video", maxCount: 1 }
  ]),
  createProduct
);
router.get("/products", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), listAdminProducts);
router.get("/products/:productId", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), getAdminProductById);
router.put(
  "/products/:productId",
  adminAuth,
  requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN),
  upload.fields([
    { name: "image", maxCount: 3 },
    { name: "video", maxCount: 1 }
  ]),
  updateProduct
);
router.delete("/products/:productId", adminAuth, requireAdminRole(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.ADMIN), deleteProduct);

module.exports = router;

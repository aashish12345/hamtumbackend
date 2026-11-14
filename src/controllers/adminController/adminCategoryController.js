const mongoose = require("mongoose");
const CategoryList = require("../../models/CategoryList");
const env = require("../../config/env");
const { uploadFileToS3 } = require("../../services/s3UploadService");

function normalizeText(value) {
  return String(value || "").trim();
}

function parseSortOrder(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return { value: 0, error: "" };
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { value: 0, error: "Sort order must be a non-negative integer" };
  }

  return { value: parsed, error: "" };
}

function parseBooleanFlag(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return { value: false, error: "", provided: false };
  }

  if (typeof value === "boolean") {
    return { value, error: "", provided: true };
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return { value: true, error: "", provided: true };
  }
  if (normalized === "false" || normalized === "0") {
    return { value: false, error: "", provided: true };
  }

  return { value: false, error: `${fieldName} must be a boolean`, provided: true };
}

function equalsIgnoreCase(left, right) {
  return normalizeText(left).toLowerCase() === normalizeText(right).toLowerCase();
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function toPublicUrl(keyOrUrl) {
  const value = String(keyOrUrl || "").trim();
  if (!value) {
    return "";
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (!env.awsS3Bucket || !env.awsRegion) {
    return "";
  }
  return `https://${env.awsS3Bucket}.s3.${env.awsRegion}.amazonaws.com/${value}`;
}

function resolveObjectKey(rawKeyOrUrl, folderPrefix) {
  const value = String(rawKeyOrUrl || "").trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.includes("/")) {
    return value;
  }

  return `${folderPrefix}/${value}`;
}

function normalizeCategoryForResponse(categoryDoc) {
  const raw = categoryDoc.toObject();
  const imageObjectKey = raw.imageObjectKey || resolveObjectKey(raw.imageKey || raw.imageUrl, "hamtum/categories/images");

  return {
    ...raw,
    imageObjectKey: imageObjectKey || "",
    imageUrl: toPublicUrl(imageObjectKey)
  };
}

async function listCategories(req, res) {
  const categories = await CategoryList.find({}).sort({ sortOrder: 1, name: 1, createdAt: -1 });
  return res.status(200).json({ categories: categories.map(normalizeCategoryForResponse) });
}

async function getCategoryById(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  if (!isValidObjectId(categoryId)) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  const category = await CategoryList.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  return res.status(200).json({ category: normalizeCategoryForResponse(category) });
}

function getCategoryImageFromBody(req) {
  const imageKey = normalizeText(req.body.imageKey);
  const imageObjectKeyRaw = normalizeText(req.body.imageObjectKey);
  const imageObjectKey = imageObjectKeyRaw || (imageKey ? resolveObjectKey(imageKey, "hamtum/categories/images") : "");

  return {
    imageKey,
    imageObjectKey
  };
}

async function createCategory(req, res) {
  const name = normalizeText(req.body.name);
  const description = normalizeText(req.body.description);
  const sortOrderResult = parseSortOrder(req.body.sortOrder);
  const isShowOnHomeResult = parseBooleanFlag(req.body.isShowOnHome, "isShowOnHome");
  const imageFromBody = getCategoryImageFromBody(req);
  if (!name) {
    return res.status(400).json({ message: "Category name is required" });
  }
  if (sortOrderResult.error) {
    return res.status(400).json({ message: sortOrderResult.error });
  }
  if (isShowOnHomeResult.error) {
    return res.status(400).json({ message: isShowOnHomeResult.error });
  }
  const duplicateCategory = await CategoryList.findOne({
    $expr: {
      $eq: [{ $toLower: "$name" }, name.toLowerCase()]
    }
  });

  if (duplicateCategory) {
    return res.status(409).json({ message: "Category with this name already exists" });
  }

  const category = await CategoryList.create({
    name,
    description,
    sortOrder: sortOrderResult.value,
    isShowOnHome: isShowOnHomeResult.value,
    imageKey: imageFromBody.imageKey,
    imageObjectKey: imageFromBody.imageObjectKey,
    imageUrl: ""
  });

  return res.status(201).json({
    message: "Category created successfully",
    category: normalizeCategoryForResponse(category)
  });
}

async function updateCategoryHasIsShowOnHome(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  const hasIsShowOnHome = Object.prototype.hasOwnProperty.call(req.body || {}, "isShowOnHome");
  const isShowOnHomeResult = parseBooleanFlag(req.body.isShowOnHome, "isShowOnHome");

  if (!isValidObjectId(categoryId)) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  if (hasIsShowOnHome && isShowOnHomeResult.error) {
    return res.status(400).json({ message: isShowOnHomeResult.error });
  }

  const category = await CategoryList.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  if (hasIsShowOnHome) {
    category.isShowOnHome = isShowOnHomeResult.value;
    await category.save();
  }

  return res.status(200).json({
    message: "Category updated successfully",
    category: normalizeCategoryForResponse(category)
  });
}

async function updateCategory(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
  const hasDescription = Object.prototype.hasOwnProperty.call(req.body || {}, "description");
  const hasSortOrder = Object.prototype.hasOwnProperty.call(req.body || {}, "sortOrder");
  const hasIsShowOnHome = Object.prototype.hasOwnProperty.call(req.body || {}, "isShowOnHome");
  const name = normalizeText(req.body.name);
  const description = normalizeText(req.body.description);
  const sortOrderResult = parseSortOrder(req.body.sortOrder);
  const isShowOnHomeResult = parseBooleanFlag(req.body.isShowOnHome, "isShowOnHome");
  const imageFromBody = getCategoryImageFromBody(req);

  if (!isValidObjectId(categoryId)) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  if (hasName && !name) {
    return res.status(400).json({ message: "Category name is required" });
  }
  if (hasSortOrder && sortOrderResult.error) {
    return res.status(400).json({ message: sortOrderResult.error });
  }
  if (hasIsShowOnHome && isShowOnHomeResult.error) {
    return res.status(400).json({ message: isShowOnHomeResult.error });
  }

  const category = await CategoryList.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  if (hasName) {
    const duplicateCategory = await CategoryList.findOne({
      _id: { $ne: category._id },
      $expr: {
        $eq: [{ $toLower: "$name" }, name.toLowerCase()]
      }
    });

    if (duplicateCategory) {
      return res.status(409).json({ message: "Category with this name already exists" });
    }
  }

  if (hasName) {
    category.name = name;
  }
  if (hasDescription) {
    category.description = description;
  }
  if (hasSortOrder) {
    category.sortOrder = sortOrderResult.value;
  }
  if (hasIsShowOnHome) {
    category.isShowOnHome = isShowOnHomeResult.value;
  }
  if (imageFromBody.imageKey) {
    category.imageKey = imageFromBody.imageKey;
    category.imageObjectKey = imageFromBody.imageObjectKey;
    category.imageUrl = "";
  }
  await category.save();

  return res.status(200).json({
    message: "Category updated successfully",
    category: normalizeCategoryForResponse(category)
  });
}

async function updateCategorySortOrder(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  if (!isValidObjectId(categoryId)) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  const sortOrderResult = parseSortOrder(req.body.sortOrder);
  if (sortOrderResult.error) {
    return res.status(400).json({ message: sortOrderResult.error });
  }

  const category = await CategoryList.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  category.sortOrder = sortOrderResult.value;
  await category.save();

  return res.status(200).json({
    message: "Category sort order updated successfully",
    category: normalizeCategoryForResponse(category)
  });
}

async function uploadCategoryImage(req, res) {
  const imageFiles = req.files && req.files.image && req.files.image.length > 0 ? req.files.image : [];
  if (imageFiles.length < 1) {
    return res.status(400).json({ message: "Category image file is required" });
  }

  const categoryImageFile = imageFiles[0];

  try {
    const imageUpload = await uploadFileToS3({
      fileBuffer: categoryImageFile.buffer,
      contentType: categoryImageFile.mimetype,
      originalName: categoryImageFile.originalname,
      folderPrefix: "hamtum/categories/images"
    });

    return res.status(200).json({
      message: "Category image uploaded successfully",
      media: {
        imageKey: imageUpload.fileName,
        imageObjectKey: imageUpload.key,
        imageUrl: imageUpload.url
      }
    });
  } catch (error) {
    console.error("Category image upload failed", error);
    return res.status(500).json({ message: error.message || "Failed to upload category image" });
  }
}

async function deleteCategory(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  if (!isValidObjectId(categoryId)) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  const category = await CategoryList.findByIdAndDelete(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  return res.status(200).json({ message: "Category deleted successfully" });
}

async function createSubcategory(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  const name = normalizeText(req.body.name);
  const description = normalizeText(req.body.description);

  if (!isValidObjectId(categoryId)) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  if (!name) {
    return res.status(400).json({ message: "Subcategory name is required" });
  }

  const category = await CategoryList.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  const duplicateSubcategory = category.subcategories.some((subcategory) =>
    equalsIgnoreCase(subcategory.name, name)
  );
  if (duplicateSubcategory) {
    return res.status(409).json({ message: "Subcategory with this name already exists in this category" });
  }

  category.subcategories.push({ name, description });
  await category.save();

  return res.status(201).json({
    message: "Subcategory created successfully",
    category
  });
}

async function listSubcategories(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  if (!isValidObjectId(categoryId)) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  const category = await CategoryList.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  return res.status(200).json({
    categoryId: category._id,
    categoryName: category.name,
    subcategories: category.subcategories || []
  });
}

async function getSubcategoryById(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  const subcategoryId = normalizeText(req.params.subcategoryId);

  if (!isValidObjectId(categoryId) || !isValidObjectId(subcategoryId)) {
    return res.status(400).json({ message: "Invalid category or subcategory id" });
  }

  const category = await CategoryList.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  const subcategory = category.subcategories.id(subcategoryId);
  if (!subcategory) {
    return res.status(404).json({ message: "Subcategory not found" });
  }

  return res.status(200).json({
    categoryId: category._id,
    categoryName: category.name,
    subcategory
  });
}

async function updateSubcategory(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  const subcategoryId = normalizeText(req.params.subcategoryId);
  const name = normalizeText(req.body.name);
  const description = normalizeText(req.body.description);

  if (!isValidObjectId(categoryId) || !isValidObjectId(subcategoryId)) {
    return res.status(400).json({ message: "Invalid category or subcategory id" });
  }

  if (!name) {
    return res.status(400).json({ message: "Subcategory name is required" });
  }

  const category = await CategoryList.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  const subcategory = category.subcategories.id(subcategoryId);
  if (!subcategory) {
    return res.status(404).json({ message: "Subcategory not found" });
  }

  const duplicateSubcategory = category.subcategories.some(
    (existingSubcategory) =>
      String(existingSubcategory._id) !== String(subcategoryId) &&
      equalsIgnoreCase(existingSubcategory.name, name)
  );
  if (duplicateSubcategory) {
    return res.status(409).json({ message: "Subcategory with this name already exists in this category" });
  }

  subcategory.name = name;
  subcategory.description = description;
  await category.save();

  return res.status(200).json({
    message: "Subcategory updated successfully",
    category
  });
}

async function deleteSubcategory(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  const subcategoryId = normalizeText(req.params.subcategoryId);

  if (!isValidObjectId(categoryId) || !isValidObjectId(subcategoryId)) {
    return res.status(400).json({ message: "Invalid category or subcategory id" });
  }

  const category = await CategoryList.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  const subcategory = category.subcategories.id(subcategoryId);
  if (!subcategory) {
    return res.status(404).json({ message: "Subcategory not found" });
  }

  category.subcategories.pull({ _id: subcategoryId });
  await category.save();

  return res.status(200).json({
    message: "Subcategory deleted successfully",
    category
  });
}

module.exports = {
  listCategories,
  getCategoryById,
  uploadCategoryImage,
  createCategory,
  updateCategory,
  updateCategorySortOrder,
  deleteCategory,
  listSubcategories,
  getSubcategoryById,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  updateCategoryHasIsShowOnHome
};

const mongoose = require("mongoose");
const CategoryList = require("../../models/CategoryList");
const env = require("../../config/env");
const { uploadFileToS3 } = require("../../services/s3UploadService");

function normalizeText(value) {
  return String(value || "").trim();
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
  const categories = await CategoryList.find({}).sort({ createdAt: -1 });
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
  const imageFromBody = getCategoryImageFromBody(req);
  if (!name) {
    return res.status(400).json({ message: "Category name is required" });
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
    imageKey: imageFromBody.imageKey,
    imageObjectKey: imageFromBody.imageObjectKey,
    imageUrl: ""
  });

  return res.status(201).json({
    message: "Category created successfully",
    category: normalizeCategoryForResponse(category)
  });
}

async function updateCategory(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  const name = normalizeText(req.body.name);
  const description = normalizeText(req.body.description);
  const imageFromBody = getCategoryImageFromBody(req);

  if (!isValidObjectId(categoryId)) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  if (!name) {
    return res.status(400).json({ message: "Category name is required" });
  }

  const category = await CategoryList.findById(categoryId);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  const duplicateCategory = await CategoryList.findOne({
    _id: { $ne: category._id },
    $expr: {
      $eq: [{ $toLower: "$name" }, name.toLowerCase()]
    }
  });

  if (duplicateCategory) {
    return res.status(409).json({ message: "Category with this name already exists" });
  }

  category.name = name;
  category.description = description;
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
  deleteCategory,
  listSubcategories,
  getSubcategoryById,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory
};

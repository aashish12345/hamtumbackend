const mongoose = require("mongoose");
const CategoryList = require("../../models/CategoryList");

function normalizeText(value) {
  return String(value || "").trim();
}

function equalsIgnoreCase(left, right) {
  return normalizeText(left).toLowerCase() === normalizeText(right).toLowerCase();
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function listCategories(req, res) {
  const categories = await CategoryList.find({}).sort({ createdAt: -1 });
  return res.status(200).json({ categories });
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

  return res.status(200).json({ category });
}

async function createCategory(req, res) {
  const name = normalizeText(req.body.name);
  const description = normalizeText(req.body.description);

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
    description
  });

  return res.status(201).json({
    message: "Category created successfully",
    category
  });
}

async function updateCategory(req, res) {
  const categoryId = normalizeText(req.params.categoryId);
  const name = normalizeText(req.body.name);
  const description = normalizeText(req.body.description);

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
  await category.save();

  return res.status(200).json({
    message: "Category updated successfully",
    category
  });
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
  createCategory,
  updateCategory,
  deleteCategory,
  listSubcategories,
  getSubcategoryById,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory
};

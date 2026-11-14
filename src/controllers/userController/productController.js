const Product = require("../../models/Product");
const env = require("../../config/env");
const mongoose = require("mongoose");
const CategoryList = require("../../models/CategoryList");

function toPublicUrl(keyOrUrl) {
  if (Array.isArray(keyOrUrl)) {
    const first = keyOrUrl[0] || "";
    return toPublicUrl(first);
  }

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

function resolveImageObjectKeys(productObject) {
  if (
    Array.isArray(productObject.imageObjectKeys) &&
    productObject.imageObjectKeys.length > 0
  ) {
    return productObject.imageObjectKeys;
  }

  if (
    Array.isArray(productObject.imageKeys) &&
    productObject.imageKeys.length > 0
  ) {
    return productObject.imageKeys.map((imageKey) =>
      resolveObjectKey(imageKey, "hamtum/products/images"),
    );
  }

  if (
    Array.isArray(productObject.imageUrl) &&
    productObject.imageUrl.length > 0
  ) {
    return productObject.imageUrl.map((imageUrl) =>
      resolveObjectKey(imageUrl, "hamtum/products/images"),
    );
  }

  if (
    productObject.imageObjectKey ||
    productObject.imageKey ||
    productObject.imageUrl
  ) {
    return [
      resolveObjectKey(
        productObject.imageObjectKey ||
          productObject.imageKey ||
          productObject.imageUrl,
        "hamtum/products/images",
      ),
    ];
  }

  return [];
}

function normalizeProduct(product) {
  const productObject = product.toObject();
  const normalizedName = String(
    productObject.name || productObject.title || "",
  ).trim();
  const imageObjectKeys = resolveImageObjectKeys(productObject);

  return {
    ...productObject,
    name: normalizedName,
    imageUrl: imageObjectKeys
      .map((imageObjectKey) => toPublicUrl(imageObjectKey))
      .filter(Boolean),
    videoUrl: toPublicUrl(
      resolveObjectKey(
        productObject.videoObjectKey ||
          productObject.videoKey ||
          productObject.videoUrl,
        "hamtum/products/videos",
      ),
    ),
  };
}

function parsePriceFilterValue(rawValue, fieldName) {
  const normalized = String(rawValue ?? "").trim();
  if (!normalized) {
    return { hasValue: false, value: 0, error: "" };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { hasValue: false, value: 0, error: `${fieldName} must be a non-negative number.` };
  }

  return { hasValue: true, value: parsed, error: "" };
}

function getEffectivePriceExpression() {
  return {
    $cond: [{ $eq: ["$isOffer", true] }, "$offerPrice", "$price"],
  };
}

function buildBaseProductFilter(query = {}) {
  const category = String(query.category || "").trim();
  const search = String(query.search || "").trim();
  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { title: { $regex: escapedSearch, $options: "i" } },
      { description: { $regex: escapedSearch, $options: "i" } },
      { category: { $regex: escapedSearch, $options: "i" } },
      { subCategory: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  return filter;
}

async function listProducts(req, res) {
  const baseFilter = buildBaseProductFilter(req.query);
  const minPriceResult = parsePriceFilterValue(req.query.minPrice, "minPrice");
  const maxPriceResult = parsePriceFilterValue(req.query.maxPrice, "maxPrice");
  if (minPriceResult.error) {
    return res.status(400).json({ message: minPriceResult.error });
  }
  if (maxPriceResult.error) {
    return res.status(400).json({ message: maxPriceResult.error });
  }
  if (
    minPriceResult.hasValue &&
    maxPriceResult.hasValue &&
    minPriceResult.value > maxPriceResult.value
  ) {
    return res
      .status(400)
      .json({ message: "minPrice cannot be greater than maxPrice." });
  }

  const filter = { ...baseFilter };
  const effectivePriceExpression = getEffectivePriceExpression();
  const priceConditions = [];
  if (minPriceResult.hasValue) {
    priceConditions.push({ $gte: [effectivePriceExpression, minPriceResult.value] });
  }
  if (maxPriceResult.hasValue) {
    priceConditions.push({ $lte: [effectivePriceExpression, maxPriceResult.value] });
  }
  if (priceConditions.length === 1) {
    filter.$expr = priceConditions[0];
  } else if (priceConditions.length > 1) {
    filter.$expr = { $and: priceConditions };
  }

  const limitValue = Number.parseInt(String(req.query.limit || "").trim(), 10);
  const skipValue = Number.parseInt(String(req.query.skip || "").trim(), 10);
  const limit =
    Number.isFinite(limitValue) && limitValue > 0
      ? Math.min(limitValue, 100)
      : null;
  const skip = Number.isFinite(skipValue) && skipValue > 0 ? skipValue : 0;

  const priceRangeAggregation = await Product.aggregate([
    { $match: baseFilter },
    {
      $group: {
        _id: null,
        minPrice: { $min: effectivePriceExpression },
        maxPrice: { $max: effectivePriceExpression },
      },
    },
  ]);
  const availablePriceRange = priceRangeAggregation[0] || {};

  const query = Product.find(filter).sort({ createdAt: -1 }).skip(skip);
  if (limit) {
    query.limit(limit);
  }

  const [products, total] = await Promise.all([
    query,
    Product.countDocuments(filter),
  ]);
  const transformedProducts = products.map(normalizeProduct);
  const resolvedLimit = limit || transformedProducts.length;
  const hasMore = skip + transformedProducts.length < total;
  return res.status(200).json({
    products: transformedProducts,
    pagination: {
      limit: resolvedLimit,
      skip,
      total,
      hasMore,
      nextSkip: skip + transformedProducts.length,
    },
    priceRange: {
      min: Number.isFinite(availablePriceRange.minPrice)
        ? availablePriceRange.minPrice
        : 0,
      max: Number.isFinite(availablePriceRange.maxPrice)
        ? availablePriceRange.maxPrice
        : 0,
    },
  });
}

async function getDashboardData(req, res) {
  const perCategoryLimitValue = Number.parseInt(
    String(req.query.perCategoryLimit || "").trim(),
    10,
  );
  const perCategoryLimit =
    Number.isFinite(perCategoryLimitValue) && perCategoryLimitValue > 0
      ? Math.min(perCategoryLimitValue, 20)
      : 10;

  const [products, categories] = await Promise.all([
    Product.find({}).sort({ createdAt: -1 }),
    CategoryList.find({}).sort({ sortOrder: 1, name: 1 }),
  ]);

  const normalizedProducts = products.map(normalizeProduct);
  const groupedProducts = new Map();
  const categoryDocMap = new Map();
  const showOnHomeCategoryNames = [];

  categories.forEach((category) => {
    const name = String(category.name || "").trim();
    if (name) {
      categoryDocMap.set(name, category);
      if (category.isShowOnHome === true) {
        showOnHomeCategoryNames.push(name);
      }
    }
  });

  normalizedProducts.forEach((product) => {
    const categoryName = String(product.category || "").trim();
    if (!categoryName) {
      return;
    }

    const grouped = groupedProducts.get(categoryName) || [];
    grouped.push(product);
    groupedProducts.set(categoryName, grouped);
  });

  const orderedCategoryNames = Array.from(categoryDocMap.keys());

  const categoryCards = orderedCategoryNames.map((categoryName) => {
    const productsByCategory = groupedProducts.get(categoryName) || [];
    const categoryDoc = categoryDocMap.get(categoryName);
    const categoryImage = categoryDoc
      ? toPublicUrl(
          resolveObjectKey(
            categoryDoc.imageObjectKey ||
              categoryDoc.imageKey ||
              categoryDoc.imageUrl,
            "hamtum/categories/images",
          ),
        )
      : productsByCategory[0]?.imageUrl?.[0] || "";
    return {
      _id: categoryDoc?._id,
      name: categoryName,
      description: categoryDoc?.description || "",
      itemCount: productsByCategory.length,
      imageUrl: categoryImage,
      subcategories: categoryDoc?.subcategories || [],
      sortOrder: categoryDoc?.sortOrder || 0,
    };
  });

  const sections = showOnHomeCategoryNames
    .map((categoryName) => {
      const productsByCategory = groupedProducts.get(categoryName) || [];
      return {
        category: categoryName,
        totalItems: productsByCategory.length,
        products: productsByCategory.slice(0, perCategoryLimit),
      };
    })
    .filter((section) => section.totalItems > 0);

  return res.status(200).json({
    categories: categoryCards,
    sections,
    perCategoryLimit,
  });
}

async function getProductById(req, res) {
  const productId = String(req.params.productId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product id." });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  const transformedProduct = normalizeProduct(product);

  return res.status(200).json({ product: transformedProduct });
}

module.exports = {
  listProducts,
  getDashboardData,
  getProductById,
};

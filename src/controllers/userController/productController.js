const Product = require("../../models/Product");
const env = require("../../config/env");
const mongoose = require("mongoose");

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
  if (Array.isArray(productObject.imageObjectKeys) && productObject.imageObjectKeys.length > 0) {
    return productObject.imageObjectKeys;
  }

  if (Array.isArray(productObject.imageKeys) && productObject.imageKeys.length > 0) {
    return productObject.imageKeys.map((imageKey) => resolveObjectKey(imageKey, "hamtum/products/images"));
  }

  if (Array.isArray(productObject.imageUrl) && productObject.imageUrl.length > 0) {
    return productObject.imageUrl.map((imageUrl) => resolveObjectKey(imageUrl, "hamtum/products/images"));
  }

  if (productObject.imageObjectKey || productObject.imageKey || productObject.imageUrl) {
    return [resolveObjectKey(productObject.imageObjectKey || productObject.imageKey || productObject.imageUrl, "hamtum/products/images")];
  }

  return [];
}

async function listProducts(req, res) {
  const category = String(req.query.category || "").trim();
  const filter = category ? { category } : {};
  const products = await Product.find(filter).sort({ createdAt: -1 });
  const transformedProducts = products.map((product) => {
    const productObject = product.toObject();
    const normalizedName = String(productObject.name || productObject.title || "").trim();
    const imageObjectKeys = resolveImageObjectKeys(productObject);
    return {
      ...productObject,
      name: normalizedName,
      imageUrl: imageObjectKeys.map((imageObjectKey) => toPublicUrl(imageObjectKey)).filter(Boolean),
      videoUrl: toPublicUrl(
        resolveObjectKey(productObject.videoObjectKey || productObject.videoKey || productObject.videoUrl, "hamtum/products/videos")
      )
    };
  });
  return res.status(200).json({ products: transformedProducts });
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

  const productObject = product.toObject();
  const imageObjectKeys = resolveImageObjectKeys(productObject);
  const transformedProduct = {
    ...productObject,
    name: String(productObject.name || productObject.title || "").trim(),
    imageUrl: imageObjectKeys.map((imageObjectKey) => toPublicUrl(imageObjectKey)).filter(Boolean),
    videoUrl: toPublicUrl(
      resolveObjectKey(productObject.videoObjectKey || productObject.videoKey || productObject.videoUrl, "hamtum/products/videos")
    )
  };

  return res.status(200).json({ product: transformedProduct });
}

module.exports = {
  listProducts,
  getProductById
};

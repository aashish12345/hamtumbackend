const mongoose = require("mongoose");
const Product = require("../../models/Product");
const env = require("../../config/env");
const { uploadFileToS3 } = require("../../services/s3UploadService");

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function parseStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item || "").trim()).filter(Boolean);
        }
      } catch (error) {
        return [];
      }
    }

    return trimmed
      .split(",")
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return [];
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

function normalizeProductForResponse(product) {
  const raw = product.toObject();
  const name = String(raw.name || raw.title || "").trim();
  const imageObjectKeys = Array.isArray(raw.imageObjectKeys) && raw.imageObjectKeys.length > 0
    ? raw.imageObjectKeys
    : Array.isArray(raw.imageKeys) && raw.imageKeys.length > 0
      ? raw.imageKeys.map((imageKey) => resolveObjectKey(imageKey, "hamtum/products/images"))
      : raw.imageObjectKey || raw.imageKey || raw.imageUrl
        ? [resolveObjectKey(raw.imageObjectKey || raw.imageKey || raw.imageUrl, "hamtum/products/images")]
        : [];
  const imageFileNames = Array.isArray(raw.imageKeys) && raw.imageKeys.length > 0
    ? raw.imageKeys
    : raw.imageKey
      ? [raw.imageKey]
      : [];

  return {
    ...raw,
    name,
    imageKeys: imageFileNames,
    imageKey: imageFileNames[0] || "",
    imageUrl: imageObjectKeys.map((imageObjectKey) => toPublicUrl(imageObjectKey)).filter(Boolean),
    videoUrl: toPublicUrl(resolveObjectKey(raw.videoObjectKey || raw.videoKey || raw.videoUrl, "hamtum/products/videos")),
    quantity: typeof raw.quantity === "number" ? raw.quantity : Number(raw.Quantity || 0)
  };
}

function validateProductInput(req) {
  const name = String(req.body.name || "").trim();
  const description = String(req.body.description || "").trim();
  const category = String(req.body.category || "").trim();
  const subCategory = String(req.body.subCategory || "").trim();
  const price = parseNumber(req.body.price, NaN);
  const isOffer = toBoolean(req.body.isOffer);
  const offerPrice = parseNumber(req.body.offerPrice, 0);
  const inStock = typeof req.body.inStock === "undefined" ? true : toBoolean(req.body.inStock);
  const quantity = Math.max(0, parseNumber(req.body.quantity, 0));

  if (!name || !description || !category || !subCategory) {
    return { error: "name, description, category and subCategory are required" };
  }

  function getMediaFromBody(req) {
    const imageKeys = parseStringArray(req.body.imageKeys);
    const imageObjectKeysRaw = parseStringArray(req.body.imageObjectKeys);
    const imageObjectKeys = imageObjectKeysRaw.length > 0
      ? imageObjectKeysRaw
      : imageKeys.map((imageKey) => resolveObjectKey(imageKey, "hamtum/products/images")).filter(Boolean);

    const videoKey = String(req.body.videoKey || "").trim();
    const videoObjectKeyRaw = String(req.body.videoObjectKey || "").trim();
    const videoObjectKey = videoObjectKeyRaw || (videoKey ? resolveObjectKey(videoKey, "hamtum/products/videos") : "");

    return {
      imageKeys,
      imageObjectKeys,
      videoKey,
      videoObjectKey
    };
  }

  if (Number.isNaN(price) || price < 0) {
    return { error: "price must be a valid positive number" };
  }

  if (isOffer && (offerPrice <= 0 || offerPrice >= price)) {
    return { error: "offerPrice must be greater than 0 and less than price" };
  }

  return {
    data: {
      name,
      title: name,
      description,
      category,
      subCategory,
      price,
      isOffer,
      offerPrice: isOffer ? offerPrice : 0,
      inStock,
      quantity,
      Quantity: quantity
    }
  };
}

async function uploadMediaIfProvided(req) {
  const imageFiles = req.files && req.files.image && req.files.image.length > 0 ? req.files.image : [];
  const videoFile = req.files && req.files.video && req.files.video.length > 0 ? req.files.video[0] : null;

  const imageUploads = [];
  let videoUpload = null;

  if (imageFiles.length > 0) {
    for (const imageFile of imageFiles) {
      const imageUpload = await uploadFileToS3({
        fileBuffer: imageFile.buffer,
        contentType: imageFile.mimetype,
        originalName: imageFile.originalname,
        folderPrefix: "hamtum/products/images"
      });
      imageUploads.push(imageUpload);
    }
  }

  if (videoFile) {
    videoUpload = await uploadFileToS3({
      fileBuffer: videoFile.buffer,
      contentType: videoFile.mimetype,
      originalName: videoFile.originalname,
      folderPrefix: "hamtum/products/videos"
    });
  }

  return { imageUploads, videoUpload };
}

async function createProduct(req, res) {
  const validation = validateProductInput(req);
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  try {
    const { imageUploads, videoUpload } = await uploadMediaIfProvided(req);
    const mediaFromBody = getMediaFromBody(req);

    const imageKeys = imageUploads.length > 0
      ? imageUploads.map((imageUpload) => imageUpload.fileName)
      : mediaFromBody.imageKeys;
    const imageObjectKeys = imageUploads.length > 0
      ? imageUploads.map((imageUpload) => imageUpload.key)
      : mediaFromBody.imageObjectKeys;
    const videoKey = videoUpload ? videoUpload.fileName : mediaFromBody.videoKey;
    const videoObjectKey = videoUpload ? videoUpload.key : mediaFromBody.videoObjectKey;

    if (imageKeys.length < 1) {
      return res.status(400).json({ message: "Product image is required" });
    }

    const product = await Product.create({
      ...validation.data,
      imageKeys,
      imageKey: imageKeys[0] || "",
      imageObjectKeys,
      imageObjectKey: imageObjectKeys[0] || "",
      imageUrl: [],
      videoKey,
      videoObjectKey,
      videoUrl: ""
    });

    return res.status(201).json({
      message: "Product created successfully",
      product: normalizeProductForResponse(product)
    });
  } catch (error) {
    console.error("Product create failed", error);
    return res.status(500).json({ message: error.message || "Failed to create product" });
  }
}

async function listAdminProducts(req, res) {
  const products = await Product.find({}).sort({ createdAt: -1 });
  return res.status(200).json({ products: products.map(normalizeProductForResponse) });
}

async function getAdminProductById(req, res) {
  const productId = String(req.params.productId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product id" });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.status(200).json({ product: normalizeProductForResponse(product) });
}

async function updateProduct(req, res) {
  const productId = String(req.params.productId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product id" });
  }

  const validation = validateProductInput(req);
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  try {
    const { imageUploads, videoUpload } = await uploadMediaIfProvided(req);
    const mediaFromBody = getMediaFromBody(req);

    Object.assign(product, validation.data);
    const bodyHasImageKeys = mediaFromBody.imageKeys.length > 0;
    if (imageUploads.length > 0 || bodyHasImageKeys) {
      const imageKeys = imageUploads.length > 0
        ? imageUploads.map((imageUpload) => imageUpload.fileName)
        : mediaFromBody.imageKeys;
      const imageObjectKeys = imageUploads.length > 0
        ? imageUploads.map((imageUpload) => imageUpload.key)
        : mediaFromBody.imageObjectKeys;
      product.imageKeys = imageKeys;
      product.imageKey = imageKeys[0] || "";
      product.imageObjectKeys = imageObjectKeys;
      product.imageObjectKey = imageObjectKeys[0] || "";
      product.imageUrl = [];
    }
    if (videoUpload || mediaFromBody.videoKey) {
      product.videoKey = videoUpload ? videoUpload.fileName : mediaFromBody.videoKey;
      product.videoObjectKey = videoUpload ? videoUpload.key : mediaFromBody.videoObjectKey;
      product.videoUrl = "";
    }

    await product.save();

    return res.status(200).json({
      message: "Product updated successfully",
      product: normalizeProductForResponse(product)
    });
  } catch (error) {
    console.error("Product update failed", error);
    return res.status(500).json({ message: error.message || "Failed to update product" });
  }
}

async function uploadProductMedia(req, res) {
  const imageFiles = req.files && req.files.image && req.files.image.length > 0 ? req.files.image : [];
  const videoFiles = req.files && req.files.video && req.files.video.length > 0 ? req.files.video : [];

  if (imageFiles.length < 1 && videoFiles.length < 1) {
    return res.status(400).json({ message: "At least one image or video file is required" });
  }

  try {
    const { imageUploads, videoUpload } = await uploadMediaIfProvided(req);
    const imageKeys = imageUploads.map((imageUpload) => imageUpload.fileName);
    const imageObjectKeys = imageUploads.map((imageUpload) => imageUpload.key);

    return res.status(200).json({
      message: "Media uploaded successfully",
      media: {
        imageKeys,
        imageObjectKeys,
        imageUrls: imageUploads.map((imageUpload) => imageUpload.url),
        videoKey: videoUpload ? videoUpload.fileName : "",
        videoObjectKey: videoUpload ? videoUpload.key : "",
        videoUrl: videoUpload ? videoUpload.url : ""
      }
    });
  } catch (error) {
    console.error("Media upload failed", error);
    return res.status(500).json({ message: error.message || "Failed to upload media" });
  }
}

async function deleteProduct(req, res) {
  const productId = String(req.params.productId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product id" });
  }

  const deletedProduct = await Product.findByIdAndDelete(productId);
  if (!deletedProduct) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.status(200).json({ message: "Product deleted successfully" });
}

module.exports = {
  uploadProductMedia,
  createProduct,
  listAdminProducts,
  getAdminProductById,
  updateProduct,
  deleteProduct
};

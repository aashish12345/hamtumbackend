const mongoose = require("mongoose");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");

function parseQuantity(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return { value: 1, error: "Quantity must be a positive integer." };
  }
  return { value: Math.min(parsed, 99), error: "" };
}

function resolveProductImage(product) {
  const imageList = Array.isArray(product.imageUrl) ? product.imageUrl : [];
  if (imageList.length > 0 && imageList[0]) {
    return imageList[0];
  }
  return "";
}

function getUnitPrice(product) {
  return product.isOffer ? Number(product.offerPrice || 0) : Number(product.price || 0);
}

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }
  return cart;
}

async function buildCartPayload(cart) {
  const productIds = (cart.items || []).map((item) => item.productId).filter(Boolean);
  if (productIds.length < 1) {
    return {
      items: [],
      summary: {
        totalItems: 0,
        totalAmount: 0,
      },
    };
  }

  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(
    products.map((product) => [String(product._id), product]),
  );

  const validItems = [];
  const responseItems = [];

  for (const cartItem of cart.items) {
    const product = productMap.get(String(cartItem.productId));
    if (!product) {
      continue;
    }

    validItems.push({
      productId: product._id,
      quantity: cartItem.quantity,
    });

    const unitPrice = getUnitPrice(product);
    const quantity = Number(cartItem.quantity || 1);
    responseItems.push({
      productId: product._id,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      product: {
        _id: product._id,
        name: product.name,
        imageUrl: resolveProductImage(product),
        category: product.category || "",
        inStock: Boolean(product.inStock),
        price: Number(product.price || 0),
        isOffer: Boolean(product.isOffer),
        offerPrice: Number(product.offerPrice || 0),
      },
    });
  }

  if (validItems.length !== cart.items.length) {
    cart.items = validItems;
    await cart.save();
  }

  const totalItems = responseItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );
  const totalAmount = responseItems.reduce(
    (sum, item) => sum + Number(item.totalPrice || 0),
    0,
  );

  return {
    items: responseItems,
    summary: {
      totalItems,
      totalAmount,
    },
  };
}

async function getCart(req, res) {
  const cart = await getOrCreateCart(req.user._id);
  const payload = await buildCartPayload(cart);
  return res.status(200).json({ cart: payload });
}

async function addCartItem(req, res) {
  const productId = String(req.body.productId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product id." });
  }

  const quantityResult = parseQuantity(req.body.quantity);
  if (quantityResult.error) {
    return res.status(400).json({ message: quantityResult.error });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }
  if (!product.inStock) {
    return res.status(400).json({ message: "Product is out of stock." });
  }

  const cart = await getOrCreateCart(req.user._id);
  const existingItem = cart.items.find(
    (item) => String(item.productId) === String(productId),
  );
  if (existingItem) {
    existingItem.quantity = Math.min(existingItem.quantity + quantityResult.value, 99);
  } else {
    cart.items.push({
      productId,
      quantity: quantityResult.value,
    });
  }
  await cart.save();

  const payload = await buildCartPayload(cart);
  return res.status(200).json({
    message: "Product added to cart.",
    cart: payload,
  });
}

async function updateCartItemQuantity(req, res) {
  const productId = String(req.params.productId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product id." });
  }

  const quantityResult = parseQuantity(req.body.quantity);
  if (quantityResult.error) {
    return res.status(400).json({ message: quantityResult.error });
  }

  const cart = await getOrCreateCart(req.user._id);
  const existingItem = cart.items.find(
    (item) => String(item.productId) === String(productId),
  );
  if (!existingItem) {
    return res.status(404).json({ message: "Cart item not found." });
  }

  existingItem.quantity = quantityResult.value;
  await cart.save();
  const payload = await buildCartPayload(cart);
  return res.status(200).json({
    message: "Cart item quantity updated.",
    cart: payload,
  });
}

async function removeCartItem(req, res) {
  const productId = String(req.params.productId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product id." });
  }

  const cart = await getOrCreateCart(req.user._id);
  const initialLength = cart.items.length;
  cart.items = cart.items.filter(
    (item) => String(item.productId) !== String(productId),
  );

  if (cart.items.length === initialLength) {
    return res.status(404).json({ message: "Cart item not found." });
  }

  await cart.save();
  const payload = await buildCartPayload(cart);
  return res.status(200).json({
    message: "Cart item removed.",
    cart: payload,
  });
}

module.exports = {
  getCart,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
};

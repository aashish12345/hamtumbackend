const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const env = require("../../config/env");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const PaymentOrder = require("../../models/PaymentOrder");

function getUnitPrice(product) {
  return product.isOffer ? Number(product.offerPrice || 0) : Number(product.price || 0);
}

function getAvailableStock(product) {
  const parsed = Number.parseInt(String(product?.quantity ?? 0).trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function createRazorpayClient() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new Error("Payment gateway is not configured.");
  }

  return new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret,
  });
}

async function buildCheckoutSnapshot(userId) {
  const cart = await Cart.findOne({ userId });
  const cartItems = Array.isArray(cart?.items) ? cart.items : [];

  if (cartItems.length < 1) {
    throw new Error("Cart is empty.");
  }

  const productIds = cartItems.map((item) => item.productId).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const items = [];
  for (const cartItem of cartItems) {
    const product = productMap.get(String(cartItem.productId));
    if (!product) {
      throw new Error("Some cart items are no longer available.");
    }

    const availableStock = getAvailableStock(product);
    if (!product.inStock || availableStock < 1) {
      throw new Error(`Product "${product.name}" is out of stock.`);
    }

    const requestedQuantity = Number.parseInt(String(cartItem.quantity || 0), 10);
    if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
      throw new Error(`Invalid quantity for product "${product.name}".`);
    }

    if (requestedQuantity > availableStock) {
      throw new Error(`Only ${availableStock} item(s) available for "${product.name}".`);
    }

    const unitPrice = getUnitPrice(product);
    items.push({
      productId: product._id,
      name: String(product.name || "").trim(),
      quantity: requestedQuantity,
      unitPrice,
      totalPrice: unitPrice * requestedQuantity,
    });
  }

  const amount = items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Cart total is invalid.");
  }

  return {
    amount,
    amountInPaise: Math.round(amount * 100),
    currency: "INR",
    items,
  };
}

async function createCheckoutOrder(req, res) {
  let razorpayClient;
  try {
    razorpayClient = createRazorpayClient();
  } catch (configError) {
    return res.status(503).json({ message: configError.message });
  }

  let snapshot;
  try {
    snapshot = await buildCheckoutSnapshot(req.user._id);
  } catch (snapshotError) {
    return res.status(400).json({ message: snapshotError.message });
  }

  const paymentOrder = await PaymentOrder.create({
    userId: req.user._id,
    status: "created",
    currency: snapshot.currency,
    amount: snapshot.amount,
    amountInPaise: snapshot.amountInPaise,
    items: snapshot.items,
  });

  try {
    const razorpayOrder = await razorpayClient.orders.create({
      amount: snapshot.amountInPaise,
      currency: snapshot.currency,
      receipt: String(paymentOrder._id),
      notes: {
        userId: String(req.user._id),
        paymentOrderId: String(paymentOrder._id),
      },
    });

    paymentOrder.razorpayOrderId = razorpayOrder.id;
    await paymentOrder.save();

    return res.status(200).json({
      orderId: razorpayOrder.id,
      amount: snapshot.amount,
      amountInPaise: snapshot.amountInPaise,
      currency: snapshot.currency,
      keyId: env.razorpayKeyId,
      prefill: {
        name: req.user.name || "",
        email: req.user.email || "",
        contact: req.user.phone || "",
      },
      merchantName: "HamTum",
      description: "HamTum cart checkout",
    });
  } catch (createOrderError) {
    paymentOrder.status = "failed";
    await paymentOrder.save();
    return res.status(502).json({ message: "Unable to create payment order right now." });
  }
}

async function verifyCheckoutPayment(req, res) {
  const razorpayOrderId = String(req.body.razorpayOrderId || "").trim();
  const razorpayPaymentId = String(req.body.razorpayPaymentId || "").trim();
  const razorpaySignature = String(req.body.razorpaySignature || "").trim();

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ message: "Missing payment verification fields." });
  }

  const paymentOrder = await PaymentOrder.findOne({
    razorpayOrderId,
    userId: req.user._id,
  });
  if (!paymentOrder) {
    return res.status(404).json({ message: "Payment order not found." });
  }

  if (paymentOrder.status === "paid") {
    return res.status(200).json({ message: "Payment already verified." });
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  if (expectedSignature !== razorpaySignature) {
    paymentOrder.status = "failed";
    await paymentOrder.save();
    return res.status(400).json({ message: "Payment signature verification failed." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.findOne({ userId: req.user._id }).session(session);
    const cartItems = Array.isArray(cart?.items) ? cart.items : [];
    if (cartItems.length < 1) {
      throw new Error("Cart is empty.");
    }

    const productIds = cartItems.map((item) => item.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } }).session(session);
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const finalizedItems = [];
    let recalculatedAmount = 0;

    for (const cartItem of cartItems) {
      const product = productMap.get(String(cartItem.productId));
      if (!product) {
        throw new Error("Some cart items are no longer available.");
      }

      const requestedQuantity = Number.parseInt(String(cartItem.quantity || 0), 10);
      if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
        throw new Error(`Invalid quantity for product "${product.name}".`);
      }

      const availableStock = getAvailableStock(product);
      if (!product.inStock || availableStock < requestedQuantity) {
        throw new Error(`Only ${availableStock} item(s) available for "${product.name}".`);
      }

      const unitPrice = getUnitPrice(product);
      const totalPrice = unitPrice * requestedQuantity;
      finalizedItems.push({
        productId: product._id,
        name: String(product.name || "").trim(),
        quantity: requestedQuantity,
        unitPrice,
        totalPrice,
      });
      recalculatedAmount += totalPrice;

      product.quantity = availableStock - requestedQuantity;
      if (product.quantity <= 0) {
        product.quantity = 0;
        product.inStock = false;
      }
      await product.save({ session });
    }

    paymentOrder.status = "paid";
    paymentOrder.razorpayPaymentId = razorpayPaymentId;
    paymentOrder.razorpaySignature = razorpaySignature;
    paymentOrder.paidAt = new Date();
    paymentOrder.items = finalizedItems;
    paymentOrder.amount = recalculatedAmount;
    paymentOrder.amountInPaise = Math.round(recalculatedAmount * 100);
    await paymentOrder.save({ session });

    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();
    return res.status(200).json({
      message: "Payment successful. Your order has been placed.",
      order: {
        id: paymentOrder._id,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
      },
    });
  } catch (paymentError) {
    await session.abortTransaction();
    paymentOrder.status = "failed";
    await paymentOrder.save();
    return res.status(400).json({ message: paymentError.message || "Payment verification failed." });
  } finally {
    session.endSession();
  }
}

module.exports = {
  createCheckoutOrder,
  verifyCheckoutPayment,
};

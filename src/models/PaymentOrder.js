const mongoose = require("mongoose");

const paymentOrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, trim: true, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const paymentOrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["created", "paid", "failed"], default: "created", index: true },
    currency: { type: String, trim: true, default: "INR" },
    amount: { type: Number, required: true, min: 0 },
    amountInPaise: { type: Number, required: true, min: 0 },
    items: { type: [paymentOrderItemSchema], default: [] },
    razorpayOrderId: { type: String, trim: true, default: "", index: true, unique: true, sparse: true },
    razorpayPaymentId: { type: String, trim: true, default: "", index: true, unique: true, sparse: true },
    razorpaySignature: { type: String, trim: true, default: "" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PaymentOrder", paymentOrderSchema);

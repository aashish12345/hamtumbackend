const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, trim: true, default: "" },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    imageKeys: [{ type: String, trim: true }],
    imageKey: { type: String, trim: true, default: "" },
    imageObjectKeys: [{ type: String, trim: true }],
    imageObjectKey: { type: String, trim: true, default: "" },
    imageUrl: [{ type: String, trim: true }],
    videoKey: { type: String, trim: true, default: "" },
    videoObjectKey: { type: String, trim: true, default: "" },
    videoUrl: { type: String, trim: true, default: "" },
    inStock: { type: Boolean, default: true },
    isOffer: { type: Boolean, default: false },
    offerPrice: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    Quantity: { type: Number, default: 0 },
    deliveryTime: { type: String, trim: true, default: "2hr" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);

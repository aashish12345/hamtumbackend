const mongoose = require("mongoose");

const subCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" }
  },
  { _id: true, timestamps: true }
);

const categoryListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    subcategories: { type: [subCategorySchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CategoryList", categoryListSchema);

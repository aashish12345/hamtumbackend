const connectDatabase = require("../config/db");
const Product = require("../models/Product");

const products = [
  {
    name: "Luxury Gift Hamper",
    description: "Premium gift basket with chocolates, diary, and scented candle.",
    category: "Gifts",
    price: 2499,
    offerPrice: 1999,
    imageUrl: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
  {
    name: "Designer Notebook Set",
    description: "Set of 3 hardcover notebooks for daily planning and journaling.",
    category: "Stationery",
    price: 799,
    offerPrice: 699,
    imageUrl: "https://images.unsplash.com/photo-1455885666463-9f41c03a2d5f?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
  {
    name: "Personalized Pen Gift Box",
    description: "Elegant pen gift box with custom name engraving.",
    category: "Gifts",
    price: 1299,
    offerPrice: 1099,
    imageUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
  {
    name: "Office Desk Organizer Kit",
    description: "Complete stationery organizer with pen stand, sticky notes, and clips.",
    category: "Stationery",
    price: 999,
    offerPrice: 899,    
    imageUrl: "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
    {
    name: "Luxury Gift Hamper",
    description: "Premium gift basket with chocolates, diary, and scented candle.",
    category: "Gifts",
    price: 2499,
    offerPrice: 1999,
    imageUrl: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
  {
    name: "Designer Notebook Set",
    description: "Set of 3 hardcover notebooks for daily planning and journaling.",
    category: "Stationery",
    price: 799,
    offerPrice: 699,
    imageUrl: "https://images.unsplash.com/photo-1455885666463-9f41c03a2d5f?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
  {
    name: "Personalized Pen Gift Box",
    description: "Elegant pen gift box with custom name engraving.",
    category: "Gifts",
    price: 1299,
    offerPrice: 1099,
    imageUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
  {
    name: "Office Desk Organizer Kit",
    description: "Complete stationery organizer with pen stand, sticky notes, and clips.",
    category: "Stationery",
    price: 999,
    offerPrice: 899,
    imageUrl: "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
    {
    name: "Luxury Gift Hamper",
    description: "Premium gift basket with chocolates, diary, and scented candle.",
    category: "Gifts",
    price: 2499,
    offerPrice: 1999,
    imageUrl: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
  {
    name: "Designer Notebook Set",
    description: "Set of 3 hardcover notebooks for daily planning and journaling.",
    category: "Stationery",
    price: 799,
    offerPrice: 699,
    imageUrl: "https://images.unsplash.com/photo-1455885666463-9f41c03a2d5f?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
  {
    name: "Personalized Pen Gift Box",
    description: "Elegant pen gift box with custom name engraving.",
    category: "Gifts",
    price: 1299,
    offerPrice: 1099,
    imageUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80",
    inStock: true
  },
  {
    name: "Office Desk Organizer Kit",
    description: "Complete stationery organizer with pen stand, sticky notes, and clips.",
    category: "Stationery",
    price: 999,
    offerPrice: 899,
    imageUrl: "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=800&q=80",
    inStock: true
  }
];

async function seedProducts() {
  await connectDatabase();
  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log("Products seeded successfully");
}

module.exports = seedProducts;

if (require.main === module) {
  seedProducts()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to seed products", error);
      process.exit(1);
    });
}

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();
const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

const port = process.env.PORT || 5000;

// MongoDB Connection with dbName
mongoose
  .connect(process.env.MONGODB_URL, {
    dbName: "fable_bd",
  })
  .then(() => console.log("✅ MongoDB Connected to fable_bd"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ==================== MODELS ====================

// Ebook Model
const ebookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    writer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    writerName: { type: String, required: true },
    writerEmail: { type: String, default: "" },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    genre: {
      type: String,
      enum: [
        "Fiction",
        "Mystery",
        "Romance",
        "Sci-Fi",
        "Fantasy",
        "Horror",
        "Thriller",
        "Poetry",
      ],
    },
    coverImage: { type: String, default: "" },
    status: {
      type: String,
      enum: ["published", "unpublished"],
      default: "published",
    },
    sold: { type: Boolean, default: false },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

const Ebook = mongoose.model("Ebook", ebookSchema, "ebooks");

// Transaction Model
const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["purchase", "publishing_fee"],
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userEmail: String,
    ebook: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ebook",
      default: null,
    },
    ebookTitle: String,
    amount: { type: Number, required: true },
  },
  { timestamps: true },
);

const Transaction = mongoose.model("Transaction", transactionSchema);

// ==================== ROUTES ====================

// Test Route
app.get("/", (req, res) => {
  res.send("Fable Server is Running!");
});

// 1. GET Featured Ebooks (latest 6)
app.get("/api/ebooks/featured", async (req, res) => {
  try {
    const ebooks = await Ebook.find({ status: "published" })
      .sort({ createdAt: -1 })
      .limit(6);
    res.json(ebooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET All Ebooks (with search, filter, sort, pagination)
app.get("/api/ebooks", async (req, res) => {
  try {
    const {
      search,
      genre,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 6,
    } = req.query;
    let query = { status: "published" };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { writerName: { $regex: search, $options: "i" } },
      ];
    }
    if (genre && genre !== "All") query.genre = genre;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price-low") sortOption = { price: 1 };
    if (sort === "price-high") sortOption = { price: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Ebook.countDocuments(query);
    const ebooks = await Ebook.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    res.json({ ebooks, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST Create Ebook
app.post("/api/ebooks", async (req, res) => {
  try {
    const ebook = new Ebook(req.body);
    await ebook.save();
    res.status(201).json(ebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET Single Ebook
app.get("/api/ebooks/:id", async (req, res) => {
  try {
    const ebook = await Ebook.findById(req.params.id);
    if (!ebook) return res.status(404).json({ error: "Ebook not found" });
    res.json(ebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. PUT Update Ebook
app.put("/api/ebooks/:id", async (req, res) => {
  try {
    const ebook = await Ebook.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(ebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. DELETE Ebook
app.delete("/api/ebooks/:id", async (req, res) => {
  try {
    await Ebook.findByIdAndDelete(req.params.id);
    res.json({ message: "Ebook deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== DASHBOARD ROUTES ====================

// Get Dashboard Stats
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const totalEbooks = await Ebook.countDocuments({ status: "published" });
    const totalSold = await Ebook.countDocuments({ sold: true });
    const revenue = await Ebook.aggregate([
      { $match: { sold: true } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);

    res.json({
      totalEbooks,
      totalSold,
      totalRevenue: revenue[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Writer's Ebooks (by email)
app.get("/api/dashboard/writer/ebooks", async (req, res) => {
  try {
    const { writerEmail } = req.query;
    const ebooks = await Ebook.find({ writerEmail: writerEmail });
    res.json(ebooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Users (Admin)
app.get("/api/dashboard/users", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const users = await db.collection("users").find({}).toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Transactions (Admin)
app.get("/api/dashboard/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find({})
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== START SERVER ====================
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

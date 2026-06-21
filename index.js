const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    buyerEmail: { type: String, default: "" },
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
      default: null,
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

const bookmarkSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true },
    ebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ebook",
      required: true,
    },
  },
  { timestamps: true },
);
const Bookmark = mongoose.model("Bookmark", bookmarkSchema);

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

// User's purchased ebooks
app.get("/api/dashboard/user/purchases", async (req, res) => {
  try {
    const { email } = req.query;
    const ebooks = await Ebook.find({ buyerEmail: email, sold: true });
    res.json(ebooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Users (Admin)
// app.get("/api/dashboard/users", async (req, res) => {
//   try {
//     const db = mongoose.connection.db;
//     const users = await db.collection("users").find({}).toArray();
//     res.json(users);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

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

// imgBB Image Upload Route
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append("image", req.file.buffer.toString("base64"));

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      {
        method: "POST",
        body: formData,
      },
    );

    const data = await response.json();

    if (data.success) {
      res.json({ url: data.data.url, display_url: data.data.display_url });
    } else {
      res.status(500).json({ error: "Upload failed" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// purchase complete route (এরকম হওয়া উচিত)
app.post("/api/complete-purchase", async (req, res) => {
  console.log("complete-purchase called, body:", req.body); // debug
  try {
    const { session_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: "No session_id provided" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("Stripe session:", JSON.stringify(session, null, 2)); // debug

    const ebookId = session.metadata?.ebookId;
    const email =
      session.metadata?.userEmail ||
      session.customer_details?.email ||
      "unknown@email.com";
    const amount = session.amount_total / 100;
    const title = session.metadata?.title || "Ebook";

    if (!ebookId) {
      return res.status(400).json({ error: "No ebookId in metadata" });
    }

    // Ebook update
    const updatedEbook = await Ebook.findByIdAndUpdate(
      ebookId,
      {
        sold: true,
        buyerEmail: email,
      },
      { new: true },
    );
    console.log("Updated ebook:", updatedEbook); // debug

    // Transaction save
    const transaction = new Transaction({
      transactionId: session.id,
      type: "purchase",
      userEmail: email,
      ebook: ebookId,
      ebookTitle: title,
      amount: amount,
    });
    await transaction.save();
    console.log("Transaction saved");

    res.json({ success: true, message: "Purchase completed" });
  } catch (err) {
    console.error("❌ Complete Purchase Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// User's purchased ebooks
app.get("/api/dashboard/user/purchases", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.json([]);
    const ebooks = await Ebook.find({ buyerEmail: email, sold: true });
    res.json(ebooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add bookmark
app.post("/api/bookmarks", async (req, res) => {
  try {
    const { email, ebookId } = req.body;
    const exists = await Bookmark.findOne({ userEmail: email, ebookId });
    if (exists) return res.json({ message: "Already bookmarked" });
    const bookmark = new Bookmark({ userEmail: email, ebookId });
    await bookmark.save();
    res.status(201).json({ message: "Bookmarked" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove bookmark
app.delete("/api/bookmarks", async (req, res) => {
  try {
    const { email, ebookId } = req.query;
    await Bookmark.findOneAndDelete({ userEmail: email, ebookId });
    res.json({ message: "Bookmark removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user bookmarks (with full ebook details)
app.get("/api/bookmarks", async (req, res) => {
  try {
    const { email } = req.query;
    const bookmarks = await Bookmark.find({ userEmail: email });
    const ebookIds = bookmarks.map((b) => b.ebookId);
    const ebooks = await Ebook.find({ _id: { $in: ebookIds } });
    res.json(ebooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Writer's sales history
app.get("/api/dashboard/writer/sales", async (req, res) => {
  try {
    const { writerEmail } = req.query;
    if (!writerEmail) return res.json([]);
    const ebooks = await Ebook.find({ writerEmail, sold: true });
    res.json(ebooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/dashboard/users", async (req, res) => {
  try {
    const db = mongoose.connection.db;

    const users = await db.collection("user").find({}).toArray();

    const safeUsers = users.map(({ password, ...user }) => user);
    res.json(safeUsers);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/dashboard/users/role", async (req, res) => {
  try {
    const { email, role } = req.body;
    const db = mongoose.connection.db;
    await db.collection("user").updateOne({ email }, { $set: { role } });
    res.json({ message: "Role updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/dashboard/users", async (req, res) => {
  try {
    const { email } = req.query;
    const db = mongoose.connection.db;
    await db.collection("user").deleteOne({ email });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Temporary debug route
app.get("/api/debug-users", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collNames = collections.map((c) => c.name);

    let userData = [];
    if (collNames.includes("user")) {
      userData = await db.collection("user").find({}).toArray();
    } else if (collNames.includes("users")) {
      userData = await db.collection("users").find({}).toArray();
    }

    res.json({
      database: db.databaseName,
      collections: collNames,
      userCollectionExists:
        collNames.includes("user") || collNames.includes("users"),
      userData: userData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Get all ebooks (published + unpublished)
app.get("/api/admin/ebooks", async (req, res) => {
  try {
    const ebooks = await Ebook.find({}).sort({ createdAt: -1 });
    res.json(ebooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Toggle publish/unpublish
app.put("/api/admin/ebooks/:id/toggle-status", async (req, res) => {
  try {
    const ebook = await Ebook.findById(req.params.id);
    if (!ebook) return res.status(404).json({ error: "Not found" });
    ebook.status = ebook.status === "published" ? "unpublished" : "published";
    await ebook.save();
    res.json(ebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Delete ebook
app.delete("/api/admin/ebooks/:id", async (req, res) => {
  try {
    await Ebook.findByIdAndDelete(req.params.id);
    res.json({ message: "Ebook deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ==================== START SERVER ====================
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

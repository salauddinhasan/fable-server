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



// ==================== START SERVER ====================
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

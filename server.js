const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();

// Your Google API credentials and MongoDB URI (directly in the code)
const API_KEY = "AIzaSyD-8SBN-cSO-lpz0g3LAAJ-fv-SZ3ple8c"; // Your Google API Key
const CX = "35871b5aa4aa7423d"; // Your Custom Search Engine ID (CX)
const MONGO_URI = "mongodb://mongo:vWSnMirLbVJnafAdBvBRkIDfKFMDtsLp@shortline.proxy.rlwy.net:46759"; // Replace with your actual MongoDB URI

// MongoDB setup
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB connection failed:", err));

// Models
const User = mongoose.model("User", new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}));

const SearchHistory = mongoose.model("SearchHistory", new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  query: String,
  date: { type: Date, default: Date.now }
}));

// Middleware
app.use(express.static("public")); // Serve static files (CSS, JS, etc.)
app.use(bodyParser.json());
app.set("view engine", "ejs"); // Set EJS as the view engine

// Authentication Middleware
const authenticate = async (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ error: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, "YOUR_SECRET_KEY");
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(400).json({ error: "Token is not valid" });
  }
};

// Routes

// Home Page Route
app.get("/", (req, res) => {
  res.render("index"); // Render the index.ejs template
});

// Sign Up Route
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  // Check if user exists
  const userExists = await User.findOne({ username });
  if (userExists) return res.status(400).json({ error: "User already exists" });

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create a new user
  const user = new User({ username, password: hashedPassword });
  await user.save();

  res.status(201).json({ message: "User created successfully" });
});

// Login Route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "User not found" });

  // Compare password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

  // Generate JWT token
  const token = jwt.sign({ userId: user._id }, "YOUR_SECRET_KEY", { expiresIn: "1h" });

  res.json({ token });
});

// Search Route
app.get("/search", authenticate, async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing search query" });

  // Save search query to search history
  const searchHistory = new SearchHistory({ userId: req.userId, query });
  await searchHistory.save();

  try {
    // Call Google Custom Search API
    const response = await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: { key: API_KEY, cx: CX, q: query }
    });

    // Send search results
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Search request failed", details: error.response?.data });
  }
});

// Start Server
app.listen(3000, () => console.log("Server running on port 3000"));

const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");
const Paystack = require("paystack-api");

// Load environment variables
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database (stay open, don’t close)
const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) console.error("DB Error: ", err.message);
  else console.log("✅ Connected to SQLite");
});

// Create tables if not exist
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user'
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      price REAL,
      category TEXT,
      image TEXT
    )`
  );

  // Seed admin account if missing
  const adminEmail = "admin@neotech.local";
  const adminPassword = bcrypt.hashSync("admin123", 10);

  db.get("SELECT * FROM users WHERE email = ?", [adminEmail], (err, row) => {
    if (!row) {
      db.run(
        "INSERT INTO users (email, password, role) VALUES (?, ?, ?)",
        [adminEmail, adminPassword, "admin"],
        () => console.log("✅ Admin account ready")
      );
    }
  });
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret123",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(express.static(path.join(__dirname, "public")));

// Paystack Init
const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY);

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Products API
app.get("/api/products", (req, res) => {
  db.all("SELECT * FROM products", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add product (admin only)
app.post("/api/products", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { name, description, price, category, image } = req.body;
  db.run(
    "INSERT INTO products (name, description, price, category, image) VALUES (?, ?, ?, ?, ?)",
    [name, description, price, category, image],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Checkout (Paystack)
app.post("/checkout", async (req, res) => {
  try {
    const { email, amount } = req.body;

    const tx = await paystack.transaction.initialize({
      email,
      amount: amount * 100, // kobo
      callback_url: process.env.BASE_URL + "/success",
    });

    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin dashboard
app.get("/admin/dashboard", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login.html");
  }
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

// Auth routes
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err || !user) return res.status(401).json({ error: "Invalid login" });

    if (bcrypt.compareSync(password, user.password)) {
      req.session.user = user;
      res.json({ success: true, role: user.role });
    } else {
      res.status(401).json({ error: "Invalid login" });
    }
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

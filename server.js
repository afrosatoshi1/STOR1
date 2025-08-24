// server.js
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "neotech_secret",
    resave: false,
    saveUninitialized: true,
  })
);

// Database
const db = new sqlite3.Database("./neotech.db", (err) => {
  if (err) console.error("DB error:", err);
  else console.log("Connected to DB");
});

// Tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    category TEXT,
    description TEXT
  )`);
});

// Routes
// Home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Admin Panel
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

// Register
app.post("/register", (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hashedPassword],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(400).send("User already exists");
      }
      res.status(200).send("Registration successful");
    }
  );
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err || !user) return res.status(400).send("Invalid email or password");

    if (bcrypt.compareSync(password, user.password)) {
      req.session.user = { id: user.id, username: user.username };
      res.status(200).send("Login successful");
    } else {
      res.status(400).send("Invalid email or password");
    }
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Add product (Admin)
app.post("/admin/add-product", (req, res) => {
  const { name, price, category, description } = req.body;

  db.run(
    "INSERT INTO products (name, price, category, description) VALUES (?, ?, ?, ?)",
    [name, price, category, description],
    function (err) {
      if (err) return res.status(400).send("Error adding product");
      res.status(200).send("Product added");
    }
  );
});

// Get products (for frontend)
app.get("/products", (req, res) => {
  db.all("SELECT * FROM products", [], (err, rows) => {
    if (err) return res.status(400).send("Error loading products");
    res.json(rows);
  });
});

app.listen(PORT, () => console.log(`🚀 Running on http://localhost:${PORT}`));

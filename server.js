const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const Paystack = require("paystack-api");

const app = express();
const PORT = process.env.PORT || 3000;

// Paystack init (use your secret key in env)
const paystack = Paystack(process.env.PAYSTACK_SECRET || "sk_test_xxx");

// Middleware
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: true
}));

// DB Setup
const db = new sqlite3.Database("./store.db", (err) => {
  if (err) console.error(err.message);
  else console.log("SQLite connected.");
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    image TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    productId INTEGER,
    status TEXT DEFAULT 'pending'
  )`);
});

// === AUTH ===
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO users (username, password) VALUES (?,?)",
    [username, hashed],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ id: this.lastID, username });
    });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
    if (!row) return res.status(400).json({ error: "Invalid login" });
    if (!bcrypt.compareSync(password, row.password)) {
      return res.status(400).json({ error: "Wrong password" });
    }
    req.session.userId = row.id;
    res.json({ message: "Login success", userId: row.id });
  });
});

// === PRODUCTS ===
app.get("/api/products", (req, res) => {
  db.all("SELECT * FROM products", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/products", (req, res) => {
  const { name, price, image } = req.body;
  db.run("INSERT INTO products (name, price, image) VALUES (?,?,?)",
    [name, price, image],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ id: this.lastID, name, price, image });
    });
});

app.delete("/api/products/:id", (req, res) => {
  db.run("DELETE FROM products WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: "Deleted" });
  });
});

// === CART / ORDER ===
app.post("/api/cart", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Login first" });
  const { productId } = req.body;
  db.run("INSERT INTO orders (userId, productId) VALUES (?,?)",
    [req.session.userId, productId],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ orderId: this.lastID });
    });
});

// === PAYSTACK PAYMENT ===
app.post("/api/pay", async (req, res) => {
  try {
    const { email, amount } = req.body;
    const response = await paystack.transaction.initialize({
      email,
      amount: amount * 100, // kobo
      callback_url: "https://your-site.com/verify"
    });
    res.json(response);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// Admin routes
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

app.listen(PORT, () => console.log(`Server running on ${PORT}`));

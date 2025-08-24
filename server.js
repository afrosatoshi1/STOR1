const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
const db = new sqlite3.Database("./store.db");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: true
}));

// ✅ Create users & carts table
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS carts (id INTEGER PRIMARY KEY, user_id INTEGER, product TEXT, price REAL, qty INTEGER)");
});

// ✅ Register
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  const hashed = bcrypt.hashSync(password, 10);

  db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashed], function(err) {
    if (err) return res.status(400).json({ error: "Username already taken" });
    req.session.userId = this.lastID;
    res.json({ success: true, message: "Registered successfully" });
  });
});

// ✅ Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (!user) return res.status(400).json({ error: "User not found" });
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: "Invalid password" });

    req.session.userId = user.id;
    res.json({ success: true, message: "Logged in" });
  });
});

// ✅ Save cart for logged-in user
app.post("/cart/save", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Login required" });

  const { cart } = req.body;
  db.run("DELETE FROM carts WHERE user_id = ?", [req.session.userId], () => {
    cart.forEach(item => {
      db.run("INSERT INTO carts (user_id, product, price, qty) VALUES (?, ?, ?, ?)",
        [req.session.userId, item.name, item.price, item.qty]);
    });
    res.json({ success: true, message: "Cart saved" });
  });
});

// ✅ Load cart for logged-in user
app.get("/cart/load", (req, res) => {
  if (!req.session.userId) return res.json([]);
  db.all("SELECT product AS name, price, qty FROM carts WHERE user_id = ?", [req.session.userId], (err, rows) => {
    res.json(rows);
  });
});

app.listen(3000, () => console.log("Server running on port 3000"));

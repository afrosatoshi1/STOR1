/**
 * server.js
 * Full backend server:
 * - SQLite (kept open)
 * - Auto-seed (admin + sample products)
 * - Auth: /api/register, /api/login, /api/logout
 * - Products: /api/products (GET), /api/products (POST admin), /api/products/:id (DELETE admin)
 * - Cart: session-based: /api/cart (GET/POST/CLEAR)
 * - Orders: create from cart, admin order listing
 * - Serves public/ and public/admin static files
 */

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'neotech.sqlite');

// Ensure data folder
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));

// Open DB (keep open)
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) console.error('SQLite error:', err);
  else console.log('Connected to SQLite DB:', DB_FILE);
});

// Create tables and seed default data if needed
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    category TEXT DEFAULT '',
    description TEXT DEFAULT '',
    image TEXT DEFAULT '/img/placeholder.png',
    active INTEGER DEFAULT 1,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total INTEGER,
    status TEXT DEFAULT 'PENDING',
    reference TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    qty INTEGER,
    price INTEGER
  )`);

  // seed admin
  const adminEmail = 'admin@neotech.local';
  db.get('SELECT id FROM users WHERE email = ?', [adminEmail], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [adminEmail, hash, 'admin'], function() {
        console.log('Seeded admin:', adminEmail, '/ admin123');
      });
    }
  });

  // seed sample products (only if none exist)
  db.get('SELECT id FROM products LIMIT 1', (err, r) => {
    if (!r) {
      const sample = [
        ['NeoPhone X1', 250000, 'Phones', '6.7” AMOLED, 5G, 128GB', '/img/phone.png'],
        ['Tab Pro 11', 310000, 'Tablets', '11” IPS, 8GB/256GB', '/img/tablet.png'],
        ['UltraBook 14', 890000, 'Computers', 'Core i7, 16GB/512GB SSD', '/img/laptop.png'],
        ['BassPods Wireless', 68000, 'Audio', 'ANC earbuds, 24h battery', '/img/earbuds.png'],
        ['GameBox One S', 420000, 'Gaming', '4K HDR console', '/img/console.png'],
        ['NeoWatch S', 95000, 'Wearables', 'AMOLED, GPS, SpO2', '/img/watch.png']
      ];
      const stmt = db.prepare('INSERT INTO products (name, price, category, description, image) VALUES (?, ?, ?, ?, ?)');
      sample.forEach(p => stmt.run(p));
      stmt.finalize(() => console.log('Seeded sample products.'));
    }
  });
});

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: './data' }),
  secret: process.env.SESSION_SECRET || 'devsecret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Serve static frontend
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

// Helper: check admin
function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ===== AUTH ROUTES =====
// Register
app.post('/api/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email & password required' });
  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, hash, 'customer'], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already in use' });
      return res.status(500).json({ error: err.message });
    }
    // set session
    req.session.user = { id: this.lastID, email, role: 'customer' };
    res.json({ id: this.lastID, email });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email & password required' });
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.user = { id: user.id, email: user.email, role: user.role };
    res.json({ id: user.id, email: user.email, role: user.role });
  });
});

// Logout
app.get('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Get current user
app.get('/api/me', (req, res) => {
  res.json(req.session.user || null);
});

// ===== PRODUCTS =====
// List products (public)
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Admin create product
app.post('/api/products', requireAdmin, (req, res) => {
  const { name, price, category, description, image, active } = req.body;
  db.run('INSERT INTO products (name, price, category, description, image, active) VALUES (?, ?, ?, ?, ?, ?)',
    [name, price || 0, category || '', description || '', image || '/img/placeholder.png', active ? 1 : 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM products WHERE id = ?', [this.lastID], (e, row) => res.json(row));
    });
});

// Admin update product
app.put('/api/products/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const { name, price, category, description, image, active } = req.body;
  db.run('UPDATE products SET name=?, price=?, category=?, description=?, image=?, active=? WHERE id=?',
    [name, price || 0, category || '', description || '', image || '/img/placeholder.png', active ? 1 : 0, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM products WHERE id=?', [id], (e, row) => res.json(row));
    });
});

// Admin delete product
app.delete('/api/products/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM products WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: true });
  });
});

// ===== CART (session) =====
app.get('/api/cart', (req, res) => {
  const cart = req.session.cart || [];
  res.json(cart);
});

app.post('/api/cart', (req, res) => {
  const { productId, qty } = req.body;
  const q = Math.max(1, parseInt(qty || 1, 10));
  db.get('SELECT id, name, price, image FROM products WHERE id = ?', [productId], (err, p) => {
    if (err || !p) return res.status(400).json({ error: 'Invalid product' });
    if (!req.session.cart) req.session.cart = [];
    const existing = req.session.cart.find(it => it.id === p.id);
    if (existing) existing.qty += q;
    else req.session.cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: q });
    res.json(req.session.cart);
  });
});

app.post('/api/cart/clear', (req, res) => {
  req.session.cart = [];
  res.json({ ok: true });
});

// ===== ORDERS =====
// Create order from session cart (must be logged in)
app.post('/api/orders', requireLogin, (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.status(400).json({ error: 'Cart empty' });
  const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
  db.run('INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)', [req.session.user.id, total, 'PENDING'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const orderId = this.lastID;
    const stmt = db.prepare('INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)');
    cart.forEach(i => stmt.run(orderId, i.id, i.qty, i.price));
    stmt.finalize(() => {
      req.session.cart = [];
      res.json({ orderId, total });
    });
  });
});

// Admin: list orders
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  db.all('SELECT * FROM orders ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Admin: update order status
app.put('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// API: current user (again)
app.get('/api/user', (req, res) => {
  res.json(req.session.user || null);
});

// 404 fallback for API
app.use('/api/*', (req, res) => res.status(404).json({ error: 'API endpoint not found' }));

// start
app.listen(PORT, () => console.log(`✅ NeoTech server running on port ${PORT}`));

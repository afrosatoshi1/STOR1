const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'neotech.sqlite');

// Auto-seed
if (!fs.existsSync(DB_FILE)) {
  console.log('➡️  Database not found. Seeding...');
  require('child_process').execSync('node seed.js', { stdio: 'inherit' });
}

// Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: './data' }),
  secret: process.env.SESSION_SECRET || 'defaultsecret',
  resave: false,
  saveUninitialized: false,
}));

// DB
const db = new sqlite3.Database(DB_FILE);

// Helpers
const requireLogin = (req, res, next) => req.session.user ? next() : res.redirect('/login');
const requireAdmin = (req, res, next) => (req.session.user && req.session.user.role === 'admin') ? next() : res.status(403).send('Forbidden');

// Home
app.get('/', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', [], (e, categories) => {
    db.all('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC LIMIT 12', [], (e2, products) => {
      res.render('store/home', { user: req.session.user, categories: categories||[], products: products||[] });
    });
  });
});

// Category
app.get('/category/:id', (req, res) => {
  db.get('SELECT * FROM categories WHERE id=?', [req.params.id], (e, cat) => {
    if (!cat) return res.status(404).send('Category not found');
    db.all('SELECT * FROM products WHERE category_id=? AND active=1 ORDER BY created_at DESC', [req.params.id], (e2, products) => {
      res.render('store/category', { user: req.session.user, category: cat, products: products||[] });
    });
  });
});

// Product
app.get('/product/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id=?', [req.params.id], (e, product) => {
    if (!product) return res.status(404).send('Product not found');
    db.run('UPDATE products SET views = views + 1 WHERE id=?', [req.params.id]);
    db.all('SELECT * FROM products WHERE category_id=? AND id!=? AND active=1 ORDER BY views DESC LIMIT 6',
      [product.category_id, product.id],
      (e2, recs) => res.render('store/product', { user: req.session.user, product, recs: recs||[] }));
  });
});

// Cart
app.post('/cart/add', (req, res) => {
  const { product_id, qty } = req.body;
  const q = Math.max(1, parseInt(qty||1, 10));
  db.get('SELECT id, name, price, image FROM products WHERE id=? AND active=1', [product_id], (e, p) => {
    if (!p) return res.redirect('/');
    if (!req.session.cart) req.session.cart = [];
    const ex = req.session.cart.find(i => i.id === p.id);
    if (ex) ex.qty += q; else req.session.cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: q });
    res.redirect('/cart');
  });
});
app.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  res.render('store/cart', { user: req.session.user, cart, total });
});
app.post('/cart/update', (req, res) => {
  const { id, qty } = req.body;
  if (!req.session.cart) req.session.cart = [];
  req.session.cart = req.session.cart.map(i => i.id == id ? { ...i, qty: Math.max(1, parseInt(qty||1,10)) } : i);
  res.redirect('/cart');
});
app.get('/cart/clear', (req, res) => { req.session.cart = []; res.redirect('/cart'); });

// Auth
app.get('/login', (req,res)=>res.render('auth/login',{ error:null }));
app.post('/login', (req,res)=>{
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email=?',[email],(e,u)=>{
    if(!u) return res.render('auth/login',{ error:'Invalid credentials' });
    if(!require('bcrypt').compareSync(password, u.password)) return res.render('auth/login',{ error:'Invalid credentials' });
    req.session.user = { id: u.id, email: u.email, role: u.role };
    return u.role === 'admin' ? res.redirect('/admin/dashboard') : res.redirect('/');
  });
});
app.get('/register', (req,res)=>res.render('auth/register', { error:null }));
app.post('/register', (req,res)=>{
  const { email, password } = req.body;
  const hash = require('bcrypt').hashSync(password, 10);
  db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, hash, 'customer'], function(err){
    if (err) return res.render('auth/register', { error: 'Email already used' });
    req.session.user = { id: this.lastID, email, role:'customer' };
    res.redirect('/');
  });
});
app.get('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));

// Checkout (Paystack)
app.get('/checkout', requireLogin, (req,res)=>{
  const cart = req.session.cart || [];
  if (!cart.length) return res.redirect('/cart');
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  res.render('store/checkout', { user:req.session.user, cart, total, paystackKey: process.env.PAYSTACK_PUBLIC_KEY || null });
});
app.get('/checkout/verify', requireLogin, async (req,res)=>{
  const ref = req.query.reference;
  if(!ref) return res.redirect('/cart');
  let ok = false;
  if (process.env.PAYSTACK_SECRET_KEY) {
    try {
      const r = await axios.get(`https://api.paystack.co/transaction/verify/${ref}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
      });
      ok = r.data && r.data.data && r.data.data.status === 'success';
    } catch(e){ ok = false; }
  } else {
    ok = true; // demo
  }
  if (!ok) return res.render('store/checkout-result', { ok:false, ref });
  const cart = req.session.cart || [];
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  db.run('INSERT INTO orders (user_id, total, status, reference) VALUES (?, ?, ?, ?)', [req.session.user.id, total, 'PAID', ref], function(err){
    if (err) return res.render('store/checkout-result', { ok:false, ref });
    const orderId = this.lastID;
    const stmt = db.prepare('INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)');
    cart.forEach(i => stmt.run(orderId, i.id, i.qty, i.price));
    stmt.finalize();
    req.session.cart = [];
    res.render('store/checkout-result', { ok:true, ref });
  });
});

// Admin
app.get('/admin/dashboard', requireAdmin, (req,res)=>{
  db.all('SELECT * FROM products ORDER BY id DESC', [], (e, products)=>{
    db.all('SELECT * FROM categories ORDER BY name', [], (e2, categories)=>{
      db.all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 20', [], (e3, orders)=>{
        res.render('admin/dashboard', { user:req.session.user, products, categories, orders });
      });
    });
  });
});
app.post('/admin/products/create', requireAdmin, (req,res)=>{
  const { name, price, category_id, description, image } = req.body;
  db.run('INSERT INTO products (name, price, category_id, description, image, active) VALUES (?, ?, ?, ?, ?, 1)',
    [name, parseInt(price||0,10), category_id, description||'', image||''],
    ()=>res.redirect('/admin/dashboard'));
});
app.post('/admin/products/update/:id', requireAdmin, (req,res)=>{
  const { name, price, category_id, description, image, active } = req.body;
  db.run('UPDATE products SET name=?, price=?, category_id=?, description=?, image=?, active=? WHERE id=?',
    [name, parseInt(price||0,10), category_id, description||'', image||'', active?1:0, req.params.id],
    ()=>res.redirect('/admin/dashboard'));
});
app.get('/admin/products/delete/:id', requireAdmin, (req,res)=>{
  db.run('DELETE FROM products WHERE id=?', [req.params.id], ()=>res.redirect('/admin/dashboard'));
});
app.post('/admin/categories/create', requireAdmin, (req,res)=>{
  const { name } = req.body;
  db.run('INSERT INTO categories (name) VALUES (?)', [name], ()=>res.redirect('/admin/dashboard'));
});
app.post('/admin/categories/update/:id', requireAdmin, (req,res)=>{
  const { name } = req.body;
  db.run('UPDATE categories SET name=? WHERE id=?', [name, req.params.id], ()=>res.redirect('/admin/dashboard'));
});
app.get('/admin/categories/delete/:id', requireAdmin, (req,res)=>{
  db.run('DELETE FROM categories WHERE id=?', [req.params.id], ()=>res.redirect('/admin/dashboard'));
});
app.post('/admin/orders/status/:id', requireAdmin, (req,res)=>{
  const { status } = req.body;
  db.run('UPDATE orders SET status=? WHERE id=?', [status, req.params.id], ()=>res.redirect('/admin/dashboard'));
});

app.use((req,res)=>res.status(404).render('store/404', { user:req.session.user }));

app.listen(PORT, ()=>console.log(`✅ NeoTech Store running on :${PORT}`));

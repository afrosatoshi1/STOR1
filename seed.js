const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'data', 'neotech.sqlite');
if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new sqlite3.Database(dbPath);

db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    category_id INTEGER,
    description TEXT DEFAULT '',
    image TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING',
    reference TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    qty INTEGER,
    price INTEGER,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  // Admin
  const email = 'admin@neotech.local';
  db.get('SELECT * FROM users WHERE email=?', [email], (e,row)=>{
    if(!row){
      const hash = bcrypt.hashSync('admin123', 10);
      db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, hash, 'admin']);
      console.log('✅ Admin seeded:', email, '/ admin123');
    }
  });

  // Categories
  const cats = ['Phones & Tablets','Computers','Audio','Gaming','Wearables'];
  cats.forEach(c => db.run('INSERT INTO categories (name) VALUES (?)',[c]));

  // Products
  const prods = [
    ['NeoPhone X1', 250000, 1, '6.7” AMOLED, 5G, 128GB', '/img/phone.png'],
    ['Tab Pro 11', 310000, 1, '11” IPS, 8GB/256GB', '/img/tablet.png'],
    ['UltraBook 14', 890000, 2, 'Core i7, 16GB/512GB SSD', '/img/laptop.png'],
    ['BassPods Wireless', 68000, 3, 'ANC earbuds, 24h battery', '/img/earbuds.png'],
    ['GameBox One S', 420000, 4, '4K HDR console', '/img/console.png'],
    ['NeoWatch S', 95000, 5, 'AMOLED, GPS, SpO2', '/img/watch.png']
  ];
  prods.forEach(p => db.run('INSERT INTO products (name, price, category_id, description, image) VALUES (?, ?, ?, ?, ?)', p));
});

db.close();

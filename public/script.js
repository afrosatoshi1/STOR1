/* public/js/script.js
   Handles:
   - loading products
   - add to cart
   - cart viewing (simple)
   - login/register modal forms
   - category filtering & search
*/

const state = {
  products: [],
  cart: []
};

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    state.products = await res.json();
    renderProducts(state.products);
  } catch (err) {
    console.error('loadProducts error', err);
  }
}

function renderProducts(products) {
  const grid = document.querySelector('.product-grid');
  if (!grid) return;
  grid.innerHTML = '';
  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${p.image || '/img/placeholder.png'}" alt="${escapeHtml(p.name)}" />
      <h3>${escapeHtml(p.name)}</h3>
      <p class="muted">${escapeHtml(p.description || '')}</p>
      <div class="price">₦${formatNumber(p.price)}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">
        <button class="btn" onclick="addToCart(${p.id})">Add to cart</button>
        <a class="btn" href="/product/${p.id}" style="text-decoration:none">View</a>
      </div>
    `;
    grid.appendChild(card);
  });
}

function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function formatNumber(n){ return Number(n).toLocaleString(); }

// Add to cart (session on server)
async function addToCart(productId) {
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ productId, qty: 1 })
    });
    if (res.ok) {
      const cart = await res.json();
      state.cart = cart;
      alert('Added to cart');
    } else {
      const err = await res.json();
      if (err.error && err.error === 'Not authenticated') {
        alert('Please login first');
        openModal('loginModal');
      } else {
        alert('Failed to add to cart');
      }
    }
  } catch (e) {
    console.error('addToCart error', e);
  }
}

// category filter
function filterCategory(cat) {
  if (!cat || cat === 'all') return renderProducts(state.products);
  const filtered = state.products.filter(p => (p.category||'').toLowerCase().includes(cat.toLowerCase()) || p.name.toLowerCase().includes(cat.toLowerCase()));
  renderProducts(filtered);
}

// search
document.getElementById('searchInput')?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return renderProducts(state.products);
  const filtered = state.products.filter(p => p.name.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q));
  renderProducts(filtered);
});

// modals
function openModal(id){ const m=document.getElementById(id); if(m){ m.style.display='flex'; } }
function closeModal(id){ const m=document.getElementById(id); if(m){ m.style.display='none'; } }

// login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) return alert('Enter email & password');
  try {
    const res = await fetch('/api/login', {
      method:'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      alert('Login successful');
      closeModal('loginModal');
      // reload user state if needed
    } else {
      const err = await res.json();
      alert(err.error || 'Login failed');
    }
  } catch (err) {
    console.error('login error', err);
  }
});

// register
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) return alert('Enter email & password');
  try {
    const res = await fetch('/api/register', {
      method:'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      alert('Registration successful');
      closeModal('registerModal');
    } else {
      const err = await res.json();
      alert(err.error || 'Registration failed');
    }
  } catch (err) {
    console.error('register error', err);
  }
});

// small helpers
function goCart(){ window.location.href = '/cart.html' } // if you have cart page, else implement cart modal

// initialization
document.addEventListener('DOMContentLoaded', () => {
  loadProducts().catch(()=>{});
  document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());
});

// wrapper to allow top-level await on older environments
async function loadProducts(){ await loadProductsImpl(); }
async function loadProductsImpl(){ await loadProductsFetch(); }
async function loadProductsFetch(){ await (async ()=>{ await fetchProducts(); })(); }

// small compatibility functions to fetch and render (kept backward friendly)
async function fetchProducts(){ const res = await fetch('/api/products'); state.products = await res.json(); renderProducts(state.products); }

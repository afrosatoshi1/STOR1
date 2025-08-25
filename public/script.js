// ====================== GLOBAL HELPERS ======================
function $(selector) {
  return document.querySelector(selector);
}
function $all(selector) {
  return document.querySelectorAll(selector);
}

// Handle modals
function openModal(id) {
  document.getElementById(id).style.display = "block";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

// Scroll to products
function scrollToProducts() {
  document.querySelector(".product-grid").scrollIntoView({ behavior: "smooth" });
}

// ====================== AUTH HANDLERS ======================
async function registerUser(e) {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (res.ok) {
    alert("Account created! You can now log in.");
    closeModal("registerModal");
    window.location.href = "/login.html";
  } else {
    alert(data.error || "Registration failed");
  }
}

async function loginUser(e) {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (res.ok) {
    alert("Login successful!");
    localStorage.setItem("user", JSON.stringify(data.user));
    closeModal("loginModal");
    window.location.href = "/";
  } else {
    alert(data.error || "Login failed");
  }
}

function logoutUser() {
  localStorage.removeItem("user");
  window.location.href = "/";
}

// ====================== PRODUCTS ======================
async function loadProducts() {
  const grid = document.querySelector(".product-grid");
  if (!grid) return; // Not on index.html

  try {
    const res = await fetch("/api/products");
    const products = await res.json();

    grid.innerHTML = "";
    products.forEach(p => {
      const div = document.createElement("div");
      div.className = "product-card";
      div.innerHTML = `
        <img src="${p.image}" alt="${p.name}">
        <h4>${p.name}</h4>
        <p>${p.category}</p>
        <p>$${p.price}</p>
        <button onclick="addToCart(${p.id}, '${p.name}', ${p.price}, '${p.image}')">Add to Cart</button>
      `;
      grid.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading products:", err);
  }
}

function filterCategory(category) {
  const cards = $all(".product-card");
  cards.forEach(card => {
    if (category === "all" || card.innerHTML.includes(category)) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

// ====================== CART ======================
function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}
function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}
function addToCart(id, name, price, image) {
  let cart = getCart();
  let item = cart.find(i => i.id === id);
  if (item) {
    item.qty++;
  } else {
    cart.push({ id, name, price, image, qty: 1 });
  }
  saveCart(cart);
  alert("Added to cart!");
}
function renderCart() {
  const container = $("#cartContainer");
  if (!container) return; // not on cart.html
  const cart = getCart();

  container.innerHTML = "";
  let total = 0;

  cart.forEach((item, i) => {
    total += item.price * item.qty;
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img src="${item.image}" width="50">
      <span>${item.name}</span>
      <span>$${item.price}</span>
      <span>Qty: ${item.qty}</span>
      <button onclick="removeFromCart(${i})">Remove</button>
    `;
    container.appendChild(div);
  });

  $("#totalPrice").innerText = "$" + total.toFixed(2);
}
function removeFromCart(index) {
  let cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
}
function goCart() {
  window.location.href = "/cart.html";
}

// ====================== PAGE HOOKS ======================
document.addEventListener("DOMContentLoaded", () => {
  // Update footer year
  if ($("#year")) $("#year").innerText = new Date().getFullYear();

  // Attach forms
  if ($("#registerForm")) $("#registerForm").addEventListener("submit", registerUser);
  if ($("#loginForm")) $("#loginForm").addEventListener("submit", loginUser);

  // Load products if on home
  if ($(".product-grid")) loadProducts();

  // Render cart if on cart page
  if ($("#cartContainer")) renderCart();
});

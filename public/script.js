// Fetch and display products
async function fetchProducts() {
  try {
    const res = await fetch("/api/products");
    const products = await res.json();
    displayProducts(products);
  } catch (err) {
    console.error("Error fetching products:", err);
  }
}

// Render products in grid
function displayProducts(products) {
  const grid = document.querySelector(".product-grid");
  grid.innerHTML = "";
  products.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image || 'https://via.placeholder.com/150'}" alt="${product.name}">
      <h3>${product.name}</h3>
      <p>$${product.price}</p>
      <button onclick="addToCart(${product.id})">Add to Cart</button>
    `;
    grid.appendChild(card);
  });
}

// Add to cart
async function addToCart(productId) {
  try {
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId })
    });
    if (res.ok) {
      alert("Item added to cart!");
    } else {
      alert("Failed to add item to cart.");
    }
  } catch (err) {
    console.error("Error adding to cart:", err);
  }
}

// Filter categories
async function filterCategory(category) {
  try {
    const res = await fetch("/api/products");
    let products = await res.json();
    if (category !== "all") {
      products = products.filter(p => p.category === category);
    }
    displayProducts(products);
  } catch (err) {
    console.error("Error filtering products:", err);
  }
}

// Scroll to product section
function scrollToProducts() {
  document.querySelector(".product-grid").scrollIntoView({ behavior: "smooth" });
}

// ===== MODALS =====
function openModal(id) {
  document.getElementById(id).style.display = "flex";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

// ===== LOGIN =====
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password")
      })
    });
    if (res.ok) {
      alert("Login successful!");
      closeModal("loginModal");
    } else {
      alert("Login failed. Please try again.");
    }
  } catch (err) {
    console.error("Login error:", err);
  }
});

// ===== REGISTER =====
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password")
      })
    });
    if (res.ok) {
      alert("Registration successful!");
      closeModal("registerModal");
    } else {
      alert("Registration failed. Try another username.");
    }
  } catch (err) {
    console.error("Register error:", err);
  }
});

// ===== INIT =====
fetchProducts();

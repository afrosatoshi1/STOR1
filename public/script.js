async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    const products = await res.json();
    const grid = document.querySelector(".product-grid");
    grid.innerHTML = "";

    products.forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <img src="${p.image || "https://via.placeholder.com/150"}" alt="${p.name}">
        <h4>${p.name}</h4>
        <p>₦${p.price}</p>
        <button onclick="addToCart('${p.id}')">Add to Cart</button>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

async function addToCart(id) {
  await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId: id })
  });
  alert("Added to cart!");
}

document.addEventListener("DOMContentLoaded", loadProducts);

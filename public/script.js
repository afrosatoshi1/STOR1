// ---------------- MODAL FUNCTIONS ----------------
function openModal(id) {
  document.getElementById(id).style.display = "block";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

// ---------------- SCROLL ----------------
function scrollToProducts() {
  document.querySelector("main").scrollIntoView({ behavior: "smooth" });
}

// ---------------- DYNAMIC YEAR ----------------
document.getElementById("year").textContent = new Date().getFullYear();

// ---------------- USER SESSION ----------------
let currentUser = null;

async function checkUser() {
  try {
    const res = await fetch("/api/me");
    if (res.ok) {
      currentUser = await res.json();
    } else {
      currentUser = null;
    }
    updateNav();
  } catch (err) {
    currentUser = null;
    updateNav();
  }
}
checkUser();

// ---------------- NAVBAR UPDATE ----------------
function updateNav() {
  const nav = document.querySelector(".nav-right");
  nav.innerHTML = "";
  if (currentUser) {
    const userBtn = document.createElement("button");
    userBtn.className = "btn small";
    userBtn.textContent = currentUser.email;
    userBtn.onclick = () => alert("Logged in as " + currentUser.email);

    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn small";
    logoutBtn.textContent = "Logout";
    logoutBtn.onclick = logout;

    nav.appendChild(userBtn);
    nav.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.className = "btn small";
    loginBtn.textContent = "Login";
    loginBtn.onclick = () => openModal("loginModal");

    const registerBtn = document.createElement("button");
    registerBtn.className = "btn small";
    registerBtn.textContent = "Register";
    registerBtn.onclick = () => openModal("registerModal");

    const cartBtn = document.createElement("button");
    cartBtn.className = "btn small";
    cartBtn.textContent = "🛒 Cart";
    cartBtn.onclick = goCart;

    nav.appendChild(loginBtn);
    nav.appendChild(registerBtn);
    nav.appendChild(cartBtn);
  }
}

// ---------------- LOGOUT ----------------
async function logout() {
  await fetch("/api/logout", { method: "POST" });
  currentUser = null;
  updateNav();
}

// ---------------- REGISTER ----------------
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    alert(data.message);
    if (res.ok) {
      closeModal("registerModal");
      await checkUser();
    }
  } catch (err) {
    alert("Registration failed.");
  }
});

// ---------------- LOGIN ----------------
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "

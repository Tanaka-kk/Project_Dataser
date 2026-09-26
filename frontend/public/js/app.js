const API_BASE = "";

function getSession() {
  const raw = localStorage.getItem("session");
  return raw ? JSON.parse(raw) : null;
}

function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = "/";
    return null;
  }
  return session;
}

function dashboardUrlFor(role) {
  if (role === "admin") return "/admin";
  if (role === "doctor") return "/doctor";
  return "/home";
}

function requireRole(role) {
  const session = requireAuth();
  if (session && session.role !== role) {
    window.location.href = dashboardUrlFor(session.role);
    return null;
  }
  return session;
}

function wireDashboardLink(session) {
  const link = document.getElementById("dashboardLink");
  if (!link || !session) return;
  link.href = dashboardUrlFor(session.role);
  if (session.role === "admin") link.innerHTML = '<i class="bi bi-house-door me-1"></i>Admin Panel';
  if (session.role === "doctor") link.innerHTML = '<i class="bi bi-house-door me-1"></i>Doctor Panel';
}

function logout() {
  localStorage.removeItem("session");
  window.location.href = "/";
}

function showAlert(elId, message, type = "danger") {
  const el = document.getElementById(elId);
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.classList.remove("d-none");
}

function updateThemeIcons(theme) {
  document.querySelectorAll(".theme-toggle-icon").forEach(el => {
    el.className = `theme-toggle-icon bi ${theme === "dark" ? "bi-sun-fill" : "bi-moon-stars-fill"}`;
  });
}

function toggleTheme() {
  const next = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-bs-theme", next);
  localStorage.setItem("theme", next);
  updateThemeIcons(next);
}

updateThemeIcons(document.documentElement.getAttribute("data-bs-theme") || "light");

function isPastDate(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return date < today;
}

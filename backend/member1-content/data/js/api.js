
const IS_SPLIT_DEV =
  location.protocol === "file:" ||
  (["localhost", "127.0.0.1"].includes(location.hostname) && location.port !== "3000");
const API_BASE = IS_SPLIT_DEV ? "http://localhost:3000" : "";

const Auth = {
  get() {
    try { return JSON.parse(localStorage.getItem("gce_auth")) || null; } catch { return null; }
  },
  set(data) {
    try { localStorage.setItem("gce_auth", JSON.stringify(data)); } catch {}
  },
  clear() {
    try { localStorage.removeItem("gce_auth"); } catch {}
  },
  token() { const a = Auth.get(); return a ? a.token : null; },
  user() { const a = Auth.get(); return a ? a.user : null; },
};

async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = Auth.token();
  if (token) headers["Authorization"] = "Bearer " + token;

  let res;
  try {
    res = await fetch(API_BASE + "/api" + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error("Cannot reach the server. Start the backend with `npm start` and open http://localhost:3000");
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && data.error) || "Request failed (" + res.status + ")");
  return data;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showError(el, message) {
  el.innerHTML = '<div class="notice error">' + esc(message) + "</div>";
}

document.addEventListener("DOMContentLoaded", () => {
  const link = document.getElementById("authLink");
  if (!link) return;
  const user = Auth.user();
  link.textContent = user ? user.username : "Login";
});

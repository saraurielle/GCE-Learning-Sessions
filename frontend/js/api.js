/* Shared helpers: talks to the backend API, handles login state, small utilities.
   Loaded first on every page (then js/shell.js builds the layout). */

// Apply the saved theme immediately so the page never flashes the wrong colours.
(function () {
  let t = null;
  try { t = localStorage.getItem("gce_theme"); } catch (e) { /* storage blocked */ }
  if (!t) t = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
})();

// Same server (http://localhost:3000 serving both) -> relative URLs.
// Opened from file:// or a different dev server (e.g. Live Server :5500) -> call the backend on :3000.
// To host the frontend separately, set window.GCE_API_BASE = "https://your-api.example" before this script.
const IS_SPLIT_DEV =
  location.protocol === "file:" ||
  (["localhost", "127.0.0.1"].includes(location.hostname) && location.port !== "3000");
const API_BASE = typeof window.GCE_API_BASE === "string" ? window.GCE_API_BASE : IS_SPLIT_DEV ? "http://localhost:3000" : "";

// Are we inside /pages/ ? Links to other pages are built from this.
const IN_PAGES = location.pathname.includes("/pages/");
const appHref = (rel) => (IN_PAGES ? "../" : "") + rel; // rel is relative to the frontend root, e.g. "pages/quiz.html"

const Auth = {
  get() {
    try { return JSON.parse(localStorage.getItem("gce_auth")) || null; } catch { return null; }
  },
  set(data) {
    try { localStorage.setItem("gce_auth", JSON.stringify(data)); } catch {}
  },
  clear() {
    try { localStorage.removeItem("gce_auth"); sessionStorage.removeItem("gce_stats"); } catch {}
  },
  token() { const a = Auth.get(); return a ? a.token : null; },
  user() { const a = Auth.get(); return a ? a.user : null; },
  /** Keep the token, replace the cached profile (after editing it or refreshing from /auth/me). */
  setUser(user) { const a = Auth.get(); if (a) Auth.set({ ...a, user }); },
};

/** Calls the API. Throws an Error with .status when the request fails. */
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
    const err = new Error("Cannot reach the server. Start the backend with `npm start` and open http://localhost:3000");
    err.status = 0;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && token) { Auth.clear(); } // expired or invalid login
    const err = new Error((data && data.error) || "Request failed (" + res.status + ")");
    err.status = res.status;
    throw err;
  }
  return data;
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function showError(el, message) {
  el.innerHTML = '<div class="notice error" role="alert">' + esc(message) + "</div>";
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const plural = (n, word, many) => `${n} ${n === 1 ? word : many || word + "s"}`;

function timeAgo(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago";
  if (s < 604800) return Math.round(s / 86400) + " d ago";
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}

/** Page for an "expired login" or "log in to use this" message. */
function nextParam() { return encodeURIComponent(location.pathname.split("/").pop() + location.search); }
function loginPrompt(el, message, title = "Log in to continue") {
  el.innerHTML = `<div class="sheet empty"><span class="tile-ico">${Icons.user}</span><h3>${esc(title)}</h3><p>${esc(message)}</p>` +
    `<a class="btn" href="${appHref("pages/login.html")}?next=${nextParam()}">Log in or register</a></div>`;
}

/** Turns plain text into safe HTML: escapes it, links http(s) URLs and highlights @mentions. */
function richText(text, { mentions = [], me = "" } = {}) {
  let html = esc(text);
  html = html.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) =>
    `<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>`);
  const known = new Set(mentions.map((m) => m.toLowerCase()));
  html = html.replace(/(^|[^A-Za-z0-9_.-])@([A-Za-z0-9_.-]{3,20})/g, (all, pre, name) => {
    const clean = name.replace(/[._-]+$/, "");
    if (!known.has(clean.toLowerCase())) return all;
    const isMe = me && clean.toLowerCase() === me.toLowerCase();
    return `${pre}<span class="men${isMe ? " me" : ""}">@${clean}</span>${name.slice(clean.length)}`;
  });
  return html;
}

// Inline icon set (Lucide-style strokes). Use as `${Icons.bell}` inside template strings.
const ICON_PATHS = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  calendar: '<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="m9 16 2 2 4-4"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  reply: '<path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
};
const Icons = Object.fromEntries(Object.entries(ICON_PATHS).map(([k, v]) =>
  [k, `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${v}</svg>`]));

/* App shell: top bar (search, streak, notifications, account), sidebar, toasts, theme.
   Pages only contain their own <main class="container">; set <body data-nav="quiz"> to highlight
   the matching sidebar item. Needs js/api.js loaded first. */

const NAV_ITEMS = [
  ["home", "index.html", "home", "Home"],
  ["papers", "pages/subjects.html", "book", "Past papers"],
  ["quiz", "pages/quiz.html", "pencil", "Quizzes"],
  ["daily", "pages/daily.html", "calendar", "Daily challenge"],
  ["chat", "pages/chat.html", "chat", "Community"],
  ["leaderboard", "pages/leaderboard.html", "trophy", "Leaderboard"],
  ["saved", "pages/saved.html", "bookmark", "Saved questions"],
  ["progress", "pages/progress.html", "chart", "My progress"],
];
const NOTIF_ICONS = { welcome: "👋", badge: "🏅", level: "🚀", streak: "🔥", mention: "💬", reply: "↩️", announcement: "📣", reminder: "⏰" };
const CAP_LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><polygon points="16,5 30,12 16,19 2,12" fill="currentColor"/><path d="M8 16.5v5.5c0 3 16 3 16 0v-5.5l-8 4z" fill="var(--blue)"/><line x1="28" y1="13" x2="28" y2="21" stroke="var(--red)" stroke-width="2" stroke-linecap="round"/></svg>';

/* ---------- toasts ---------- */
function toast(title, { body = "", icon = "✅", link = "", ms = 5500 } = {}) {
  let box = document.querySelector(".toasts");
  if (!box) {
    box = document.createElement("div");
    box.className = "toasts";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    document.body.appendChild(box);
  }
  const el = document.createElement(link ? "a" : "div");
  el.className = "toast";
  if (link) el.href = link;
  el.innerHTML = `<span class="t-ico" aria-hidden="true">${esc(icon)}</span><div><b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ""}</div>`;
  box.appendChild(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 260); };
  setTimeout(close, ms);
  el.addEventListener("click", () => { if (!link) close(); });
}

/** Shows what a quiz/paper/daily result earned: XP, level-ups, new badges. */
function celebrate(progress) {
  if (!progress) return;
  if (progress.levelUp) toast(`Level ${progress.levelUp} reached`, { icon: "🚀", body: `${progress.xp} XP so far` });
  (progress.newBadges || []).forEach((b) => toast(`Badge unlocked: ${b.name}`, { icon: b.icon, body: b.description }));
  Shell.loadStats(true);
}

/* ---------- shell ---------- */
const Shell = {
  unread: 0,
  notifs: [],

  async loadStats(force = false) {
    if (!Auth.token()) return null;
    try {
      const cached = JSON.parse(sessionStorage.getItem("gce_stats") || "null");
      if (!force && cached && Date.now() - cached.at < 60000) { Shell.paintStreak(cached.data); return cached.data; }
    } catch (e) { /* ignore */ }
    try {
      const data = await api("/stats/me");
      try { sessionStorage.setItem("gce_stats", JSON.stringify({ at: Date.now(), data })); } catch (e) { /* ignore */ }
      Shell.paintStreak(data);
      window.dispatchEvent(new CustomEvent("gce:stats", { detail: data }));
      return data;
    } catch (e) { return null; }
  },

  paintStreak(stats) {
    const chip = document.getElementById("streakChip");
    if (!chip || !stats) return;
    const n = stats.streak.current;
    chip.hidden = false;
    chip.innerHTML = `${Icons.flame}<span>${plural(n, "day")}</span>`;
    chip.title = n ? `${plural(n, "day")} streak. ${stats.streak.activeToday ? "Done for today!" : "Study today to keep it."}` : "Start a streak: study today";
    chip.setAttribute("aria-label", chip.title);
  },

  setUnread(n) {
    Shell.unread = Math.max(0, n);
    const dot = document.getElementById("bellDot");
    if (!dot) return;
    dot.hidden = Shell.unread === 0;
    dot.textContent = Shell.unread > 99 ? "99+" : Shell.unread;
    document.getElementById("bellBtn").setAttribute("aria-label", Shell.unread ? `Notifications, ${Shell.unread} unread` : "Notifications");
  },

  renderNotifs() {
    const list = document.getElementById("notifList");
    if (!list) return;
    list.innerHTML = Shell.notifs.length
      ? Shell.notifs.map(notifHtml).join("")
      : '<div class="empty" style="padding:28px 16px"><p style="margin:0">Nothing new. Badges, replies and reminders will show up here.</p></div>';
  },

  async loadNotifs() {
    try {
      const data = await api("/notifications?limit=8");
      Shell.notifs = data.items;
      Shell.setUnread(data.unread);
      Shell.renderNotifs();
    } catch (e) { /* the bell just stays empty */ }
  },
};

function notifHtml(n) {
  return `<button type="button" class="notif${n.read ? "" : " unread"}" data-id="${esc(n.id)}" data-link="${esc(n.link)}">` +
    `<span class="n-ico" aria-hidden="true">${NOTIF_ICONS[n.type] || "🔔"}</span>` +
    `<span><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ""}<time datetime="${esc(n.createdAt)}">${esc(timeAgo(n.createdAt))}</time></span></button>`;
}

/** Opens a notification's page (links are relative to the frontend root). */
function openNotification(id, link) {
  api(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }).catch(() => {});
  if (link) location.href = appHref(link);
}

/* live notifications over Server-Sent Events, with slow reconnect and login check */
let notifSource = null, notifRetry = 3000;
function connectNotifications() {
  const token = Auth.token();
  if (!token || notifSource) return;
  notifSource = new EventSource(API_BASE + "/api/notifications/stream?token=" + encodeURIComponent(token));
  notifSource.addEventListener("ready", (e) => { notifRetry = 3000; Shell.setUnread(JSON.parse(e.data).unread); });
  notifSource.addEventListener("notification", (e) => {
    const n = JSON.parse(e.data);
    Shell.notifs = [n, ...Shell.notifs].slice(0, 8);
    Shell.setUnread(Shell.unread + 1);
    Shell.renderNotifs();
    toast(n.title, { body: n.body, icon: NOTIF_ICONS[n.type] || "🔔", link: n.link ? appHref(n.link) : "" });
    window.dispatchEvent(new CustomEvent("gce:notification", { detail: n }));
  });
  notifSource.onerror = async () => {
    notifSource.close();
    notifSource = null;
    try { await api("/auth/me"); } catch (e) { if (e.status === 401) return; } // logged out: stop trying
    if (!Auth.token()) return;
    setTimeout(connectNotifications, notifRetry);
    notifRetry = Math.min(notifRetry * 2, 30000);
  };
}

function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("gce_theme", t); } catch (e) { /* ignore */ }
  const b = document.getElementById("themeBtn");
  if (b) { b.innerHTML = t === "dark" ? Icons.sun : Icons.moon; b.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme"); }
}

function logout() {
  if (notifSource) { notifSource.close(); notifSource = null; }
  Auth.clear();
  location.href = appHref("index.html");
}

/* ---------- search box ---------- */
function setupSearch(box) {
  const input = box.querySelector("input");
  const pop = document.createElement("div");
  pop.className = "pop search-pop";
  pop.hidden = true;
  pop.setAttribute("role", "listbox");
  box.appendChild(pop);
  let sel = -1;

  const hits = () => $$(".hit", pop);
  const mark = () => hits().forEach((h, i) => h.classList.toggle("sel", i === sel));
  const close = () => { pop.hidden = true; sel = -1; };

  const run = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) return close();
    try {
      const r = await api("/search?q=" + encodeURIComponent(q));
      if (input.value.trim() !== q) return; // a newer search is already running
      const parts = [];
      if (r.subjects.length) {
        parts.push('<div class="hit-group">Subjects</div>' + r.subjects.map((s) =>
          `<a class="hit" role="option" href="${appHref("pages/papers.html")}?subject=${encodeURIComponent(s.id)}"><span class="tile-ico" style="width:36px;height:36px;font-size:17px">${esc(s.icon)}</span><span><b>${esc(s.name)}</b><small>Past papers</small></span></a>`).join(""));
      }
      if (r.questions.length) {
        parts.push('<div class="hit-group">Past paper questions</div>' + r.questions.map((x) =>
          `<a class="hit" role="option" href="${appHref("pages/learning.html")}?subject=${encodeURIComponent(x.subjectId)}&year=${x.year}&paper=${x.paper}#q${x.index + 1}"><span class="tile-ico" style="width:36px;height:36px;font-size:17px">${esc(x.subjectIcon)}</span><span><b>${esc(x.prompt)}</b><small>${esc(x.subjectName)}, ${x.year} paper ${x.paper}, ${esc(x.title.toLowerCase())}</small></span></a>`).join(""));
      }
      pop.innerHTML = parts.join("") || `<div class="empty" style="padding:22px 16px"><p style="margin:0">No past paper matches “${esc(q)}”. Try a shorter word.</p></div>`;
      pop.hidden = false;
      sel = -1;
    } catch (e) { close(); }
  }, 220);

  input.addEventListener("input", run);
  input.addEventListener("focus", () => { if (pop.innerHTML && input.value.trim().length >= 2) pop.hidden = false; });
  input.addEventListener("keydown", (e) => {
    const list = hits();
    if (e.key === "Escape") { close(); input.blur(); }
    else if (e.key === "ArrowDown" && list.length) { e.preventDefault(); sel = (sel + 1) % list.length; mark(); list[sel].scrollIntoView({ block: "nearest" }); }
    else if (e.key === "ArrowUp" && list.length) { e.preventDefault(); sel = (sel - 1 + list.length) % list.length; mark(); list[sel].scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter" && list.length) { e.preventDefault(); (list[sel] || list[0]).click(); }
  });
  document.addEventListener("click", (e) => { if (!box.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      e.preventDefault(); input.focus();
    }
  });
}

/* ---------- build the layout around the page ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const user = Auth.user();
  const active = document.body.dataset.nav || "";

  const content = document.createElement("div");
  content.className = "content";
  [...document.body.children].filter((n) => n.tagName !== "SCRIPT").forEach((n) => content.appendChild(n));

  const side = document.createElement("nav");
  side.className = "side";
  side.id = "sideNav";
  side.setAttribute("aria-label", "Main");
  side.innerHTML = NAV_ITEMS.map(([id, href, icon, label]) =>
    `<a class="nav-item${id === active ? " on" : ""}" href="${appHref(href)}"${id === active ? ' aria-current="page"' : ""}>${Icons[icon]}${label}</a>`).join("") +
    `<hr><a class="nav-item${active === "profile" ? " on" : ""}" href="${appHref(user ? "pages/profile.html" : "pages/login.html")}">${Icons.user}${user ? "My account" : "Log in"}</a>` +
    (user ? `<a class="nav-item" href="#" id="logoutLink">${Icons.logout}Log out</a>` : "");

  const body = document.createElement("div");
  body.className = "body";
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  body.append(side, content, scrim);

  const top = document.createElement("header");
  top.className = "topbar";
  top.innerHTML =
    `<button type="button" class="iconbtn menu-btn" id="menuBtn" aria-label="Open menu" aria-controls="sideNav">${Icons.menu}</button>` +
    `<a class="brand" href="${appHref("index.html")}">${CAP_LOGO}<span>GCE Learning</span></a>` +
    `<div class="searchbox">${Icons.search}<input type="search" placeholder="Search past paper questions" aria-label="Search past paper questions" autocomplete="off"><kbd aria-hidden="true">/</kbd></div>` +
    `<div class="top-actions">` +
    `<a class="streak-chip" id="streakChip" href="${appHref("pages/progress.html")}" hidden></a>` +
    `<button type="button" class="iconbtn" id="themeBtn"></button>` +
    (user
      ? `<div style="position:relative"><button type="button" class="iconbtn" id="bellBtn" aria-haspopup="true" aria-expanded="false" aria-label="Notifications">${Icons.bell}<span class="dot" id="bellDot" hidden></span></button>` +
        `<div class="pop notif-pop" id="notifPop" hidden><div class="pop-head">Notifications<button type="button" id="readAllBtn">Mark all as read</button></div><div class="pop-list" id="notifList"></div><a class="pop-foot" href="${appHref("pages/notifications.html")}">See all notifications</a></div></div>` +
        `<a class="userchip" id="authLink" href="${appHref("pages/profile.html")}" aria-label="My account"><span class="avatar sm">${esc(user.avatar || "🎓")}</span><span class="nm">${esc(user.username)}</span></a>`
      : `<a class="login-link" id="authLink" href="${appHref("pages/login.html")}?next=${nextParam()}">Log in</a>`) +
    `</div>`;

  document.body.prepend(body);
  document.body.prepend(top);
  setTheme(document.documentElement.getAttribute("data-theme"));
  setupSearch(top.querySelector(".searchbox"));

  // events
  const toggleNav = (open) => { document.body.classList.toggle("nav-open", open); document.getElementById("menuBtn").setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
  document.getElementById("menuBtn").addEventListener("click", () => toggleNav(!document.body.classList.contains("nav-open")));
  scrim.addEventListener("click", () => toggleNav(false));
  side.addEventListener("click", (e) => { if (e.target.closest("a")) toggleNav(false); });
  document.getElementById("themeBtn").addEventListener("click", () =>
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  const lo = document.getElementById("logoutLink");
  if (lo) lo.addEventListener("click", (e) => { e.preventDefault(); logout(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { toggleNav(false); closeBell(); } });

  if (!user) return;

  // notification bell
  const pop = document.getElementById("notifPop"), bell = document.getElementById("bellBtn");
  function closeBell() { if (pop) { pop.hidden = true; bell.setAttribute("aria-expanded", "false"); } }
  bell.addEventListener("click", () => {
    pop.hidden = !pop.hidden;
    bell.setAttribute("aria-expanded", String(!pop.hidden));
    if (!pop.hidden) Shell.loadNotifs();
  });
  document.addEventListener("click", (e) => { if (!pop.contains(e.target) && !bell.contains(e.target)) closeBell(); });
  pop.addEventListener("click", (e) => {
    const item = e.target.closest(".notif");
    if (item) openNotification(item.dataset.id, item.dataset.link);
  });
  document.getElementById("readAllBtn").addEventListener("click", async () => {
    try {
      await api("/notifications/read-all", { method: "POST" });
      Shell.notifs.forEach((n) => { n.read = true; });
      Shell.setUnread(0); Shell.renderNotifs();
      window.dispatchEvent(new CustomEvent("gce:notifications-read"));
    } catch (err) { toast("Could not update notifications", { icon: "⚠️", body: err.message }); }
  });

  // refresh the cached profile (avatar, admin flag), then load streak + notifications
  api("/auth/me").then((r) => { Auth.setUser(r.user); })
    .catch((e) => { if (e.status === 401) location.reload(); });
  Shell.loadStats();
  Shell.loadNotifs();
  connectNotifications();
});

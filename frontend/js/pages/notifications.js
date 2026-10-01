(async () => {
  const view = $("#view");
  if (!Auth.token()) { $(".page-head .flex").remove(); return loginPrompt(view, "Notifications appear here once you have an account.", "Log in to see notifications"); }
  let items = [], filter = "all";

  const paint = () => {
    const shown = filter === "unread" ? items.filter((n) => !n.read) : items;
    if (!shown.length) {
      view.innerHTML = `<div class="sheet empty"><span class="tile-ico">${Icons.bell}</span><h3>${filter === "unread" ? "You are all caught up" : "No notifications yet"}</h3><p>Badges, replies, mentions and streak reminders will show up here.</p></div>`;
      return;
    }
    view.innerHTML = `<div class="sheet flush list">${shown.map((n) =>
      `<div data-id="${esc(n.id)}" data-link="${esc(n.link)}"><span class="n-ico" style="font-size:24px;width:34px;text-align:center" aria-hidden="true">${NOTIF_ICONS[n.type] || "🔔"}</span>` +
      `<div class="grow"><b>${esc(n.title)}</b>${n.read ? "" : ' <span class="chip red" style="height:20px;font-size:11px">New</span>'}${n.body ? `<p>${esc(n.body)}</p>` : ""}<p><time datetime="${esc(n.createdAt)}">${esc(timeAgo(n.createdAt))}</time></p></div>` +
      `${n.link ? `<button type="button" class="btn sm outline" data-open>Open</button>` : ""}${n.read ? "" : `<button type="button" class="btn sm ghost" data-read>Mark read</button>`}<button type="button" class="iconbtn" data-del aria-label="Delete notification">${Icons.trash}</button></div>`).join("")}</div>`;
  };

  async function load() {
    try { const d = await api("/notifications?limit=100"); items = d.items; Shell.setUnread(d.unread); paint(); }
    catch (err) { if (err.status === 401) loginPrompt(view, "Your session expired. Log in again.", "Session expired"); else showError(view, err.message); }
  }

  view.addEventListener("click", async (e) => {
    const row = e.target.closest("[data-id]"); if (!row) return;
    const n = items.find((x) => x.id === row.dataset.id); if (!n) return;
    try {
      if (e.target.closest("[data-open]")) { openNotification(n.id, n.link); }
      else if (e.target.closest("[data-read]")) { const r = await api(`/notifications/${encodeURIComponent(n.id)}/read`, { method: "POST" }); n.read = true; Shell.setUnread(r.unread); paint(); }
      else if (e.target.closest("[data-del]")) { const r = await api("/notifications/" + encodeURIComponent(n.id), { method: "DELETE" }); items = items.filter((x) => x !== n); Shell.setUnread(r.unread); paint(); }
    } catch (err) { toast("Something went wrong", { icon: "⚠️", body: err.message }); }
  });

  $$("[data-filter]").forEach((b) => b.addEventListener("click", () => {
    filter = b.dataset.filter; $$("[data-filter]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); paint();
  }));
  $("#readAll").addEventListener("click", async () => {
    try { await api("/notifications/read-all", { method: "POST" }); items.forEach((n) => { n.read = true; }); Shell.setUnread(0); paint(); }
    catch (err) { toast("Could not update", { icon: "⚠️", body: err.message }); }
  });
  $("#clearAll").addEventListener("click", async () => {
    if (!items.length || !confirm("Delete all notifications?")) return;
    try { await api("/notifications", { method: "DELETE" }); items = []; Shell.setUnread(0); paint(); }
    catch (err) { toast("Could not clear", { icon: "⚠️", body: err.message }); }
  });
  window.addEventListener("gce:notification", load);

  await load();

  const me = Auth.user();
  if (me && me.isAdmin) {
    $("#admin").innerHTML = `<section class="sheet mt-l"><h2>Send an announcement</h2><p class="muted" style="margin-bottom:14px">Every registered user is notified instantly.</p><form id="annForm" novalidate>` +
      `<label class="field"><span>Title</span><input class="input" name="title" maxlength="100" required></label>` +
      `<label class="field"><span>Message (optional)</span><textarea class="textarea" name="body" rows="2" maxlength="240"></textarea></label>` +
      `<label class="field"><span>Opens</span><select class="select" name="link"><option value="">Nothing</option><option value="index.html">Home</option><option value="pages/daily.html">Daily challenge</option><option value="pages/quiz.html">Quizzes</option><option value="pages/chat.html">Community</option><option value="pages/leaderboard.html">Leaderboard</option></select></label>` +
      `<div id="annMsg"></div><button class="btn" type="submit">Send to everyone</button></form></section>`;
    $("#annForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, btn = $("button", f), out = $("#annMsg");
      btn.disabled = true; out.innerHTML = "";
      try {
        const r = await api("/notifications/announce", { method: "POST", body: { title: f.elements.title.value, body: f.elements.body.value, link: f.elements.link.value } });
        out.innerHTML = `<div class="notice">Sent to ${plural(r.sent, "user")}.</div>`; f.reset();
      } catch (err) { showError(out, err.message); }
      btn.disabled = false;
    });
  }
})();

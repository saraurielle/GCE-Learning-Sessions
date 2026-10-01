/* Community chat: rooms, live messages (SSE), replies, reactions, edit/delete, typing, mentions. */
(() => {
  const EMOJIS = ["👍", "❤️", "😂", "🎉", "🤔"];
  const me = Auth.user();
  const isAdmin = Boolean(me && me.isAdmin);
  const root = $("#chatRoot");
  const state = { rooms: [], room: null, msgs: [], source: null, replyTo: null, editing: null, typers: new Map(), atBottom: true, hasMore: false };
  let typingSentAt = 0, sourceRetry = 0;

  const params = new URLSearchParams(location.search);
  const roomName = (id) => (state.rooms.find((r) => r.id === id) || { name: id }).name;

  function layout() {
    root.innerHTML =
      `<div class="chat-shell"><aside class="sheet rooms" aria-label="Rooms" id="rooms"></aside>` +
      `<section class="sheet chat-main" aria-label="Conversation"><div class="chat-top"><h2 id="roomTitle" style="margin:0"></h2><span class="status" id="status">Connecting</span></div>` +
      `<div class="messages" id="messages" role="log" aria-live="polite" aria-relevant="additions"></div>` +
      `<div class="typing" id="typing" aria-live="polite"></div>` +
      `<div class="composer" id="composer"></div></section></div>`;
  }

  function renderRooms() {
    $("#rooms").innerHTML = state.rooms.map((r) =>
      `<button type="button" class="room" data-room="${esc(r.id)}"${r.id === state.room ? ' aria-current="true"' : ""}><span class="ri">${esc(r.icon)}</span><span>${esc(r.name)}</span>${r.online ? `<span class="on" title="${r.online} online">● ${r.online}</span>` : ""}</button>`).join("");
  }

  function renderComposer() {
    const c = $("#composer");
    if (!me) {
      c.innerHTML = `<p class="muted" style="margin:0">You can read along as a guest. <a href="${appHref("pages/login.html")}?next=${nextParam()}"><b>Log in</b></a> to join the conversation.</p>`;
      return;
    }
    c.innerHTML =
      `<div id="replying"></div><div class="composer-row"><textarea class="textarea" id="msgInput" rows="1" maxlength="500" placeholder="Write a message. Use @name to mention someone" aria-label="Message"></textarea>` +
      `<button type="button" class="btn" id="sendBtn" aria-label="Send">${Icons.send}<span class="sr">Send</span></button></div>` +
      `<div class="hint"><span id="chatErr" class="err"></span><span id="counter">0/500</span></div>`;
  }

  /* ---------- messages ---------- */
  function dayLabel(iso) {
    const d = new Date(iso), t = new Date();
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, t)) return "Today";
    const y = new Date(t); y.setDate(t.getDate() - 1);
    if (same(d, y)) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  }

  function msgHtml(m) {
    const mine = me && m.userId === me.id;
    const tagged = me && (m.mentions || []).some((x) => x.toLowerCase() === me.username.toLowerCase());
    const reacts = Object.entries(m.reactions || {}).map(([e, ids]) =>
      `<button type="button" class="react${me && ids.includes(me.id) ? " mine" : ""}" data-react="${esc(e)}" aria-label="${esc(e)} ${ids.length}" aria-pressed="${Boolean(me && ids.includes(me.id))}">${esc(e)} ${ids.length}</button>`).join("");
    const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const tools = me
      ? `<div class="tools" role="toolbar" aria-label="Message actions"><span class="emoji-row">${EMOJIS.map((e) => `<button type="button" data-react="${e}" aria-label="React ${e}">${e}</button>`).join("")}</span>` +
        `<button type="button" data-act="emoji" aria-label="Add reaction">${Icons.smile}</button><button type="button" data-act="reply" aria-label="Reply">${Icons.reply}</button>` +
        (mine ? `<button type="button" data-act="edit" aria-label="Edit">${Icons.pencil}</button>` : "") +
        (mine || isAdmin ? `<button type="button" data-act="delete" aria-label="Delete">${Icons.trash}</button>` : "") + `</div>`
      : "";
    return `<div class="msg${mine ? " mine" : ""}${tagged ? " tagged" : ""}" data-id="${esc(m.id)}"><span class="avatar sm">${esc(m.avatar || "🎓")}</span>` +
      `<div class="bubble"><div class="meta"><strong>${esc(m.username)}</strong><time datetime="${esc(m.createdAt)}">${esc(time)}</time>${m.editedAt ? '<span class="edited">edited</span>' : ""}</div>` +
      (m.replyTo ? `<div class="quote"><b>${esc(m.replyTo.username)}</b> ${esc(m.replyTo.text)}</div>` : "") +
      `<div class="text">${richText(m.text, { mentions: m.mentions || [], me: me ? me.username : "" })}</div>` +
      `<div class="reacts">${reacts}</div></div>${tools}</div>`;
  }

  function renderAll(keepScroll) {
    const box = $("#messages");
    let html = state.hasMore ? `<button type="button" class="btn sm outline load-more" id="moreBtn">Load earlier messages</button>` : "";
    if (!state.msgs.length) html += `<div class="empty"><span class="tile-ico">${Icons.chat}</span><h3>No messages yet</h3><p>Be the first to say something in ${esc(roomName(state.room))}.</p></div>`;
    let last = "";
    state.msgs.forEach((m) => {
      const d = new Date(m.createdAt).toDateString();
      if (d !== last) { html += `<div class="day"><span>${esc(dayLabel(m.createdAt))}</span></div>`; last = d; }
      html += msgHtml(m);
    });
    html += `<button type="button" class="btn sm jump" id="jumpBtn">${Icons.arrowDown} New messages</button>`;
    const prevH = box.scrollHeight, prevT = box.scrollTop;
    box.innerHTML = html;
    if (keepScroll) box.scrollTop = box.scrollHeight - prevH + prevT;
    else box.scrollTop = box.scrollHeight;
  }

  function replaceMsg(m) {
    const el = $(`.msg[data-id="${CSS.escape(m.id)}"]`, $("#messages"));
    if (el) el.outerHTML = msgHtml(m);
  }

  function appendMsg(m) {
    const box = $("#messages");
    const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 80 || (me && m.userId === me.id);
    const empty = $(".empty", box); if (empty) empty.remove();
    const jump = $("#jumpBtn", box);
    const lastMsg = state.msgs[state.msgs.length - 2];
    let html = "";
    if (!lastMsg || new Date(lastMsg.createdAt).toDateString() !== new Date(m.createdAt).toDateString()) html += `<div class="day"><span>${esc(dayLabel(m.createdAt))}</span></div>`;
    jump.insertAdjacentHTML("beforebegin", html + msgHtml(m));
    if (stick) box.scrollTop = box.scrollHeight; else jump.classList.add("show");
  }

  /* ---------- loading + live connection ---------- */
  async function openRoom(id, { push = true } = {}) {
    if (state.source) { state.source.close(); state.source = null; }
    state.room = id; state.replyTo = null; state.editing = null; state.typers.clear(); state.msgs = [];
    if (push) history.replaceState(null, "", "?room=" + encodeURIComponent(id));
    $("#roomTitle").textContent = roomName(id);
    renderRooms(); renderComposer(); renderTyping();
    $("#messages").innerHTML = '<span class="skeleton row"></span><span class="skeleton row"></span>';
    try {
      const list = await api(`/chat/${encodeURIComponent(id)}/messages?limit=50`);
      if (state.room !== id) return;
      state.msgs = list; state.hasMore = list.length === 50;
      renderAll(false);
    } catch (err) { showError($("#messages"), err.message); }
    connect(id);
    const hash = location.hash.slice(1);
    if (hash) { const t = $(`.msg[data-id="${CSS.escape(hash)}"]`); if (t) t.scrollIntoView({ block: "center" }); }
  }

  function setStatus(live) {
    const s = $("#status"); if (!s) return;
    s.classList.toggle("live", live);
    s.textContent = live ? "Live" : "Reconnecting";
  }

  function connect(id) {
    const es = new EventSource(`${API_BASE}/api/chat/${encodeURIComponent(id)}/stream`);
    state.source = es;
    es.onopen = () => { setStatus(true); sourceRetry = 0; };
    es.onerror = () => { setStatus(false); };
    es.addEventListener("chat", (e) => {
      const m = JSON.parse(e.data);
      if (state.msgs.some((x) => x.id === m.id)) return;
      state.msgs.push(m); state.typers.delete(m.username); renderTyping(); appendMsg(m);
    });
    es.addEventListener("edit", (e) => {
      const d = JSON.parse(e.data), m = state.msgs.find((x) => x.id === d.id);
      if (m) { Object.assign(m, d); replaceMsg(m); }
    });
    es.addEventListener("delete", (e) => {
      const d = JSON.parse(e.data);
      state.msgs = state.msgs.filter((x) => x.id !== d.id);
      const el = $(`.msg[data-id="${CSS.escape(d.id)}"]`); if (el) el.remove();
      if (state.replyTo && state.replyTo.id === d.id) { state.replyTo = null; renderReplying(); }
    });
    es.addEventListener("reaction", (e) => {
      const d = JSON.parse(e.data), m = state.msgs.find((x) => x.id === d.id);
      if (m) { m.reactions = d.reactions; replaceMsg(m); }
    });
    es.addEventListener("typing", (e) => {
      const d = JSON.parse(e.data);
      if (me && d.userId === me.id) return;
      state.typers.set(d.username, Date.now() + 4000); renderTyping();
    });
    es.addEventListener("presence", (e) => {
      const r = state.rooms.find((x) => x.id === id);
      if (r) { r.online = JSON.parse(e.data).count; renderRooms(); }
    });
  }

  function renderTyping() {
    const now = Date.now();
    [...state.typers].forEach(([k, until]) => { if (until < now) state.typers.delete(k); });
    const names = [...state.typers.keys()];
    const el = $("#typing");
    if (!el) return;
    el.textContent = !names.length ? "" : names.length === 1 ? `${names[0]} is typing...` : names.length === 2 ? `${names[0]} and ${names[1]} are typing...` : "Several people are typing...";
  }
  setInterval(renderTyping, 1500);

  /* ---------- composing ---------- */
  function renderReplying() {
    const el = $("#replying"); if (!el) return;
    const t = state.replyTo, ed = state.editing;
    el.innerHTML = t ? `<div class="replying"><span>Replying to <b>${esc(t.username)}</b>: ${esc(t.text.slice(0, 70))}</span><button type="button" class="iconbtn" data-cancel aria-label="Cancel reply" style="width:28px;height:28px">${Icons.x}</button></div>`
      : ed ? `<div class="replying"><span>Editing your message</span><button type="button" class="iconbtn" data-cancel aria-label="Cancel edit" style="width:28px;height:28px">${Icons.x}</button></div>` : "";
  }

  function fitInput() {
    const i = $("#msgInput"); if (!i) return;
    i.style.height = "46px"; i.style.height = Math.min(i.scrollHeight, 140) + "px";
    $("#counter").textContent = `${i.value.length}/500`;
  }

  async function send() {
    const input = $("#msgInput"), err = $("#chatErr"), btn = $("#sendBtn");
    const text = input.value.trim();
    if (!text) return;
    err.textContent = ""; btn.disabled = true;
    try {
      if (state.editing) {
        const m = await api(`/chat/${encodeURIComponent(state.room)}/messages/${encodeURIComponent(state.editing.id)}`, { method: "PATCH", body: { text } });
        const local = state.msgs.find((x) => x.id === m.id); if (local) { Object.assign(local, m); replaceMsg(local); }
        state.editing = null;
      } else {
        const body = { text }; if (state.replyTo) body.replyTo = state.replyTo.id;
        const m = await api(`/chat/${encodeURIComponent(state.room)}/messages`, { method: "POST", body });
        if (!state.msgs.some((x) => x.id === m.id)) { state.msgs.push(m); appendMsg(m); }
        state.replyTo = null;
      }
      input.value = ""; renderReplying(); fitInput();
    } catch (e) {
      err.textContent = e.message;
      if (e.status === 401) loginPrompt($("#composer"), "Your login expired. Log in again to keep chatting.");
    } finally { const b = $("#sendBtn"); if (b) b.disabled = false; input.focus && input.focus(); }
  }

  async function react(id, emoji) {
    try { await api(`/chat/${encodeURIComponent(state.room)}/messages/${encodeURIComponent(id)}/reactions`, { method: "POST", body: { emoji } }); }
    catch (e) { toast("Could not react", { icon: "⚠️", body: e.message }); }
  }

  /* ---------- events ---------- */
  root.addEventListener("click", async (e) => {
    const room = e.target.closest("[data-room]");
    if (room) return openRoom(room.dataset.room);
    if (e.target.closest("#moreBtn")) return loadMore();
    if (e.target.closest("#jumpBtn")) { const b = $("#messages"); b.scrollTop = b.scrollHeight; return; }
    if (e.target.closest("#sendBtn")) return send();
    if (e.target.closest("[data-cancel]")) { state.replyTo = null; state.editing = null; $("#msgInput").value = ""; renderReplying(); fitInput(); return; }
    const msgEl = e.target.closest(".msg");
    if (!msgEl) return;
    const id = msgEl.dataset.id, m = state.msgs.find((x) => x.id === id);
    if (!m) return;
    const r = e.target.closest("[data-react]");
    if (r) return react(id, r.dataset.react);
    const act = e.target.closest("[data-act]");
    if (!act) return;
    if (act.dataset.act === "emoji") { const row = $(".emoji-row", msgEl); row.classList.toggle("open"); }
    else if (act.dataset.act === "reply") { state.replyTo = m; state.editing = null; renderReplying(); $("#msgInput").focus(); }
    else if (act.dataset.act === "edit") { state.editing = m; state.replyTo = null; renderReplying(); const i = $("#msgInput"); i.value = m.text; fitInput(); i.focus(); }
    else if (act.dataset.act === "delete") {
      if (!confirm("Delete this message for everyone?")) return;
      try { await api(`/chat/${encodeURIComponent(state.room)}/messages/${encodeURIComponent(id)}`, { method: "DELETE" }); }
      catch (err) { toast("Could not delete", { icon: "⚠️", body: err.message }); }
    }
  });

  root.addEventListener("input", (e) => {
    if (e.target.id !== "msgInput") return;
    fitInput();
    if (Date.now() - typingSentAt > 2500 && e.target.value.trim() && !state.editing) {
      typingSentAt = Date.now();
      api(`/chat/${encodeURIComponent(state.room)}/typing`, { method: "POST" }).catch(() => {});
    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.target.id === "msgInput" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.target.id === "msgInput" && e.key === "Escape") { state.replyTo = null; state.editing = null; renderReplying(); }
  });
  root.addEventListener("scroll", (e) => {
    if (e.target.id !== "messages") return;
    const b = e.target;
    if (b.scrollHeight - b.scrollTop - b.clientHeight < 80) $("#jumpBtn").classList.remove("show");
  }, true);

  async function loadMore() {
    const first = state.msgs[0]; if (!first) return;
    const btn = $("#moreBtn"); btn.disabled = true;
    try {
      const older = await api(`/chat/${encodeURIComponent(state.room)}/messages?limit=50&before=${encodeURIComponent(first.createdAt)}`);
      state.msgs = older.concat(state.msgs); state.hasMore = older.length === 50;
      renderAll(true);
    } catch (e) { btn.disabled = false; toast("Could not load earlier messages", { icon: "⚠️", body: e.message }); }
  }

  /* ---------- start ---------- */
  (async () => {
    layout();
    try { state.rooms = await api("/chat/rooms"); }
    catch (err) { showError(root, err.message); return; }
    const wanted = params.get("room");
    openRoom(state.rooms.some((r) => r.id === wanted) ? wanted : "general", { push: false });
    setInterval(async () => { // refresh the online counts of other rooms now and then
      try { const fresh = await api("/chat/rooms"); fresh.forEach((f) => { const r = state.rooms.find((x) => x.id === f.id); if (r) r.online = f.online; }); renderRooms(); } catch (e) { /* ignore */ }
    }, 30000);
  })();
})();

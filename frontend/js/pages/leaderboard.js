(() => {
  const view = $("#view");
  let period = "week";

  async function load() {
    view.innerHTML = '<span class="skeleton row"></span><span class="skeleton row"></span>';
    try {
      const d = await api("/leaderboard?period=" + period + "&limit=30");
      if (!d.entries.length) {
        view.innerHTML = `<div class="sheet empty"><span class="tile-ico">${Icons.trophy}</span><h3>Nobody is on the board yet</h3><p>${period === "week" ? "No XP has been earned this week." : "No XP has been earned yet."} Take a quiz and be the first.</p><a class="btn" href="quiz.html">Take a quiz</a></div>`;
        return;
      }
      view.innerHTML =
        (d.me ? `<div class="notice">You are ranked <b>#${d.me.rank}</b> of ${plural(d.totalPlayers, "player")} with ${d.me.xp} XP.</div>` : Auth.token() ? `<div class="notice">Earn some XP ${period === "week" ? "this week " : ""}to join the ranking.</div>` : `<div class="notice"><a href="login.html?next=${nextParam()}">Log in</a> to join the ranking.</div>`) +
        `<ol class="sheet flush lb">${d.entries.map((e) => `<li class="${e.isMe ? "me" : ""}"><span class="rank">${e.rank}</span><span class="avatar">${esc(e.avatar)}</span><span class="grow"><b>${esc(e.username)}</b><br><span class="muted">Level ${e.level}</span></span><span class="xp">${e.xp} XP</span></li>`).join("")}</ol>`;
    } catch (err) { showError(view, err.message); }
  }

  $$("[data-period]").forEach((b) => b.addEventListener("click", () => {
    period = b.dataset.period;
    $$("[data-period]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    load();
  }));
  load();
})();

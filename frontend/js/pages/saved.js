(async () => {
  const view = $("#view");
  if (!Auth.token()) return loginPrompt(view, "Bookmarks are saved to your account so you can revise them on any device.", "Log in to see saved questions");
  let items = [];
  const paint = () => {
    if (!items.length) {
      view.innerHTML = `<div class="sheet empty"><span class="tile-ico">${Icons.bookmark}</span><h3>No saved questions yet</h3><p>While studying a paper, tap Save on any question you want to come back to.</p><a class="btn" href="subjects.html">Browse past papers</a></div>`;
      return;
    }
    view.innerHTML = items.map((b) =>
      `<article class="q-article ruled margin" data-id="${esc(b.id)}"><span class="num">Q${b.index + 1}</span><p class="muted" style="font-size:14px">${esc(b.subjectName)} · ${b.year} paper ${b.paper} · ${esc(b.title)}</p><p class="prompt">${esc(b.prompt)}</p>` +
      `<div class="q-tools"><a class="btn sm" href="learning.html?subject=${encodeURIComponent(b.subjectId)}&year=${b.year}&paper=${b.paper}#q${b.index + 1}">Open in paper</a><button type="button" class="btn sm outline" data-reveal>Show solution</button><button type="button" class="btn sm ghost" data-remove aria-label="Remove bookmark">${Icons.trash} Remove</button></div>` +
      `<div class="solution" hidden>${esc(b.explanation)}</div></article>`).join("");
  };
  view.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-id]");
    if (!card) return;
    if (e.target.closest("[data-reveal]")) {
      const box = $(".solution", card), btn = e.target.closest("[data-reveal]");
      box.hidden = !box.hidden; btn.textContent = box.hidden ? "Show solution" : "Hide solution";
    } else if (e.target.closest("[data-remove]")) {
      try {
        await api("/study/bookmarks/" + encodeURIComponent(card.dataset.id), { method: "DELETE" });
        items = items.filter((b) => b.id !== card.dataset.id); paint();
      } catch (err) { toast("Could not remove", { icon: "⚠️", body: err.message }); }
    }
  });
  try { items = (await api("/study")).bookmarks; paint(); }
  catch (err) { if (err.status === 401) loginPrompt(view, "Your session expired. Log in again.", "Session expired"); else showError(view, err.message); }
})();

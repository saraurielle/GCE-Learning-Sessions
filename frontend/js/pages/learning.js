(async () => {
  const view = $("#view");
  const p = new URLSearchParams(location.search);
  const subjectId = p.get("subject"), year = p.get("year"), paper = p.get("paper");
  if (!subjectId || !year || !paper) { location.replace("subjects.html"); return; }
  const logged = Boolean(Auth.token());
  try {
    const [subject, data, study] = await Promise.all([
      api("/subjects/" + encodeURIComponent(subjectId)),
      api(`/papers/${encodeURIComponent(subjectId)}/${encodeURIComponent(year)}/${encodeURIComponent(paper)}`),
      logged ? api("/study").catch(() => null) : Promise.resolve(null),
    ]);
    document.title = `${subject.name} ${year} paper ${paper} · GCE Learning`;
    const marks = new Map(((study && study.bookmarks) || []).filter((b) => b.subjectId === subjectId && b.year === data.year && b.paper === data.paper).map((b) => [b.index, b.id]));
    let completed = Boolean(study && study.completed.some((c) => c.subjectId === subjectId && c.year === data.year && c.paper === data.paper));

    view.innerHTML =
      `<div class="page-head"><div><p><a href="papers.html?subject=${encodeURIComponent(subjectId)}">${esc(subject.name)}</a></p><h1>${esc(year)} · Paper ${esc(paper)}</h1><p>${plural(data.questions.length, "question")}. Try each one first, then reveal the solution.</p></div></div>` +
      (logged ? "" : `<div class="notice"><a href="login.html?next=${nextParam()}">Log in</a> to save questions and earn XP for finishing papers.</div>`) +
      data.questions.map(([title, prompt, solution], i) =>
        `<article class="q-article ruled margin" id="q${i + 1}"><span class="num">Q${i + 1}</span><span class="chip plain">${esc(title)}</span><p class="prompt">${esc(prompt)}</p>` +
        `<div class="q-tools"><button type="button" class="btn sm outline" data-reveal="${i}" aria-expanded="false" aria-controls="sol${i}">Show solution</button>` +
        `<button type="button" class="btn sm ghost save-btn" data-save="${i}" aria-pressed="${marks.has(i)}">${Icons.bookmark}<span>${marks.has(i) ? "Saved" : "Save"}</span></button></div>` +
        `<div class="solution" id="sol${i}" hidden>${esc(solution)}</div></article>`).join("") +
      `<div class="sticky-foot"><button type="button" class="btn" id="doneBtn"></button></div>`;

    const doneBtn = $("#doneBtn");
    const paintDone = () => { doneBtn.disabled = completed; doneBtn.innerHTML = completed ? `${Icons.check} Paper studied` : "Mark paper as studied (+15 XP)"; };
    paintDone();

    view.addEventListener("click", async (e) => {
      const r = e.target.closest("[data-reveal]");
      if (r) {
        const box = $("#sol" + r.dataset.reveal), open = box.hidden;
        box.hidden = !open; r.setAttribute("aria-expanded", String(open)); r.textContent = open ? "Hide solution" : "Show solution";
        return;
      }
      const s = e.target.closest("[data-save]");
      if (s) {
        if (!logged) return toast("Log in to save questions", { icon: "🔖", link: `login.html?next=${nextParam()}`, body: "Tap here to log in or register." });
        const i = Number(s.dataset.save);
        s.disabled = true;
        try {
          if (marks.has(i)) { await api("/study/bookmarks/" + encodeURIComponent(marks.get(i)), { method: "DELETE" }); marks.delete(i); }
          else { const b = await api("/study/bookmarks", { method: "POST", body: { subjectId, year: data.year, paper: data.paper, index: i } }); marks.set(i, b.id); }
          s.setAttribute("aria-pressed", String(marks.has(i))); $("span", s).textContent = marks.has(i) ? "Saved" : "Save";
        } catch (err) { toast("Could not update bookmark", { icon: "⚠️", body: err.message }); }
        s.disabled = false;
        return;
      }
      if (e.target.closest("#doneBtn")) {
        if (!logged) return toast("Log in to track papers", { icon: "✅", link: `login.html?next=${nextParam()}`, body: "Tap here to log in or register." });
        doneBtn.disabled = true;
        try {
          const r2 = await api("/study/completed", { method: "POST", body: { subjectId, year: data.year, paper: data.paper } });
          completed = true; paintDone();
          if (r2.xpGained) toast(`+${r2.xpGained} XP`, { icon: "📘", body: "Paper marked as studied." });
          celebrate(r2.progress);
        } catch (err) { doneBtn.disabled = false; toast("Could not save", { icon: "⚠️", body: err.message }); }
      }
    });

    const m = /^#q(\d+)$/.exec(location.hash);
    if (m) { const t = $("#q" + m[1]); if (t) { t.scrollIntoView({ block: "center" }); t.classList.add("flash"); } }
  } catch (err) { showError(view, err.status === 404 ? "We could not find that paper." : err.message); }
})();

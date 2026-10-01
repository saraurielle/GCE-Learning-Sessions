(async () => {
  const view = $("#view");
  const id = new URLSearchParams(location.search).get("subject");
  if (!id) { location.replace("subjects.html"); return; }
  try {
    const [subject, list, study] = await Promise.all([
      api("/subjects/" + encodeURIComponent(id)),
      api("/papers/" + encodeURIComponent(id)),
      Auth.token() ? api("/study").catch(() => null) : Promise.resolve(null),
    ]);
    document.title = subject.name + " papers · GCE Learning";
    const done = new Set(((study && study.completed) || []).filter((c) => c.subjectId === id).map((c) => `${c.year}-${c.paper}`));
    const years = [...new Set(list.map((p) => p.year))].sort((a, b) => b - a);
    const q = encodeURIComponent(id);
    view.innerHTML =
      `<div class="page-head"><div><h1><span aria-hidden="true">${esc(subject.icon)}</span> ${esc(subject.name)}</h1><p>${plural(list.length, "paper")} available. ${study ? `${done.size} studied.` : `<a href="login.html?next=${nextParam()}">Log in</a> to track the papers you finish.`}</p></div>` +
      `<div class="flex wrap"><a class="btn" href="quiz.html?subject=${q}">Take the quiz</a><a class="btn outline" href="chat.html?room=${q}">${Icons.chat} Discuss</a></div></div>` +
      years.map((y) => `<h2 class="paper-year">${y}</h2><div class="sheet flush list">` +
        list.filter((p) => p.year === y).sort((a, b) => a.paper - b.paper).map((p) =>
          `<a href="learning.html?subject=${q}&year=${p.year}&paper=${p.paper}"><span class="tile-ico">${p.paper}</span><span class="grow"><b>Paper ${p.paper}</b><p>${plural(p.questions, "question")}</p></span>` +
          (done.has(`${p.year}-${p.paper}`) ? `<span class="done-tick" title="Studied" aria-label="Studied">${Icons.check}</span>` : `<span class="chip plain">Start</span>`) + `</a>`).join("") + `</div>`).join("");
  } catch (err) { showError(view, err.status === 404 ? "We could not find that subject." : err.message); }
})();

(async () => {
  const list = $("#list");
  try {
    const subjects = await api("/subjects");
    list.innerHTML = subjects.map((s) =>
      `<a class="pick" href="papers.html?subject=${encodeURIComponent(s.id)}"><span class="top"><span class="tile-ico">${esc(s.icon)}</span><h3>${esc(s.name)}</h3></span>` +
      `<small>${plural(s.paperCount, "paper")} · ${plural(s.questionCount, "quiz question")}</small></a>`).join("");
  } catch (err) { list.className = ""; showError(list, err.message); }
})();

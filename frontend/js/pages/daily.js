(async () => {
  const view = $("#view");
  try {
    const daily = await api("/daily");
    const dateLabel = new Date(daily.date + "T00:00:00Z").toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    const head = `<div class="page-head"><div><h1>Daily challenge</h1><p>${esc(dateLabel)}. Five questions, the same for everyone.</p></div></div>`;

    if (daily.completed) {
      const r = daily.result;
      view.innerHTML = head + `<div class="script ruled margin"><h1>Done for today</h1><div class="marks"><span class="score-mark">${r.correct}/${r.total}<svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><path d="M20 55 C 18 18, 170 6, 188 40 C 200 72, 60 98, 24 70 C 10 58, 40 28, 100 22"/></svg></span><div><div class="verdict">See you tomorrow!</div><p class="muted">You earned ${r.xp} XP.</p></div></div>` +
        `<div class="result-actions"><a class="btn" href="quiz.html">Practise a subject</a><a class="btn outline" href="leaderboard.html">Leaderboard</a></div></div>`;
      return;
    }

    const begin = () => {
      view.innerHTML = head + `<div id="runner"></div>`;
      QuizRunner.start({
        root: $("#runner"), title: "Daily challenge", subtitle: dateLabel, questions: daily.questions,
        draftKey: "gce_draft_daily_" + daily.date,
        submit: (answers) => api("/daily/submit", { method: "POST", body: { date: daily.date, answers } }),
        onRestart: () => location.reload(),
        actions: [{ label: "Practise a subject", href: "quiz.html" }],
      });
    };
    begin();
  } catch (err) { showError(view, err.message); }
})();

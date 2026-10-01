(async () => {
  const view = $("#view");
  const subjectId = new URLSearchParams(location.search).get("subject");

  async function picker() {
    try {
      const subjects = await api("/subjects");
      view.innerHTML = `<div class="page-head"><div><h1>Quizzes</h1><p>Choose a subject. Questions are marked instantly and you see where you went wrong.${Auth.token() ? "" : ` <a href="login.html?next=${nextParam()}">Log in</a> to earn XP and keep a streak.`}</p></div></div>` +
        `<div class="picker">${subjects.map((s) => `<a class="pick" href="quiz.html?subject=${encodeURIComponent(s.id)}"><span class="top"><span class="tile-ico">${esc(s.icon)}</span><h3>${esc(s.name)}</h3></span><small>${plural(s.questionCount, "question")}</small></a>`).join("")}</div>`;
    } catch (err) { showError(view, err.message); }
  }

  async function run() {
    try {
      const [subject, questions] = await Promise.all([api("/subjects/" + encodeURIComponent(subjectId)), api("/quiz/" + encodeURIComponent(subjectId))]);
      document.title = subject.name + " quiz · GCE Learning";
      const begin = () => {
        view.innerHTML = `<div class="page-head"><div><p><a href="quiz.html">All quizzes</a></p><h1>${esc(subject.icon)} ${esc(subject.name)}</h1></div></div><div id="runner"></div>`;
        QuizRunner.start({
          root: $("#runner"), title: subject.name + " quiz", subtitle: plural(questions.length, "question"), questions,
          draftKey: "gce_draft_quiz_" + subjectId,
          submit: (answers) => api("/quiz/submit", { method: "POST", body: { subjectId, answers } }),
          onRestart: begin,
          actions: [{ label: "Study the papers", href: "papers.html?subject=" + encodeURIComponent(subjectId) }, { label: "Other quizzes", href: "quiz.html" }],
        });
      };
      begin();
    } catch (err) { showError(view, err.status === 404 ? "There is no quiz for that subject yet." : err.message); }
  }

  if (subjectId) run(); else picker();
})();

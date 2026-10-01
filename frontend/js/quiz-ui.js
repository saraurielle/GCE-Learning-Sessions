/* QuizRunner: the quiz experience shared by pages/quiz.html and pages/daily.html.
   One question at a time, timer, question dots, keyboard shortcuts, saved draft,
   and a "marked script" results view. Needs js/api.js and js/shell.js (for celebrate). */

const QuizRunner = (() => {
  const LETTERS = ["A", "B", "C", "D", "E", "F"];
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  function verdictFor(pct) {
    if (pct === 100) return "Perfect!";
    if (pct >= 80) return "Excellent work!";
    if (pct >= 60) return "Good, keep going!";
    if (pct >= 50) return "A pass. Push higher!";
    return "Not yet. Review and retry!";
  }

  /**
   * opts: { root, title, subtitle, questions:[{question, options, subjectName?, subjectIcon?}],
   *         draftKey, submit(answers) -> Promise<result>, onRestart(), actions:[{label, href}] }
   */
  function start(opts) {
    const { root, questions } = opts;
    const n = questions.length;
    const st = { idx: 0, answers: Array(n).fill(null), elapsed: 0, done: false, confirming: false };
    let timer = null;

    // restore an unfinished attempt (same tab only)
    try {
      const d = JSON.parse(sessionStorage.getItem(opts.draftKey) || "null");
      if (d && Array.isArray(d.answers) && d.answers.length === n) {
        st.answers = d.answers; st.idx = Math.min(d.idx || 0, n - 1); st.elapsed = d.elapsed || 0;
      }
    } catch (e) { /* ignore */ }

    const save = () => { try { sessionStorage.setItem(opts.draftKey, JSON.stringify({ answers: st.answers, idx: st.idx, elapsed: st.elapsed })); } catch (e) { /* ignore */ } };
    const clearDraft = () => { try { sessionStorage.removeItem(opts.draftKey); } catch (e) { /* ignore */ } };
    const answeredCount = () => st.answers.filter((a) => a !== null).length;

    function tick() {
      st.elapsed++;
      const t = $("#qTimer", root);
      if (t) t.textContent = fmtTime(st.elapsed);
      if (st.elapsed % 5 === 0) save();
    }

    function render() {
      if (st.done) return;
      const q = questions[st.idx];
      const pct = Math.round((answeredCount() / n) * 100);
      root.innerHTML =
        `<div class="quiz-bar"><strong>${esc(opts.title)}</strong><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${answeredCount()}" aria-label="Questions answered"><i style="width:${pct}%"></i></div>` +
        `<span class="muted">${answeredCount()}/${n} answered</span><span class="timer">${Icons.clock}<span id="qTimer">${fmtTime(st.elapsed)}</span></span></div>` +
        `<div class="qcard ruled margin"><span class="tag">${q.subjectIcon ? esc(q.subjectIcon) + " " + esc(q.subjectName || "") + " · " : ""}Question ${st.idx + 1} of ${n}</span>` +
        `<h2 id="qText">${esc(q.question)}</h2>` +
        `<fieldset class="opts" style="border:0" aria-labelledby="qText">${q.options.map((o, i) =>
          `<label class="opt"><input type="radio" name="opt" value="${i}"${st.answers[st.idx] === i ? " checked" : ""}><span class="bub">${LETTERS[i]}</span><span>${esc(o)}</span></label>`).join("")}</fieldset></div>` +
        `<div class="qnav" role="group" aria-label="Jump to question">${st.answers.map((a, i) =>
          `<button type="button" data-go="${i}" class="${a !== null ? "answered" : ""}${i === st.idx ? " cur" : ""}" aria-label="Question ${i + 1}${a !== null ? ", answered" : ""}"${i === st.idx ? ' aria-current="true"' : ""}>${i + 1}</button>`).join("")}</div>` +
        `<div class="quiz-foot"><button type="button" class="btn outline" id="prevBtn"${st.idx === 0 ? " disabled" : ""}>Previous</button>` +
        (st.idx < n - 1
          ? `<button type="button" class="btn" id="nextBtn">Next</button>`
          : `<button type="button" class="btn" id="finishBtn">Finish and mark</button>`) + `</div>` +
        (st.confirming ? confirmHtml() : "") + `<div id="qError"></div>`;
    }

    function confirmHtml() {
      const left = n - answeredCount();
      return `<div class="confirm" role="alertdialog" aria-label="Unanswered questions"><span>You left ${plural(left, "question")} blank. Blank answers score zero.</span>` +
        `<span class="flex"><button type="button" class="btn sm outline" id="backBtn">Go back</button><button type="button" class="btn sm" id="sureBtn">Submit anyway</button></span></div>`;
    }

    function go(i) { st.idx = Math.max(0, Math.min(n - 1, i)); st.confirming = false; save(); render(); }

    function choose(i) {
      st.answers[st.idx] = i; st.confirming = false; save();
      // update in place so focus and keyboard flow are not lost
      const pct = Math.round((answeredCount() / n) * 100);
      $(".quiz-bar .bar > i", root).style.width = pct + "%";
      $(".quiz-bar .muted", root).textContent = `${answeredCount()}/${n} answered`;
      $$(".qnav button", root)[st.idx].classList.add("answered");
      const cf = $(".confirm", root); if (cf) cf.remove();
    }

    async function finish(force) {
      if (!force && answeredCount() < n) { st.confirming = true; render(); const b = $("#sureBtn", root); if (b) b.focus(); return; }
      const btn = $("#finishBtn", root) || $("#sureBtn", root);
      if (btn) { btn.disabled = true; btn.textContent = "Marking..."; }
      try {
        const result = await opts.submit(st.answers.slice());
        st.done = true; clearInterval(timer); clearDraft();
        document.removeEventListener("keydown", onKey);
        results(result);
      } catch (err) {
        st.confirming = false; render();
        showError($("#qError", root), err.message);
      }
    }

    function results(r) {
      const pct = Math.round(r.percentage);
      const logged = Boolean(Auth.token());
      const circle = '<svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><path d="M20 55 C 18 18, 170 6, 188 40 C 200 72, 60 98, 24 70 C 10 58, 40 28, 100 22"/></svg>';
      const gains = [];
      if (r.xpGained) gains.push(`<span class="xp">+${r.xpGained} XP</span>`);
      if (r.progress && r.progress.streak && r.progress.streak.current > 1) gains.push(`<span class="chip mark">${Icons.flame} ${plural(r.progress.streak.current, "day")} streak</span>`);
      const unlocks = []
        .concat(r.progress && r.progress.levelUp ? [`<div class="unlock"><span class="big">🚀</span><div><b>Level ${r.progress.levelUp} reached</b><br><span>${r.progress.xp} XP in total</span></div></div>`] : [])
        .concat(((r.progress && r.progress.newBadges) || []).map((b) => `<div class="unlock"><span class="big">${esc(b.icon)}</span><div><b>Badge unlocked: ${esc(b.name)}</b><br><span>${esc(b.description)}</span></div></div>`));

      root.innerHTML =
        `<div class="script ruled margin" role="region" aria-label="Your marked script"><h1>${esc(opts.title)}</h1><p class="muted">${esc(opts.subtitle || "")}${opts.subtitle ? " · " : ""}finished in ${fmtTime(st.elapsed)}</p>` +
        `<div class="marks"><span class="score-mark" aria-label="Score ${r.correct} out of ${r.total}">${circle}${r.correct}/${r.total}</span>` +
        `<div><div class="verdict">${esc(verdictFor(pct))}</div><p class="muted">${pct}% correct</p></div></div>` +
        (gains.length ? `<div class="gains">${gains.join("")}</div>` : "") + unlocks.join("") +
        (!logged ? `<div class="notice">This score was not saved. <a href="${appHref("pages/login.html")}?next=${nextParam()}">Log in or register</a> to earn XP, badges and a streak.</div>` : "") +
        `<div class="result-actions"><button type="button" class="btn" id="againBtn">Try again</button>` +
        (opts.actions || []).map((a) => `<a class="btn outline" href="${esc(a.href)}">${esc(a.label)}</a>`).join("") + `</div></div>` +
        `<section class="sheet review flush" aria-label="Question by question review"><div class="sheet-head" style="padding:18px 22px 0"><h2>Review</h2><span class="muted">${r.review.filter((x) => x.isCorrect).length} correct</span></div>` +
        r.review.map((x, i) => {
          const q = questions[i];
          const chosen = x.chosen === null ? "<em>No answer</em>" : esc(q.options[x.chosen]);
          return `<div class="rv"><span class="pen" aria-hidden="true">${x.isCorrect ? "✓" : "✗"}</span><h3>${i + 1}. ${esc(q.question)}</h3>` +
            `<p class="ans">${x.isCorrect ? `Your answer: <b>${chosen}</b>` : `Your answer: <s>${chosen}</s><br>Correct answer: <b>${esc(q.options[x.correctIndex])}</b>`}</p>` +
            (x.explanation ? `<p class="why">${esc(x.explanation)}</p>` : "") + `</div>`;
        }).join("") + `</section>`;
      $("#againBtn", root).addEventListener("click", () => opts.onRestart());
      window.scrollTo({ top: 0, behavior: "smooth" });
      celebrate(r.progress);
    }

    function onKey(e) {
      if (st.done || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.type !== "radio") return;
      const q = questions[st.idx];
      const num = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : LETTERS.indexOf(e.key.toUpperCase());
      if (e.key.length === 1 && num >= 0 && num < q.options.length) {
        e.preventDefault();
        const radio = $$('input[name="opt"]', root)[num];
        if (radio) { radio.checked = true; choose(num); }
      } else if (e.key === "ArrowRight" && st.idx < n - 1) { e.preventDefault(); go(st.idx + 1); }
      else if (e.key === "ArrowLeft" && st.idx > 0) { e.preventDefault(); go(st.idx - 1); }
    }

    root.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t || st.done) return;
      if (t.dataset.go !== undefined) go(Number(t.dataset.go));
      else if (t.id === "prevBtn") go(st.idx - 1);
      else if (t.id === "nextBtn") go(st.idx + 1);
      else if (t.id === "finishBtn") finish(false);
      else if (t.id === "backBtn") { st.confirming = false; render(); }
      else if (t.id === "sureBtn") finish(true);
    });
    root.addEventListener("change", (e) => { if (e.target.name === "opt") choose(Number(e.target.value)); });
    document.addEventListener("keydown", onKey);
    timer = setInterval(tick, 1000);
    render();
  }

  return { start };
})();

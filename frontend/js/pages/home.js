/* Home: a welcome page for guests, a "Today" dashboard for logged-in students. */
(() => {
  const root = $("#home");
  const user = Auth.user();

  function guest() {
    const circle = '<svg viewBox="0 0 120 70" preserveAspectRatio="none" aria-hidden="true"><path d="M10 38 C 8 10, 100 4, 112 28 C 120 52, 36 68, 14 48 C 4 40, 24 18, 64 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
    const feature = (href, icon, title, text) => `<a href="${appHref(href)}"><span class="tile-ico">${Icons[icon]}</span><span class="grow"><h3>${title}</h3><p>${text}</p></span></a>`;
    root.innerHTML =
      `<section class="hero"><div><h1>Practise like it is exam day.</h1><p class="lead">Past papers with worked solutions, quizzes marked instantly, and a daily challenge that keeps your streak alive. Free to use.</p>` +
      `<div class="flex wrap"><a class="btn lg" href="${appHref("pages/daily.html")}">Try today's challenge</a><a class="btn lg outline" href="${appHref("pages/subjects.html")}">Browse past papers</a></div></div>` +
      `<div class="script-card ruled margin" aria-hidden="true"><h4>Physics · Quiz</h4><div class="q">1. Which unit measures force?</div><div class="omr"><span class="bub">A</span><span class="bub on">B</span><span class="bub">C</span><span class="bub">D</span></div>` +
      `<div class="q">2. Speed is distance divided by?</div><div class="omr"><span class="bub">A</span><span class="bub">B</span><span class="bub on">C</span><span class="bub">D</span></div>` +
      `<span class="pen score">8/10${circle}</span><span class="pen note">Well done!</span></div></section>` +
      `<section class="sheet flush features" aria-label="What you can do"><div class="grid list">` +
      feature("pages/subjects.html", "book", "Past papers", "Every year and paper, with solutions you can reveal.") +
      feature("pages/quiz.html", "pencil", "Quizzes", "Answer one question at a time and see your marked script.") +
      feature("pages/daily.html", "calendar", "Daily challenge", "Five new questions every day. Keep the streak going.") +
      feature("pages/chat.html", "chat", "Community", "Chat live in a room for every subject.") +
      feature("pages/leaderboard.html", "trophy", "Leaderboard", "Earn XP, level up and climb the weekly ranking.") +
      feature("pages/saved.html", "bookmark", "Saved questions", "Bookmark hard questions and revise them later.") +
      `</div></section>`;
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }

  async function dashboard() {
    root.innerHTML = `<div class="greet flex"><span class="avatar lg">${esc(user.avatar || "🎓")}</span><div><h1>${greeting()}, ${esc(user.username)}</h1><p class="muted" id="goalLine">Loading your day...</p></div></div><div class="today" id="today"></div>`;
    const [stats, daily, lb] = await Promise.all([
      api("/stats/me"),
      api("/daily").catch(() => null),
      api("/leaderboard?period=week&limit=5").catch(() => null),
    ]);
    const lv = stats.level, g = stats.dailyGoal;
    $("#goalLine").textContent = g.reached ? `Daily goal reached: ${g.doneToday} of ${g.target} done today.` : `Daily goal: ${g.doneToday} of ${plural(g.target, "activity", "activities")} done today.`;
    const max = Math.max(1, ...stats.week.map((d) => d.count));
    const todayKey = new Date().toISOString().slice(0, 10);

    const dailyCard = daily
      ? `<section class="sheet c-7"><div class="daily-card"><div class="ruled"><span class="pen">${daily.completed ? `${daily.result.correct}/${daily.result.total}` : "5 Qs"}</span><small class="muted">${daily.completed ? "today's score" : "new today"}</small></div>` +
        `<div class="grow"><h2>Daily challenge</h2><p class="muted">${daily.completed ? `Done for today. You earned ${daily.result.xp} XP. A new set arrives tomorrow.` : "Five mixed questions, the same for everyone. Finish it for a 25 XP bonus."}</p>` +
        `<a class="btn mt" href="${appHref("pages/daily.html")}">${daily.completed ? "See it again" : "Start challenge"}</a></div></div></section>`
      : "";
    const levelCard = `<section class="sheet c-5"><div class="flex"><div class="ring" style="--p:${lv.progress}" role="img" aria-label="Level ${lv.level}, ${lv.progress}% to next level"><span><span>${lv.level}<small>level</small></span></span></div>` +
      `<div class="grow"><h2>${stats.xp} XP</h2><p class="muted">${lv.xpForNext - lv.xpIntoLevel} XP to level ${lv.level + 1}</p><p class="mt"><span class="chip mark">${Icons.flame} ${plural(stats.streak.current, "day")} streak</span></p></div></div></section>`;
    const weekCard = `<section class="sheet c-7"><div class="sheet-head"><h2>Your week</h2><a href="${appHref("pages/progress.html")}">Full progress</a></div><div class="week" role="img" aria-label="Activity over the last 7 days">` +
      stats.week.map((d) => `<div class="${d.count === 0 ? "zero" : ""}${d.date === todayKey ? " today-col" : ""}"><b>${d.count || ""}</b><i style="height:${Math.max(4, Math.round((d.count / max) * 90))}px"></i>${esc(d.weekday)}</div>`).join("") + `</div></section>`;
    const lbCard = `<section class="sheet c-5"><div class="sheet-head"><h2>Top this week</h2><a href="${appHref("pages/leaderboard.html")}">See all</a></div>` +
      (lb && lb.entries.length
        ? `<ol class="lb-mini">${lb.entries.map((e) => `<li class="${e.isMe ? "me" : ""}"><span class="rank">${e.rank}</span><span class="avatar sm">${esc(e.avatar)}</span><span class="grow">${esc(e.username)}</span><span class="xp">${e.xp} XP</span></li>`).join("")}</ol>`
        : `<p class="muted">Nobody has earned XP this week yet. Be the first.</p>`) + `</section>`;
    $("#today").innerHTML = dailyCard + levelCard + weekCard + lbCard;
  }

  if (!user) guest();
  else dashboard().catch((err) => {
    if (err.status === 401) return loginPrompt(root, "Your session expired. Log in again to see your dashboard.", "Session expired");
    showError(root, err.message);
  });
})();

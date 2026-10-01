(async () => {
  const view = $("#view");
  if (!Auth.token()) return loginPrompt(view, "Your XP, streak, badges and subject results are saved to your account.", "See your progress");
  try {
    const s = await api("/stats/me");
    const lv = s.level, g = s.dailyGoal, t = s.totals;
    const max = Math.max(1, ...s.week.map((d) => d.count));
    const todayKey = new Date().toISOString().slice(0, 10);
    const kindLabel = (r) => (r.kind === "daily" ? "Daily challenge" : r.subjectName);
    view.innerHTML =
      `<div class="page-head"><div><h1>My progress</h1><p>Level ${lv.level}. ${lv.xpForNext - lv.xpIntoLevel} XP to level ${lv.level + 1}.</p></div></div>` +
      `<div class="stat-row"><div class="stat"><b>${s.xp}</b><span>XP earned</span></div><div class="stat"><b>${s.streak.current}</b><span>day streak (best ${s.streak.longest})</span></div>` +
      `<div class="stat"><b>${t.quizzes}</b><span>quizzes taken</span></div><div class="stat"><b>${t.averageScore}%</b><span>average quiz score</span></div>` +
      `<div class="stat"><b>${t.papersCompleted}</b><span>papers studied</span></div><div class="stat"><b>${t.dailyChallenges}</b><span>daily challenges</span></div></div>` +
      `<div class="grid-2"><section class="sheet"><div class="sheet-head"><h2>Level ${lv.level}</h2><span class="xp">${s.xp} XP</span></div><div class="bar mark" role="progressbar" aria-valuenow="${lv.progress}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress to next level"><i style="width:${lv.progress}%"></i></div>` +
      `<p class="muted mt">${lv.xpIntoLevel} of ${lv.xpForNext} XP towards level ${lv.level + 1}</p><h3 class="mt-l">Today's goal</h3><div class="bar ${g.reached ? "green" : ""}"><i style="width:${Math.min(100, Math.round((g.doneToday / g.target) * 100))}%"></i></div><p class="muted mt">${g.doneToday} of ${plural(g.target, "activity", "activities")}${g.reached ? ". Goal reached!" : ""} <a href="profile.html">Change goal</a></p></section>` +
      `<section class="sheet"><h2>Last 7 days</h2><div class="week" role="img" aria-label="Activity over the last 7 days">` +
      s.week.map((d) => `<div class="${d.count === 0 ? "zero" : ""}${d.date === todayKey ? " today-col" : ""}"><b>${d.count || ""}</b><i style="height:${Math.max(4, Math.round((d.count / max) * 90))}px"></i>${esc(d.weekday)}</div>`).join("") + `</div></section></div>` +
      `<section class="sheet mt-l mastery"><h2>Subject mastery</h2>` +
      (s.perSubject.length
        ? s.perSubject.map((p) => `<div class="m"><div class="flex between"><b>${esc(p.name)}</b><span class="muted">best ${p.best}% · average ${p.average}% · ${plural(p.attempts, "attempt")}</span></div><div class="bar ${p.best >= 50 ? "green" : ""}"><i style="width:${p.best}%"></i></div></div>`).join("")
        : `<p class="muted">Take a quiz and your best scores will appear here. <a href="quiz.html">Start one</a></p>`) + `</section>` +
      `<section class="mt-l"><h2 style="margin-bottom:12px">Badges <span class="muted" style="font-size:1rem">${s.badges.filter((b) => b.earned).length}/${s.badges.length}</span></h2><div class="badges">` +
      s.badges.map((b) => `<div class="badge${b.earned ? "" : " locked"}"><span class="bi" aria-hidden="true">${esc(b.icon)}</span><b>${esc(b.name)}</b><small>${esc(b.description)}</small>${b.earned ? "" : '<small class="sr">Locked</small>'}</div>`).join("") + `</div></section>` +
      `<section class="sheet flush mt-l"><div class="sheet-head" style="padding:18px 22px 0"><h2>Recent activity</h2></div>` +
      (s.recent.length
        ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>What</th><th>Score</th><th>XP</th><th>When</th></tr></thead><tbody>${s.recent.map((r) => `<tr><td>${esc(kindLabel(r))}</td><td class="${r.percentage >= 50 ? "ok" : "no"}">${r.correctCount}/${r.total} (${Math.round(r.percentage)}%)</td><td>${typeof r.xp === "number" ? "+" + r.xp : ""}</td><td>${esc(timeAgo(r.dateTaken))}</td></tr>`).join("")}</tbody></table></div>`
        : `<div class="empty"><p>Nothing yet. Your quizzes and challenges will be listed here.</p></div>`) + `</section>`;
  } catch (err) {
    if (err.status === 401) return loginPrompt(view, "Your session expired. Log in again to see your progress.", "Session expired");
    showError(view, err.message);
  }
})();

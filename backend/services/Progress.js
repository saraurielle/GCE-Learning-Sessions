/**
 * Progress: XP, levels, streaks, badges, weekly activity and the leaderboard.
 * Everything is derived from data/progress.json (per user), scores.json and study.json.
 * Days are UTC days. `now` is a parameter so tests can travel in time.
 */
const { DATA_DIR } = require("../config/db");
const Store = require("./Store");
const Scores = require("./Scores");
const Notifications = require("./Notifications");
const Users = require("./Users");
const subjects = require("../data/subjects.json");

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const addDays = (key, n) => { const d = new Date(`${key}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return dayKey(d); };

/* ---------- levels: level n needs 50 * (n-1)^2 XP in total ---------- */
const xpForLevel = (n) => 50 * (n - 1) ** 2;
function levelFor(xp) {
  let l = Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
  while (xpForLevel(l + 1) <= xp) l++;
  while (l > 1 && xpForLevel(l) > xp) l--;
  return l;
}
function levelInfo(xp) {
  const level = levelFor(xp);
  const xpIntoLevel = xp - xpForLevel(level);
  const xpForNext = xpForLevel(level + 1) - xpForLevel(level);
  return { level, xpIntoLevel, xpForNext, progress: Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100)) };
}

/* ---------- badges ---------- */
const BADGES = [
  { id: "first-quiz", name: "First Steps", icon: "📝", description: "Finish your first quiz", test: (c) => c.quizzes >= 1 },
  { id: "quiz-10", name: "Quiz Regular", icon: "🎯", description: "Finish 10 quizzes", test: (c) => c.quizzes >= 10 },
  { id: "perfect", name: "Full Marks", icon: "💯", description: "Score 100% on a quiz or challenge", test: (c) => c.perfects >= 1 },
  { id: "daily-1", name: "Daily Starter", icon: "📅", description: "Complete a daily challenge", test: (c) => c.daily >= 1 },
  { id: "daily-7", name: "Challenge Champion", icon: "🏆", description: "Complete 7 daily challenges", test: (c) => c.daily >= 7 },
  { id: "paper-1", name: "Bookworm", icon: "📖", description: "Study your first past paper", test: (c) => c.papers >= 1 },
  { id: "paper-5", name: "Scholar", icon: "🎓", description: "Study 5 past papers", test: (c) => c.papers >= 5 },
  { id: "streak-3", name: "On a Roll", icon: "🔥", description: "Keep a 3 day streak", test: (c) => c.longest >= 3 },
  { id: "streak-7", name: "Unstoppable", icon: "⚡", description: "Keep a 7 day streak", test: (c) => c.longest >= 7 },
  { id: "level-5", name: "Rising Star", icon: "🚀", description: "Reach level 5", test: (c) => c.level >= 5 },
];
const badgeView = (b) => ({ id: b.id, name: b.name, icon: b.icon, description: b.description });

/* ---------- storage ---------- */
const readAll = () => Store.read(DATA_DIR.progress, {});
function normalize(p = {}) {
  return {
    xp: p.xp || 0,
    xpLog: p.xpLog || [],
    activity: p.activity || {},
    streak: { current: 0, longest: 0, last: null, ...(p.streak || {}) },
    badges: p.badges || {},
    perfects: p.perfects || 0,
    lastReminder: p.lastReminder || null,
  };
}
const get = (userId) => normalize(readAll()[userId]);

function counts(userId, p) {
  const scores = Scores.forUser(userId);
  const study = Store.read(DATA_DIR.study, {})[userId] || {};
  return {
    quizzes: scores.filter((s) => (s.kind || "quiz") === "quiz").length,
    daily: scores.filter((s) => s.kind === "daily").length,
    papers: (study.completed || []).length,
    perfects: p.perfects,
    longest: p.streak.longest,
    level: levelFor(p.xp),
  };
}

const MILESTONE_STREAKS = [3, 7, 14, 30];

/**
 * Records one finished activity (quiz, daily challenge, studied paper).
 * Call it AFTER the score/paper has been saved, so badge counts include it.
 * Returns what the frontend celebrates: { xp, levelUp?, newBadges, streak }.
 */
function record(userId, { xp = 0, perfect = false } = {}, now = new Date()) {
  const all = readAll();
  const p = normalize(all[userId]);
  const today = dayKey(now);
  const levelBefore = levelFor(p.xp);

  p.xp += xp;
  if (xp > 0) p.xpLog.push({ at: now.toISOString(), xp });
  const cutoff = now.getTime() - 14 * 86400000;
  p.xpLog = p.xpLog.filter((e) => Date.parse(e.at) >= cutoff);

  p.activity[today] = (p.activity[today] || 0) + 1;
  const keep = addDays(today, -60);
  Object.keys(p.activity).forEach((k) => { if (k < keep) delete p.activity[k]; });

  let streakGrew = false;
  if (p.streak.last !== today) {
    p.streak.current = p.streak.last === addDays(today, -1) ? p.streak.current + 1 : 1;
    p.streak.last = today;
    p.streak.longest = Math.max(p.streak.longest, p.streak.current);
    streakGrew = true;
  }
  if (perfect) p.perfects += 1;

  all[userId] = p;
  Store.write(DATA_DIR.progress, all); // saved first, so badge tests below see current numbers via `p`

  const c = counts(userId, p);
  const unlocked = BADGES.filter((b) => !p.badges[b.id] && b.test(c));
  if (unlocked.length) {
    unlocked.forEach((b) => { p.badges[b.id] = now.toISOString(); });
    all[userId] = p;
    Store.write(DATA_DIR.progress, all);
  }

  const levelAfter = levelFor(p.xp);
  const result = {
    xp: p.xp,
    levelUp: levelAfter > levelBefore ? levelAfter : undefined,
    newBadges: unlocked.map(badgeView),
    streak: { current: p.streak.current },
  };

  try {
    if (result.levelUp) Notifications.add(userId, { type: "level", title: `Level ${levelAfter} reached`, body: `${p.xp} XP in total`, link: "pages/progress.html" });
    unlocked.forEach((b) => Notifications.add(userId, { type: "badge", title: `Badge unlocked: ${b.name}`, body: b.description, link: "pages/progress.html" }));
    if (streakGrew && MILESTONE_STREAKS.includes(p.streak.current)) {
      Notifications.add(userId, { type: "streak", title: `${p.streak.current} day streak`, body: "Keep it going tomorrow.", link: "pages/progress.html" });
    }
  } catch (e) { /* notifications must never break a quiz result */ }

  return result;
}

/** What the "streak" widgets show: a streak is alive if you were active today or yesterday. */
function streakView(p, now = new Date()) {
  const today = dayKey(now);
  const alive = p.streak.last === today || p.streak.last === addDays(today, -1);
  return { current: alive ? p.streak.current : 0, longest: p.streak.longest, activeToday: p.streak.last === today };
}

function stats(userId, now = new Date()) {
  const p = get(userId);
  const user = Users.findById(userId);
  const today = dayKey(now);
  const scores = Scores.forUser(userId).sort((a, b) => new Date(b.dateTaken) - new Date(a.dateTaken));
  const quizScores = scores.filter((s) => (s.kind || "quiz") === "quiz");
  const c = counts(userId, p);
  const nameOf = (id) => (subjects.find((s) => s.id === id) || { name: id }).name;

  const week = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    week.push({
      date,
      weekday: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      count: p.activity[date] || 0,
    });
  }

  const bySubject = new Map();
  quizScores.forEach((s) => { if (!bySubject.has(s.subjectId)) bySubject.set(s.subjectId, []); bySubject.get(s.subjectId).push(s.percentage); });
  const perSubject = [...bySubject].map(([id, list]) => ({
    subjectId: id,
    name: nameOf(id),
    best: Math.round(Math.max(...list)),
    average: Math.round(list.reduce((a, b) => a + b, 0) / list.length),
    attempts: list.length,
  })).sort((a, b) => a.name.localeCompare(b.name));

  const target = user && Number.isInteger(user.dailyGoal) ? user.dailyGoal : 1;
  const doneToday = p.activity[today] || 0;

  return {
    xp: p.xp,
    level: levelInfo(p.xp),
    streak: streakView(p, now),
    dailyGoal: { target, doneToday, reached: doneToday >= target },
    week,
    totals: {
      quizzes: c.quizzes,
      averageScore: quizScores.length ? Math.round(quizScores.reduce((a, s) => a + s.percentage, 0) / quizScores.length) : 0,
      papersCompleted: c.papers,
      dailyChallenges: c.daily,
    },
    perSubject,
    badges: BADGES.map((b) => ({ ...badgeView(b), earned: Boolean(p.badges[b.id]) })),
    recent: scores.slice(0, 10).map((s) => ({
      kind: s.kind || "quiz",
      subjectId: s.subjectId,
      subjectName: nameOf(s.subjectId),
      correctCount: s.correctCount,
      total: s.total,
      percentage: s.percentage,
      xp: s.xp,
      dateTaken: s.dateTaken,
    })),
  };
}

/** XP per user for "week" (since Monday 00:00 UTC) or "all". Users with 0 XP are left out. */
function standings(period, now = new Date()) {
  const all = readAll();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const rows = [];
  Users.readUsers().forEach((u) => {
    const p = normalize(all[u.id]);
    const xp = period === "week"
      ? p.xpLog.filter((e) => Date.parse(e.at) >= start.getTime()).reduce((a, e) => a + e.xp, 0)
      : p.xp;
    if (xp > 0) rows.push({ user: u, xp, totalXp: p.xp });
  });
  return rows.sort((a, b) => b.xp - a.xp || a.user.username.localeCompare(b.user.username));
}

module.exports = { dayKey, addDays, xpForLevel, levelFor, levelInfo, BADGES, get, record, stats, streakView, standings, readAll };

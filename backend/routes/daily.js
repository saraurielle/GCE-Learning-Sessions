const express = require("express");
const router = express.Router();
const subjects = require("../data/subjects.json");
const quizBank = require("../data/quiz.json");
const QuizGrader = require("../services/QuizGrader");
const Scores = require("../services/Scores");
const Progress = require("../services/Progress");
const { optionalAuth } = require("../middleware/auth");
const { saveScoreInternal } = require("../controllers/scoresController");

const DAILY_SIZE = 5;
const DAILY_BONUS_XP = 25;

/** Deterministic pseudo-random generator, so everybody gets the same questions on the same day. */
function seeded(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) { h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The 5 questions of a UTC day (full objects, with answers; strip before sending). */
function questionsFor(date) {
  const pool = [];
  subjects.forEach((s) => (quizBank[s.id] || []).forEach((q) => pool.push({ ...q, subjectName: s.name, subjectIcon: s.icon })));
  const rand = seeded(date);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, DAILY_SIZE);
}

const doneToday = (userId, date) => Scores.forUser(userId).find((s) => s.kind === "daily" && s.date === date) || null;

router.use(optionalAuth);

// GET /api/daily
router.get("/", (req, res) => {
  const date = Progress.dayKey();
  const out = { date, questions: QuizGrader.stripAnswers(questionsFor(date)), completed: false };
  const prev = req.user && doneToday(req.user.id, date);
  if (prev) out.completed = true, out.result = { correct: prev.correctCount, total: prev.total, xp: prev.xp || 0 };
  res.json(out);
});

// POST /api/daily/submit  { date, answers }
router.post("/submit", (req, res) => {
  const date = Progress.dayKey();
  if (req.body.date !== date) return res.status(400).json({ error: "This challenge has expired. Reload the page to get today's questions." });
  const questions = questionsFor(date);
  const problem = QuizGrader.validateAnswers(req.body.answers, questions);
  if (problem) return res.status(400).json({ error: problem });
  if (req.user && doneToday(req.user.id, date)) return res.status(409).json({ error: "You already finished today's challenge." });

  const { correct, total } = QuizGrader.grade(req.body.answers, questions);
  const percentage = Math.round((correct / total) * 10000) / 100;
  const out = { correct, total, percentage, passed: percentage >= 50, review: QuizGrader.review(req.body.answers, questions) };
  if (!req.user) return res.json(out);

  const xpGained = QuizGrader.xpFor(correct, total) + DAILY_BONUS_XP;
  const saved = saveScoreInternal({ userId: req.user.id, subjectId: "daily", correctCount: correct, total, kind: "daily", xp: xpGained, date });
  const progress = Progress.record(req.user.id, { xp: xpGained, perfect: correct === total });
  res.json({ ...out, scoreId: saved.id, xpGained, progress });
});

module.exports = router;
module.exports.questionsFor = questionsFor;

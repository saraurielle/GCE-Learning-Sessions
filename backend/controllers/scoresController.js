const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const Score = require("../models/Score");

const SCORES_FILE = path.join(__dirname, "..", "data", "scores.json");

function readScores() {
  const raw = fs.readFileSync(SCORES_FILE, "utf-8");
  return JSON.parse(raw || "[]");
}

function writeScores(scores) {
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
}

/**
 * Internal helper (not an HTTP handler) — used by quizController right
 * after grading a submitted quiz, so a score is saved automatically.
 */
function saveScoreInternal({ userId, subjectId, correctCount, total }) {
  const score = new Score(userId, subjectId, correctCount, total);
  const scores = readScores();
  const entry = { id: `s_${crypto.randomUUID()}`, ...score };
  scores.push(entry);
  writeScores(scores);
  return entry;
}

/**
 * POST /api/scores  (requires login — mounted behind requireAuth in server.js)
 * Saves a score for the logged-in user (e.g. a quiz graded elsewhere).
 * Prefer POST /api/quiz/submit for normal quiz flow — that grades AND saves.
 */
function saveScore(req, res) {
  const { subjectId, correctCount, total } = req.body;

  if (!req.user) {
    return res.status(401).json({ error: "Login required" });
  }
  if (!subjectId || !Number.isInteger(correctCount) || !Number.isInteger(total)) {
    return res.status(400).json({ error: "subjectId, correctCount and total are required" });
  }
  if (total <= 0 || correctCount < 0 || correctCount > total) {
    return res.status(400).json({ error: "correctCount must be between 0 and total" });
  }

  const entry = saveScoreInternal({ userId: req.user.id, subjectId, correctCount, total });
  res.status(201).json(entry);
}

/**
 * GET /api/scores/:userId  (requires login)
 * Returns a user's past quiz history, most recent first.
 * Users may only read their own history.
 */
function getScoresForUser(req, res) {
  const { userId } = req.params;
  if (!req.user || req.user.id !== userId) {
    return res.status(403).json({ error: "You can only view your own scores" });
  }
  const scores = readScores()
    .filter((s) => s.userId === userId)
    .sort((a, b) => new Date(b.dateTaken) - new Date(a.dateTaken));

  res.json(scores);
}

module.exports = { saveScore, saveScoreInternal, getScoresForUser };

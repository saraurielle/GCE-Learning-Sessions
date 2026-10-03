const crypto = require("crypto");
const Score = require("../models/Score");
const Scores = require("../services/Scores");

/**
 * Internal helper (not an HTTP handler): used by the quiz and daily controllers right after
 * grading, so a score is only ever created by the server. `extra` adds { kind, xp, date }.
 */
function saveScoreInternal({ userId, subjectId, correctCount, total, ...extra }) {
  const score = new Score(userId, subjectId, correctCount, total);
  return Scores.add({ id: `s_${crypto.randomUUID()}`, ...score, ...extra });
}

/** GET /api/scores/:userId  (login required, own history only) */
function getScoresForUser(req, res) {
  const { userId } = req.params;
  if (!req.user || req.user.id !== userId) {
    return res.status(403).json({ error: "You can only view your own scores" });
  }
  res.json(Scores.forUser(userId).sort((a, b) => new Date(b.dateTaken) - new Date(a.dateTaken)));
}

module.exports = { saveScoreInternal, getScoresForUser };

const quizBank = require("../data/quiz.json");
const QuizGrader = require("../services/QuizGrader");
const Scores = require("../services/Scores");
const Progress = require("../services/Progress");
const { saveScoreInternal } = require("./scoresController");

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const XP_ATTEMPTS_PER_DAY = 3; // only the first 3 attempts per subject per UTC day earn XP

/** GET /api/quiz/:subjectId  (questions WITHOUT the correct answers) */
function getQuiz(req, res) {
  const questions = has(quizBank, req.params.subjectId) ? quizBank[req.params.subjectId] : null;
  if (!questions) return res.status(404).json({ error: "No quiz found for this subject" });
  res.json(QuizGrader.stripAnswers(questions));
}

/**
 * POST /api/quiz/submit   { subjectId, answers: [0,2,null,...] }
 * Graded on the server. Logged-in users get XP and a saved score; guests only get the marking.
 */
function submitQuiz(req, res) {
  const subjectId = String(req.body.subjectId);
  const questions = has(quizBank, subjectId) ? quizBank[subjectId] : null;
  if (!questions) return res.status(404).json({ error: "No quiz found for this subject" });

  const { answers } = req.body;
  const problem = QuizGrader.validateAnswers(answers, questions);
  if (problem) return res.status(400).json({ error: problem });

  const { correct, total } = QuizGrader.grade(answers, questions);
  const percentage = Math.round((correct / total) * 10000) / 100;
  const out = { correct, total, percentage, passed: percentage >= 50, review: QuizGrader.review(answers, questions) };

  if (!req.user) return res.json(out); // guest: nothing is stored

  const today = Progress.dayKey();
  const attemptsToday = Scores.forUser(req.user.id).filter(
    (s) => (s.kind || "quiz") === "quiz" && s.subjectId === subjectId && String(s.dateTaken).startsWith(today)
  ).length;
  const xpGained = attemptsToday < XP_ATTEMPTS_PER_DAY ? QuizGrader.xpFor(correct, total) : 0;

  const saved = saveScoreInternal({ userId: req.user.id, subjectId, correctCount: correct, total, kind: "quiz", xp: xpGained });
  const progress = Progress.record(req.user.id, { xp: xpGained, perfect: correct === total });
  res.json({ ...out, scoreId: saved.id, xpGained, progress });
}

module.exports = { getQuiz, submitQuiz };

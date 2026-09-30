const quizBank = require("../data/quiz.json");
const QuizGrader = require("../services/QuizGrader");
const { saveScoreInternal } = require("./scoresController");

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * GET /api/quiz/:subjectId
 * Returns quiz questions WITHOUT correct answers, so the frontend can't
 * read them out of the network response before submitting.
 */
function getQuiz(req, res) {
  const { subjectId } = req.params;
  const questions = has(quizBank, subjectId) ? quizBank[subjectId] : null;

  if (!questions) {
    return res.status(404).json({ error: "No quiz found for this subject" });
  }

  res.json(QuizGrader.stripAnswers(questions));
}

/**
 * POST /api/quiz/submit
 * Body: { subjectId, answers: [0,2,null,...] }  (null = unanswered)
 * Grades server-side (so the frontend can't fake a score) and saves the result.
 * The score is saved under the logged-in user (JWT), or "guest" if not logged in.
 * A userId in the body is ignored so nobody can save scores under someone else.
 */
function submitQuiz(req, res) {
  const { subjectId, answers } = req.body;
  const questions = has(quizBank, String(subjectId)) ? quizBank[subjectId] : null;

  if (!questions) {
    return res.status(404).json({ error: "No quiz found for this subject" });
  }
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    return res.status(400).json({
      error: `answers must be an array of length ${questions.length}`,
    });
  }

  const validAnswer = (a) => a === null || (Number.isInteger(a) && a >= 0);
  if (!answers.every(validAnswer)) {
    return res.status(400).json({ error: "each answer must be an option index or null" });
  }

  const { correct, total } = QuizGrader.grade(answers, questions);
  const saved = saveScoreInternal({
    userId: req.user ? req.user.id : "guest",
    subjectId,
    correctCount: correct,
    total,
  });

  res.json({
    correct,
    total,
    percentage: saved.percentage,
    passed: saved.percentage >= 50,
    scoreId: saved.id,
  });
}

module.exports = { getQuiz, submitQuiz };

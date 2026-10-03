const subjects = require("../data/subjects.json");
const papers = require("../data/papers.json");
const quizBank = require("../data/quiz.json");

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const withCounts = (s) => ({
  ...s,
  paperCount: has(papers, s.id) ? Object.values(papers[s.id]).reduce((n, year) => n + Object.keys(year).length, 0) : 0,
  questionCount: has(quizBank, s.id) ? quizBank[s.id].length : 0,
});

/** GET /api/subjects */
function getAllSubjects(req, res) {
  res.json(subjects.map(withCounts));
}

/** GET /api/subjects/:id */
function getSubjectById(req, res) {
  const subject = subjects.find((s) => s.id === req.params.id);
  if (!subject) return res.status(404).json({ error: "Subject not found" });
  res.json(withCounts(subject));
}

module.exports = { getAllSubjects, getSubjectById };

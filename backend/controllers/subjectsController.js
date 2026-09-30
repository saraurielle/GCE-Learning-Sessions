const subjects = require("../data/subjects.json");

/**
 * GET /api/subjects
 * Returns the full list of subjects.
 */
function getAllSubjects(req, res) {
  res.json(subjects);
}

/**
 * GET /api/subjects/:id
 * Returns a single subject by id, or 404 if not found.
 */
function getSubjectById(req, res) {
  const subject = subjects.find((s) => s.id === req.params.id);
  if (!subject) {
    return res.status(404).json({ error: "Subject not found" });
  }
  res.json(subject);
}

module.exports = { getAllSubjects, getSubjectById };

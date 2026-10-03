const express = require("express");
const router = express.Router();
const subjects = require("../data/subjects.json");
const papers = require("../data/papers.json");

// GET /api/search?q=word  ->  { subjects, questions }
router.get("/", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase().slice(0, 60);
  if (q.length < 2) return res.json({ subjects: [], questions: [] });

  const matchedSubjects = subjects
    .filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q))
    .map(({ id, name, icon }) => ({ id, name, icon }));

  const questions = [];
  outer: for (const s of subjects) {
    const byYear = papers[s.id] || {};
    for (const year of Object.keys(byYear).sort((a, b) => b - a)) {
      for (const paper of Object.keys(byYear[year])) {
        byYear[year][paper].forEach(([title, prompt, solution], index) => {
          if (questions.length < 8 && (prompt.toLowerCase().includes(q) || solution.toLowerCase().includes(q))) {
            questions.push({ subjectId: s.id, subjectName: s.name, subjectIcon: s.icon, year: Number(year), paper: Number(paper), index, title, prompt });
          }
        });
        if (questions.length >= 8) break outer;
      }
    }
  }
  res.json({ subjects: matchedSubjects, questions });
});

module.exports = router;

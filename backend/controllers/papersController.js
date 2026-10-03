const papers = require("../data/papers.json");

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * GET /api/papers/:subjectId
 * Returns the list of available { year, paper } combinations for a subject.
 * This powers the "choose a year and paper" screen (papers.html).
 */
function getPapersList(req, res) {
  const { subjectId } = req.params;
  const subjectPapers = has(papers, subjectId) ? papers[subjectId] : null;

  if (!subjectPapers) {
    return res.status(404).json({ error: "No papers found for this subject" });
  }

  const list = Object.entries(subjectPapers).flatMap(([year, paperNumbers]) =>
    Object.entries(paperNumbers).map(([paperNumber, questions]) => ({
      year: Number(year),
      paper: Number(paperNumber),
      questions: questions.length,
    }))
  );

  res.json(list);
}

/**
 * GET /api/papers/:subjectId/:year/:paper
 * Returns the actual study questions for one paper.
 * This powers learning.html — replaces the undefined `questions` variable
 * that was previously hardcoded in the frontend.
 */
function getPaperContent(req, res) {
  const { subjectId, year, paper } = req.params;
  const questions =
    has(papers, subjectId) && has(papers[subjectId], year) && has(papers[subjectId][year], paper)
      ? papers[subjectId][year][paper]
      : null;

  if (!questions) {
    return res.status(404).json({ error: "Paper not found" });
  }

  res.json({
    subjectId,
    year: Number(year),
    paper: Number(paper),
    questions, // array of [title, prompt, explanation]
  });
}

module.exports = { getPapersList, getPaperContent };

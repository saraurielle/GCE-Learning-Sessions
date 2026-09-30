/**
 * Paper model
 * Represents one past-paper (a specific subject + year + paper number)
 * and the list of study questions it contains.
 */
class Paper {
  constructor(subjectId, year, paperNumber, questions) {
    this.subjectId = subjectId;
    this.year = Number(year);
    this.paperNumber = Number(paperNumber);
    // questions: [{ title, prompt, explanation }]
    this.questions = questions;
  }
}

module.exports = Paper;

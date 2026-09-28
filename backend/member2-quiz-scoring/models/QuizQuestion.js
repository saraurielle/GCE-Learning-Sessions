/**
 * QuizQuestion model
 * correctAnswerIndex is the index into `options` that is correct.
 * IMPORTANT: never send correctAnswerIndex to the frontend before grading —
 * see QuizGrader.stripAnswers().
 */
class QuizQuestion {
  constructor(id, question, options, correctAnswerIndex) {
    this.id = id;
    this.question = question;
    this.options = options; // array of strings
    this.correctAnswerIndex = correctAnswerIndex;
  }
}

module.exports = QuizQuestion;

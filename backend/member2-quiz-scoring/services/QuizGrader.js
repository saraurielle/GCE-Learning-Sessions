/**
 * QuizGrader
 * Pure grading logic — no HTTP, no storage. Kept separate from the
 * controller so it's easy to unit test on its own.
 */
class QuizGrader {
  /**
   * @param {number[]} userAnswers - option indices chosen by the user, in question order
   * @param {object[]} quizQuestions - full question objects (with correctAnswerIndex)
   * @returns {{ correct: number, total: number }}
   */
  static grade(userAnswers, quizQuestions) {
    let correct = 0;
    quizQuestions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswerIndex) correct++;
    });
    return { correct, total: quizQuestions.length };
  }

  /**
   * Removes correctAnswerIndex before sending questions to the client,
   * so the quiz can't be "cheated" by reading the API response.
   */
  static stripAnswers(quizQuestions) {
    return quizQuestions.map(({ id, question, options }) => ({ id, question, options }));
  }
}

module.exports = QuizGrader;

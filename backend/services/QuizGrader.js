/**
 * QuizGrader: pure grading logic, no HTTP and no storage.
 */
const QuizGrader = {
  grade(userAnswers, quizQuestions) {
    let correct = 0;
    quizQuestions.forEach((q, i) => { if (userAnswers[i] === q.correctAnswerIndex) correct++; });
    return { correct, total: quizQuestions.length };
  },

  /** Removes the answers before questions are sent to the browser. Keeps subject info if present. */
  stripAnswers(quizQuestions) {
    return quizQuestions.map(({ id, question, options, subjectName, subjectIcon }) => {
      const out = { id, question, options };
      if (subjectName) { out.subjectName = subjectName; out.subjectIcon = subjectIcon; }
      return out;
    });
  },

  /** Returns null if valid, else an error message. */
  validateAnswers(answers, quizQuestions) {
    if (!Array.isArray(answers) || answers.length !== quizQuestions.length) {
      return `answers must be an array of length ${quizQuestions.length}`;
    }
    const ok = answers.every((a, i) => a === null || (Number.isInteger(a) && a >= 0 && a < quizQuestions[i].options.length));
    return ok ? null : "each answer must be an option index or null";
  },

  /** Per-question review shown on the results page. */
  review(answers, quizQuestions) {
    return quizQuestions.map((q, i) => ({
      chosen: answers[i],
      correctIndex: q.correctAnswerIndex,
      isCorrect: answers[i] === q.correctAnswerIndex,
      explanation: q.explanation || "",
    }));
  },

  /** 10 XP per correct answer, +20 for a pass (50%+), +30 for a perfect score. */
  xpFor(correct, total) {
    if (!total) return 0;
    const pct = (correct / total) * 100;
    return correct * 10 + (pct >= 50 ? 20 : 0) + (correct === total ? 30 : 0);
  },
};

module.exports = QuizGrader;

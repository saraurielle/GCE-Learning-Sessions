/**
 * Score model
 * Represents one completed quiz attempt.
 */
class Score {
  constructor(userId, subjectId, correctCount, total, dateTaken = new Date().toISOString()) {
    this.userId = userId;
    this.subjectId = subjectId;
    this.correctCount = correctCount;
    this.total = total;
    this.percentage = total > 0 ? Math.round((correctCount / total) * 10000) / 100 : 0;
    this.dateTaken = dateTaken;
  }
}

module.exports = Score;

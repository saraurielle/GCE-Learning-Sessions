const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");

// GET /api/quiz/:subjectId
router.get("/:subjectId", quizController.getQuiz);

// POST /api/quiz/submit
router.post("/submit", quizController.submitQuiz);

module.exports = router;

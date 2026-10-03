const express = require("express");
const router = express.Router();
const scoresController = require("../controllers/scoresController");

// Scores are created by the server when it grades a quiz (POST /api/scores was removed).
// GET /api/scores/:userId
router.get("/:userId", scoresController.getScoresForUser);

module.exports = router;

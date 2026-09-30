const express = require("express");
const router = express.Router();
const scoresController = require("../controllers/scoresController");

// POST /api/scores
router.post("/", scoresController.saveScore);

// GET /api/scores/:userId
router.get("/:userId", scoresController.getScoresForUser);

module.exports = router;

const express = require("express");
const router = express.Router();
const papersController = require("../controllers/papersController");

// GET /api/papers/:subjectId
router.get("/:subjectId", papersController.getPapersList);

// GET /api/papers/:subjectId/:year/:paper
router.get("/:subjectId/:year/:paper", papersController.getPaperContent);

module.exports = router;

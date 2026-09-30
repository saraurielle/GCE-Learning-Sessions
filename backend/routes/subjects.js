const express = require("express");
const router = express.Router();
const subjectsController = require("../controllers/subjectsController");

// GET /api/subjects
router.get("/", subjectsController.getAllSubjects);

// GET /api/subjects/:id
router.get("/:id", subjectsController.getSubjectById);

module.exports = router;

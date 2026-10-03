const express = require("express");
const router = express.Router();
const Progress = require("../services/Progress");
const { requireAuth } = require("../middleware/auth");

// GET /api/stats/me
router.get("/me", requireAuth, (req, res) => res.json(Progress.stats(req.user.id)));

module.exports = router;

const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

// POST /api/auth/register
router.post("/register", authController.register);

// POST /api/auth/login
router.post("/login", authController.login);

// GET /api/auth/me
router.get("/me", requireAuth, authController.me);

module.exports = router;

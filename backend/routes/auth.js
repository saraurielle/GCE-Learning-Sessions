const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { limitMiddleware } = require("../services/RateLimiter");

// Slow down password guessing (per IP). Generous: a classroom may share one IP.
const guard = limitMiddleware({ windowMs: 15 * 60 * 1000, max: 200, key: (req) => req.ip, message: "Too many attempts. Try again in a few minutes." });

router.post("/register", guard, authController.register);
router.post("/login", guard, authController.login);
router.get("/me", requireAuth, authController.me);
router.post("/password", requireAuth, guard, authController.changePassword);

module.exports = router;

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const errorHandler = require("./middleware/errorHandler");
const { securityHeaders } = require("./middleware/security");
const { requireAuth, optionalAuth } = require("./middleware/auth");
const { limitMiddleware } = require("./services/RateLimiter");
const Reminders = require("./services/Reminders");

// Routes
const subjectsRoutes = require("./routes/subjects");
const papersRoutes = require("./routes/papers");
const quizRoutes = require("./routes/quiz");
const scoresRoutes = require("./routes/scores");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const notificationsRoutes = require("./routes/notifications");
const statsRoutes = require("./routes/stats");
const leaderboardRoutes = require("./routes/leaderboard");
const dailyRoutes = require("./routes/daily");
const studyRoutes = require("./routes/study");
const profileRoutes = require("./routes/profile");
const searchRoutes = require("./routes/search");

const app = express();

app.disable("x-powered-by");
app.use(securityHeaders);
// CORS_ORIGIN (comma separated) limits which sites may call the API from a browser; default: any.
const origins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : undefined)); // lets a separately served frontend call this API
app.use(express.json({ limit: "20kb" }));

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// A generous ceiling per IP (a whole classroom may share one school IP). Change with API_RATE_LIMIT.
app.use("/api", limitMiddleware({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT) || 1000,
  key: (req) => req.ip,
  message: "Too many requests. Please slow down.",
}));

// Mount the API routes
app.use("/api/subjects", subjectsRoutes);
app.use("/api/papers", papersRoutes);
app.use("/api/quiz/submit", optionalAuth); // guests allowed; logged-in users get XP and scores saved
app.use("/api/quiz", quizRoutes);
app.use("/api/daily", dailyRoutes);        // login optional (same rules as quiz)
app.use("/api/scores", requireAuth, scoresRoutes); // score history is private
app.use("/api/study", requireAuth, studyRoutes);   // bookmarks + completed papers are private
app.use("/api/profile", requireAuth, profileRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/notifications", notificationsRoutes); // per-route auth (the live stream uses ?token=)
app.use("/api/search", searchRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes); // community chat: public read + live stream, login to post

// 404 for unknown API routes
app.use("/api", (req, res) => res.status(404).json({ error: "Route not found" }));

// Serve the frontend from the same server (http://localhost:3000)
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Central error handler — must be mounted last
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`GCE Learning Session running on http://localhost:${PORT}`);
    if (!process.env.JWT_SECRET) console.warn("Tip: set JWT_SECRET in .env (see .env.example).");
    Reminders.start();
  });
}

module.exports = app;

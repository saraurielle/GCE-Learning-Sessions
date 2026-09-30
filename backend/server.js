require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const errorHandler = require("./middleware/errorHandler");
const { requireAuth, optionalAuth } = require("./middleware/auth");

// Routes
const subjectsRoutes = require("./routes/subjects");
const papersRoutes = require("./routes/papers");
const quizRoutes = require("./routes/quiz");
const scoresRoutes = require("./routes/scores");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");

const app = express();

app.use(cors()); // allows the frontend (served separately) to call this API
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Mount the API routes
app.use("/api/subjects", subjectsRoutes);
app.use("/api/papers", papersRoutes);
app.use("/api/quiz/submit", optionalAuth); // guests allowed; logged-in users get scores saved to their account
app.use("/api/quiz", quizRoutes);
app.use("/api/scores", requireAuth, scoresRoutes); // score history is private
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
  });
}

module.exports = app;

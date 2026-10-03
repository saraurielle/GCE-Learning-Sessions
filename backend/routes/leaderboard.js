const express = require("express");
const router = express.Router();
const Progress = require("../services/Progress");
const Users = require("../services/Users");
const { optionalAuth } = require("../middleware/auth");

// GET /api/leaderboard?period=week|all&limit=20   (login optional, to mark "you")
router.get("/", optionalAuth, (req, res) => {
  const period = req.query.period === "all" ? "all" : "week";
  let limit = Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) limit = 20;
  limit = Math.min(limit, 100);

  const rows = Progress.standings(period).map((r, i) => ({
    rank: i + 1,
    userId: r.user.id,
    username: r.user.username,
    avatar: Users.publicUser(r.user).avatar,
    level: Progress.levelFor(r.totalXp),
    xp: r.xp,
    isMe: Boolean(req.user && req.user.id === r.user.id),
  }));
  const mine = rows.find((r) => r.isMe);
  res.json({
    period,
    totalPlayers: rows.length,
    me: mine ? { rank: mine.rank, xp: mine.xp } : null,
    entries: rows.slice(0, limit).map(({ userId, ...e }) => e),
  });
});

module.exports = router;

const express = require("express");
const router = express.Router();
const Users = require("../services/Users");

// GET /api/profile  ->  { user, avatars }
router.get("/", (req, res) => {
  res.json({ user: Users.publicUser(Users.findById(req.user.id)), avatars: Users.AVATARS });
});

// PATCH /api/profile  { avatar?, bio?, dailyGoal?, prefs?: { mentions?, reminders? } }
router.patch("/", (req, res) => {
  const { avatar, bio, dailyGoal, prefs } = req.body || {};
  if (avatar !== undefined && !Users.AVATARS.includes(avatar)) return res.status(400).json({ error: "Choose one of the available avatars" });
  if (bio !== undefined && (typeof bio !== "string" || bio.length > 160)) return res.status(400).json({ error: "Bio must be at most 160 characters" });
  if (dailyGoal !== undefined && !(Number.isInteger(dailyGoal) && dailyGoal >= 1 && dailyGoal <= 10)) return res.status(400).json({ error: "Daily goal must be a whole number from 1 to 10" });

  const users = Users.readUsers();
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(401).json({ error: "Account not found" });
  if (avatar !== undefined) user.avatar = avatar;
  if (bio !== undefined) user.bio = bio.trim();
  if (dailyGoal !== undefined) user.dailyGoal = dailyGoal;
  if (prefs && typeof prefs === "object") {
    user.prefs = { mentions: true, reminders: true, ...(user.prefs || {}) };
    if (typeof prefs.mentions === "boolean") user.prefs.mentions = prefs.mentions;
    if (typeof prefs.reminders === "boolean") user.prefs.reminders = prefs.reminders;
  }
  Users.writeUsers(users);
  res.json({ user: Users.publicUser(user) });
});

module.exports = router;

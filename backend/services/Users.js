const { DATA_DIR } = require("../config/db");
const Store = require("./Store");

const AVATARS = ["🎓", "📚", "✏️", "🧠", "🚀", "🦉", "🦁", "🐯", "🐼", "🦊", "🌟", "⚡"];
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;

const readUsers = () => Store.read(DATA_DIR.users, []);
const writeUsers = (users) => Store.write(DATA_DIR.users, users);
const findById = (id) => readUsers().find((u) => u.id === id) || null;
const findByName = (name) => readUsers().find((u) => u.username.toLowerCase() === String(name).toLowerCase()) || null;

/** Usernames listed in ADMIN_USERNAMES (comma separated, case-insensitive). */
function isAdminName(username) {
  const list = (process.env.ADMIN_USERNAMES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(String(username || "").toLowerCase());
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    avatar: u.avatar || AVATARS[0],
    bio: u.bio || "",
    dailyGoal: Number.isInteger(u.dailyGoal) ? u.dailyGoal : 1,
    prefs: { mentions: true, reminders: true, ...(u.prefs || {}) },
    isAdmin: isAdminName(u.username),
    createdAt: u.createdAt || null,
  };
}

module.exports = { AVATARS, USERNAME_RE, readUsers, writeUsers, findById, findByName, isAdminName, publicUser };

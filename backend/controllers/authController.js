const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Users = require("../services/Users");
const Notifications = require("../services/Notifications");
const { JWT_SECRET } = require("../middleware/auth");

const str = (v) => (typeof v === "string" ? v : "");

/** POST /api/auth/register  { username, password } */
async function register(req, res, next) {
  try {
    const username = str(req.body.username).trim();
    const password = str(req.body.password);
    if (!username || !password) return res.status(400).json({ error: "username and password are required" });
    if (!Users.USERNAME_RE.test(username)) {
      return res.status(400).json({ error: "username must be 3-20 characters: letters, numbers, . _ or -" });
    }
    if (password.length < 6) return res.status(400).json({ error: "password must be at least 6 characters" });

    const users = Users.readUsers();
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: "Username already taken" });
    }
    const user = {
      id: `u_${crypto.randomUUID()}`,
      username,
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: new Date().toISOString(),
      avatar: Users.AVATARS[0],
      bio: "",
      dailyGoal: 1,
      prefs: { mentions: true, reminders: true },
    };
    users.push(user);
    Users.writeUsers(users);
    Notifications.add(user.id, {
      type: "welcome",
      title: `Welcome, ${username}`,
      body: "Try today's daily challenge to start your streak.",
      link: "pages/daily.html",
    });
    res.status(201).json({ id: user.id, username: user.username });
  } catch (err) { next(err); }
}

/** POST /api/auth/login  { username, password } */
async function login(req, res, next) {
  try {
    const username = str(req.body.username).trim();
    const password = str(req.body.password);
    if (!username || !password) return res.status(400).json({ error: "username and password are required" });
    const user = Users.findByName(username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: Users.publicUser(user) });
  } catch (err) { next(err); }
}

/** GET /api/auth/me */
function me(req, res) {
  res.json({ user: Users.publicUser(Users.findById(req.user.id)) });
}

/** POST /api/auth/password  { currentPassword, newPassword } */
async function changePassword(req, res, next) {
  try {
    const current = str(req.body.currentPassword);
    const next_ = str(req.body.newPassword);
    if (!current || !next_) return res.status(400).json({ error: "currentPassword and newPassword are required" });
    if (next_.length < 6) return res.status(400).json({ error: "new password must be at least 6 characters" });
    const users = Users.readUsers();
    const user = users.find((u) => u.id === req.user.id);
    if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
      return res.status(400).json({ error: "Current password is wrong" });
    }
    user.passwordHash = await bcrypt.hash(next_, 10);
    Users.writeUsers(users);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { register, login, me, changePassword };

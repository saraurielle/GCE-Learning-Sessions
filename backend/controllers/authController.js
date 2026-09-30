const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { DATA_DIR } = require("../config/db");
const { JWT_SECRET } = require("../middleware/auth");

function readUsers() {
  const raw = fs.readFileSync(DATA_DIR.users, "utf-8");
  return JSON.parse(raw || "[]");
}

function writeUsers(users) {
  fs.writeFileSync(DATA_DIR.users, JSON.stringify(users, null, 2));
}

/**
 * POST /api/auth/register
 * Body: { username, password }
 */
async function register(req, res, next) {
  try {
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: "username must be at least 3 characters" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    const users = readUsers();
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = { id: `u_${crypto.randomUUID()}`, username, passwordHash };
    users.push(newUser);
    writeUsers(users);

    res.status(201).json({ id: newUser.id, username: newUser.username });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
async function login(req, res, next) {
  try {
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const user = readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Requires Authorization: Bearer <token> (see middleware/auth.js)
 */
function me(req, res) {
  res.json({ user: { id: req.user.id, username: req.user.username } });
}

module.exports = { register, login, me };

const jwt = require("jsonwebtoken");
const Users = require("../services/Users");

const DEV_SECRET = "dev-only-secret-change-me";
const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;

if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith("change-this"))) {
  throw new Error("Set a real JWT_SECRET in .env before running with NODE_ENV=production.");
}

function readToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

/** Returns the token payload if the token is valid AND the account still exists, else null. */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return Users.findById(payload.id) ? payload : null;
  } catch (err) {
    return null;
  }
}

/** Requires "Authorization: Bearer <token>". Attaches the payload to req.user. */
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: "Missing or invalid Authorization header" });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
  req.user = payload;
  next();
}

/** Never rejects: a valid token sets req.user, otherwise the request continues as a guest. */
function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  next();
}

/** Use after requireAuth. */
function requireAdmin(req, res, next) {
  if (!req.user || !Users.isAdminName(req.user.username)) return res.status(403).json({ error: "Admins only" });
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin, verifyToken, JWT_SECRET };

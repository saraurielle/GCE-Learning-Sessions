const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";

function readToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

/**
 * Protects a route: requires an "Authorization: Bearer <token>" header.
 * On success, attaches the decoded payload to req.user.
 */
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Like requireAuth, but never rejects: if a valid token is present,
 * req.user is set; otherwise the request continues as a guest.
 * Used for quiz submission so guests can still take quizzes.
 */
function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // ignore bad/expired token and continue as guest
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, JWT_SECRET };

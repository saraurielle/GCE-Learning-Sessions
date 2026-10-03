const express = require("express");
const router = express.Router();
const Notifications = require("../services/Notifications");
const Users = require("../services/Users");
const { requireAuth, requireAdmin, verifyToken } = require("../middleware/auth");

// GET /api/notifications/stream?token=...   (SSE; EventSource cannot send headers, so the token is in the URL)
router.get("/stream", (req, res) => {
  const payload = verifyToken(String(req.query.token || ""));
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  Notifications.subscribe(payload.id, res);
  res.write(`event: ready\ndata: ${JSON.stringify({ unread: Notifications.unread(payload.id) })}\n\n`);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => { clearInterval(ping); Notifications.unsubscribe(payload.id, res); });
});

// POST /api/notifications/announce  { title, body?, link? }  (admins)
router.post("/announce", requireAuth, requireAdmin, (req, res) => {
  const title = String(req.body.title || "").trim().slice(0, 100);
  const body = String(req.body.body || "").trim().slice(0, 240);
  const link = String(req.body.link || "");
  if (!title) return res.status(400).json({ error: "title is required" });
  if (link && !/^(index\.html|pages\/[a-z-]+\.html)$/.test(link)) return res.status(400).json({ error: "invalid link" });
  const users = Users.readUsers();
  users.forEach((u) => Notifications.add(u.id, { type: "announcement", title, body, link }));
  res.json({ sent: users.length });
});

router.post("/read-all", requireAuth, (req, res) => {
  Notifications.markAllRead(req.user.id);
  res.json({ unread: 0 });
});

// GET /api/notifications?limit=8  ->  { items, unread }
router.get("/", requireAuth, (req, res) => {
  let limit = Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) limit = 20;
  res.json({ items: Notifications.list(req.user.id).slice(0, Math.min(limit, 100)), unread: Notifications.unread(req.user.id) });
});

router.delete("/", requireAuth, (req, res) => {
  Notifications.clear(req.user.id);
  res.json({ ok: true, unread: 0 });
});

router.post("/:id/read", requireAuth, (req, res) => {
  if (!Notifications.markRead(req.user.id, req.params.id)) return res.status(404).json({ error: "Notification not found" });
  res.json({ unread: Notifications.unread(req.user.id) });
});

router.delete("/:id", requireAuth, (req, res) => {
  if (!Notifications.remove(req.user.id, req.params.id)) return res.status(404).json({ error: "Notification not found" });
  res.json({ ok: true, unread: Notifications.unread(req.user.id) });
});

module.exports = router;

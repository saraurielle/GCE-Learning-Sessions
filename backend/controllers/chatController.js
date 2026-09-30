const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DATA_DIR } = require("../config/db");
const subjects = require("../data/subjects.json");
const Message = require("../models/Message");
const ChatHub = require("../services/ChatHub");

// CHAT_DATA_FILE lets tests use a temporary file instead of the real one.
const CHAT_FILE = process.env.CHAT_DATA_FILE || DATA_DIR.chat;

const MAX_LENGTH = 500;        // characters per message
const MAX_PER_ROOM = 500;      // oldest messages are dropped beyond this
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const RATE_WINDOW_MS = 10 * 1000;
const RATE_MAX = 5;            // at most 5 messages per 10 seconds per user

// One "General" room plus one room per subject.
const ROOMS = [
  { id: "general", name: "General", icon: "💬" },
  ...subjects.map((s) => ({ id: s.id, name: s.name, icon: s.icon })),
];
const roomExists = (id) => ROOMS.some((r) => r.id === id);

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CHAT_FILE, "utf-8") || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    return {}; // missing or empty file -> no messages yet
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(CHAT_FILE), { recursive: true });
  fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2));
}

// Simple in-memory rate limiter (per user id).
const recent = new Map();
function tooFast(userId) {
  const now = Date.now();
  const times = (recent.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX) {
    recent.set(userId, times);
    return true;
  }
  times.push(now);
  recent.set(userId, times);
  return false;
}

/** GET /api/chat/rooms */
function getRooms(req, res) {
  res.json(ROOMS);
}

/**
 * GET /api/chat/:room/messages?limit=50&before=<ISO date>
 * Public (guests can read). Returns messages oldest -> newest.
 */
function getMessages(req, res) {
  const { room } = req.params;
  if (!roomExists(room)) return res.status(404).json({ error: "Room not found" });

  let limit = Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);

  let list = readAll()[room] || [];
  const before = req.query.before ? Date.parse(req.query.before) : NaN;
  if (!Number.isNaN(before)) list = list.filter((m) => Date.parse(m.createdAt) < before);

  res.json(list.slice(-limit));
}

/**
 * POST /api/chat/:room/messages   (login required)
 * Body: { text }
 */
function postMessage(req, res) {
  const { room } = req.params;
  if (!roomExists(room)) return res.status(404).json({ error: "Room not found" });
  if (!req.user) return res.status(401).json({ error: "Login required" });

  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "Message cannot be empty" });
  if (text.length > MAX_LENGTH) {
    return res.status(400).json({ error: `Message must be at most ${MAX_LENGTH} characters` });
  }
  if (tooFast(req.user.id)) {
    return res.status(429).json({ error: "You are sending messages too fast. Please wait a few seconds." });
  }

  const message = {
    id: `c_${crypto.randomUUID()}`,
    ...new Message(room, req.user.id, req.user.username, text),
  };

  const all = readAll();
  all[room] = (all[room] || []).concat(message).slice(-MAX_PER_ROOM);
  writeAll(all);

  ChatHub.broadcast(room, "chat", message);
  res.status(201).json(message);
}

/**
 * DELETE /api/chat/:room/messages/:messageId   (login required)
 * You can only delete your own messages.
 */
function deleteMessage(req, res) {
  const { room, messageId } = req.params;
  if (!roomExists(room)) return res.status(404).json({ error: "Room not found" });
  if (!req.user) return res.status(401).json({ error: "Login required" });

  const all = readAll();
  const list = all[room] || [];
  const target = list.find((m) => m.id === messageId);
  if (!target) return res.status(404).json({ error: "Message not found" });
  if (target.userId !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own messages" });
  }

  all[room] = list.filter((m) => m.id !== messageId);
  writeAll(all);

  ChatHub.broadcast(room, "delete", { id: messageId });
  res.json({ ok: true, id: messageId });
}

/**
 * GET /api/chat/:room/stream
 * Server-Sent Events: pushes "chat", "delete" and "presence" events live.
 * Public (guests can watch). The browser reconnects automatically.
 */
function stream(req, res) {
  const { room } = req.params;
  if (!roomExists(room)) return res.status(404).json({ error: "Room not found" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  ChatHub.subscribe(room, res);

  // Keep-alive comment so proxies don't close an idle connection.
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(ping);
    ChatHub.unsubscribe(room, res);
  });
}

module.exports = { getRooms, getMessages, postMessage, deleteMessage, stream, ROOMS, MAX_LENGTH };

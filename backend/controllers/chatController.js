const crypto = require("crypto");
const { DATA_DIR } = require("../config/db");
const Store = require("../services/Store");
const subjects = require("../data/subjects.json");
const Message = require("../models/Message");
const ChatHub = require("../services/ChatHub");
const Users = require("../services/Users");
const Notifications = require("../services/Notifications");

// CHAT_DATA_FILE lets tests use a temporary file instead of the real one.
const CHAT_FILE = process.env.CHAT_DATA_FILE || DATA_DIR.chat;

const MAX_LENGTH = 500;        // characters per message
const MAX_PER_ROOM = 500;      // oldest messages are dropped beyond this
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const RATE_WINDOW_MS = 10 * 1000;
const RATE_MAX = 5;            // at most 5 messages per 10 seconds per user
const REACTIONS = ["👍", "❤️", "😂", "🎉", "🤔"];
const stripVS = (s) => s.replace(/\uFE0F/g, "");

// One "General" room plus one room per subject.
const ROOMS = [
  { id: "general", name: "General", icon: "💬" },
  ...subjects.map((s) => ({ id: s.id, name: s.name, icon: s.icon })),
];
const roomExists = (id) => ROOMS.some((r) => r.id === id);

function readAll() {
  const parsed = Store.read(CHAT_FILE, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}
const writeAll = (data) => Store.write(CHAT_FILE, data);

// Simple in-memory rate limiter (per user id).
const recent = new Map();
function tooFast(userId) {
  const now = Date.now();
  const times = (recent.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX) { recent.set(userId, times); return true; }
  times.push(now);
  recent.set(userId, times);
  return false;
}

/** Usernames of real users @mentioned in the text (not yourself). */
function findMentions(text, selfName) {
  const users = Users.readUsers();
  const found = new Set();
  const re = /(^|[^A-Za-z0-9_.-])@([A-Za-z0-9_.-]{3,20})/g;
  let m;
  while ((m = re.exec(text))) {
    const clean = m[2].replace(/[._-]+$/, "");
    const u = users.find((x) => x.username.toLowerCase() === clean.toLowerCase());
    if (u && u.username.toLowerCase() !== String(selfName).toLowerCase()) found.add(u.username);
  }
  return [...found];
}

const wantsAlerts = (user) => Users.publicUser(user).prefs.mentions !== false;
const validText = (body) => (typeof body.text === "string" ? body.text.trim() : "");

/** GET /api/chat/rooms */
function getRooms(req, res) {
  res.json(ROOMS.map((r) => ({ ...r, online: ChatHub.count(r.id) })));
}

/** GET /api/chat/:room/messages?limit=50&before=<ISO date>  (public) oldest -> newest */
function getMessages(req, res) {
  const { room } = req.params;
  if (!roomExists(room)) return res.status(404).json({ error: "Room not found" });

  let limit = Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);

  let list = readAll()[room] || [];
  const before = req.query.before ? Date.parse(req.query.before) : NaN;
  if (!Number.isNaN(before)) list = list.filter((m) => Date.parse(m.createdAt) < before);

  const avatars = new Map(Users.readUsers().map((u) => [u.id, u.avatar]));
  res.json(list.slice(-limit).map((m) => ({ ...m, avatar: avatars.get(m.userId) || m.avatar || Users.AVATARS[0] })));
}

/** POST /api/chat/:room/messages  { text, replyTo? }  (login required) */
function postMessage(req, res) {
  const { room } = req.params;
  if (!roomExists(room)) return res.status(404).json({ error: "Room not found" });
  if (!req.user) return res.status(401).json({ error: "Login required" });

  const text = validText(req.body);
  if (!text) return res.status(400).json({ error: "Message cannot be empty" });
  if (text.length > MAX_LENGTH) return res.status(400).json({ error: `Message must be at most ${MAX_LENGTH} characters` });

  const all = readAll();
  let replyTo = null;
  if (req.body.replyTo) {
    const target = (all[room] || []).find((m) => m.id === req.body.replyTo);
    if (!target) return res.status(400).json({ error: "The message you are replying to no longer exists" });
    replyTo = { id: target.id, userId: target.userId, username: target.username, text: target.text.slice(0, 120) };
  }
  if (tooFast(req.user.id)) {
    return res.status(429).json({ error: "You are sending messages too fast. Please wait a few seconds." });
  }

  const me = Users.findById(req.user.id);
  const message = {
    id: `c_${crypto.randomUUID()}`,
    ...new Message(room, req.user.id, req.user.username, text),
    avatar: (me && me.avatar) || Users.AVATARS[0],
    mentions: findMentions(text, req.user.username),
    reactions: {},
    replyTo,
  };

  all[room] = (all[room] || []).concat(message).slice(-MAX_PER_ROOM);
  writeAll(all);
  ChatHub.broadcast(room, "chat", message);

  // notify people who were mentioned or replied to
  try {
    const link = `pages/chat.html?room=${encodeURIComponent(room)}#${message.id}`;
    const told = new Set();
    message.mentions.forEach((name) => {
      const u = Users.findByName(name);
      if (u && wantsAlerts(u)) {
        Notifications.add(u.id, { type: "mention", title: `${req.user.username} mentioned you`, body: text.slice(0, 100), link });
        told.add(u.id);
      }
    });
    if (replyTo && replyTo.userId !== req.user.id && !told.has(replyTo.userId)) {
      const u = Users.findById(replyTo.userId);
      if (u && wantsAlerts(u)) {
        Notifications.add(u.id, { type: "reply", title: `${req.user.username} replied to you`, body: text.slice(0, 100), link });
      }
    }
  } catch (e) { /* alerts must never stop a message */ }

  res.status(201).json(message);
}

/** PATCH /api/chat/:room/messages/:messageId  { text }  (own messages only) */
function editMessage(req, res) {
  const { room, messageId } = req.params;
  if (!roomExists(room)) return res.status(404).json({ error: "Room not found" });
  if (!req.user) return res.status(401).json({ error: "Login required" });

  const all = readAll();
  const target = (all[room] || []).find((m) => m.id === messageId);
  if (!target) return res.status(404).json({ error: "Message not found" });
  if (target.userId !== req.user.id) return res.status(403).json({ error: "You can only edit your own messages" });

  const text = validText(req.body);
  if (!text) return res.status(400).json({ error: "Message cannot be empty" });
  if (text.length > MAX_LENGTH) return res.status(400).json({ error: `Message must be at most ${MAX_LENGTH} characters` });

  target.text = text;
  target.mentions = findMentions(text, req.user.username);
  target.editedAt = new Date().toISOString();
  writeAll(all);

  ChatHub.broadcast(room, "edit", { id: target.id, text: target.text, mentions: target.mentions, editedAt: target.editedAt });
  res.json(target);
}

/** DELETE /api/chat/:room/messages/:messageId  (own messages, or any message for admins) */
function deleteMessage(req, res) {
  const { room, messageId } = req.params;
  if (!roomExists(room)) return res.status(404).json({ error: "Room not found" });
  if (!req.user) return res.status(401).json({ error: "Login required" });

  const all = readAll();
  const list = all[room] || [];
  const target = list.find((m) => m.id === messageId);
  if (!target) return res.status(404).json({ error: "Message not found" });
  if (target.userId !== req.user.id && !Users.isAdminName(req.user.username)) {
    return res.status(403).json({ error: "You can only delete your own messages" });
  }

  all[room] = list.filter((m) => m.id !== messageId);
  writeAll(all);
  ChatHub.broadcast(room, "delete", { id: messageId });
  res.json({ ok: true, id: messageId });
}

/** POST /api/chat/:room/messages/:messageId/reactions  { emoji }  (toggles your reaction) */
function react(req, res) {
  const { room, messageId } = req.params;
  if (!roomExists(room)) return res.status(404).json({ error: "Room not found" });
  if (!req.user) return res.status(401).json({ error: "Login required" });

  const emoji = REACTIONS.find((e) => stripVS(e) === stripVS(String(req.body.emoji || "")));
  if (!emoji) return res.status(400).json({ error: "Unsupported reaction" });

  const all = readAll();
  const target = (all[room] || []).find((m) => m.id === messageId);
  if (!target) return res.status(404).json({ error: "Message not found" });

  target.reactions = target.reactions || {};
  const ids = target.reactions[emoji] || [];
  target.reactions[emoji] = ids.includes(req.user.id) ? ids.filter((i) => i !== req.user.id) : ids.concat(req.user.id);
  if (!target.reactions[emoji].length) delete target.reactions[emoji];
  writeAll(all);

  ChatHub.broadcast(room, "reaction", { id: target.id, reactions: target.reactions });
  res.json({ id: target.id, reactions: target.reactions });
}

/** POST /api/chat/:room/typing  (tells the room you are typing) */
function typing(req, res) {
  const { room } = req.params;
  if (!roomExists(room)) return res.status(404).json({ error: "Room not found" });
  if (!req.user) return res.status(401).json({ error: "Login required" });
  ChatHub.broadcast(room, "typing", { userId: req.user.id, username: req.user.username });
  res.json({ ok: true });
}

/** GET /api/chat/:room/stream  Server-Sent Events: chat, edit, delete, reaction, typing, presence. */
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

  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(ping);
    ChatHub.unsubscribe(room, res);
  });
}

module.exports = { getRooms, getMessages, postMessage, editMessage, deleteMessage, react, typing, stream, ROOMS, MAX_LENGTH };

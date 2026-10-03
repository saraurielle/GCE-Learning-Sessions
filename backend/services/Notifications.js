const crypto = require("crypto");
const { DATA_DIR } = require("../config/db");
const Store = require("./Store");

const MAX_PER_USER = 200;
const clients = new Map(); // userId -> Set of open SSE responses

const readAll = () => Store.read(DATA_DIR.notifications, {});
const writeAll = (d) => Store.write(DATA_DIR.notifications, d);

const list = (userId) => readAll()[userId] || [];
const unread = (userId) => list(userId).filter((n) => !n.read).length;

function push(userId, event, data) {
  const set = clients.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) { try { res.write(payload); } catch (e) { set.delete(res); } }
}

/** Stores a notification for one user and pushes it live to their open tabs. */
function add(userId, { type, title, body = "", link = "" }) {
  const n = { id: `n_${crypto.randomUUID()}`, type, title, body, link, read: false, createdAt: new Date().toISOString() };
  const all = readAll();
  all[userId] = [n, ...(all[userId] || [])].slice(0, MAX_PER_USER);
  writeAll(all);
  push(userId, "notification", n);
  return n;
}

function markRead(userId, id) {
  const all = readAll();
  const n = (all[userId] || []).find((x) => x.id === id);
  if (!n) return false;
  n.read = true;
  writeAll(all);
  return true;
}

function markAllRead(userId) {
  const all = readAll();
  (all[userId] || []).forEach((n) => { n.read = true; });
  writeAll(all);
}

function remove(userId, id) {
  const all = readAll();
  const before = (all[userId] || []).length;
  all[userId] = (all[userId] || []).filter((n) => n.id !== id);
  writeAll(all);
  return all[userId].length !== before;
}

function clear(userId) {
  const all = readAll();
  all[userId] = [];
  writeAll(all);
}

function subscribe(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

function unsubscribe(userId, res) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (!set.size) clients.delete(userId);
}

module.exports = { add, list, unread, markRead, markAllRead, remove, clear, subscribe, unsubscribe };

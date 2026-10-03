const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const { DATA_DIR } = require("../config/db");
const Store = require("../services/Store");
const Progress = require("../services/Progress");
const subjects = require("../data/subjects.json");
const papers = require("../data/papers.json");

// requireAuth is applied in server.js (bookmarks and completed papers are private).
const PAPER_XP = 15;
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const readAll = () => Store.read(DATA_DIR.study, {});
const mine = (all, userId) => (all[userId] = all[userId] || { bookmarks: [], completed: [] });
const paperQuestions = (subjectId, year, paper) =>
  has(papers, subjectId) && has(papers[subjectId], String(year)) && has(papers[subjectId][String(year)], String(paper)) ? papers[subjectId][String(year)][String(paper)] : null;

function ref(body) {
  const subjectId = String(body.subjectId || "");
  const year = Number(body.year), paper = Number(body.paper);
  const qs = paperQuestions(subjectId, year, paper);
  return qs ? { subjectId, year, paper, qs } : null;
}

// GET /api/study  ->  { bookmarks, completed }
router.get("/", (req, res) => {
  const data = mine(readAll(), req.user.id);
  const bookmarks = data.bookmarks.map((b) => {
    const q = (paperQuestions(b.subjectId, b.year, b.paper) || [])[b.index];
    if (!q) return null;
    const subject = subjects.find((s) => s.id === b.subjectId);
    return { ...b, subjectName: subject ? subject.name : b.subjectId, title: q[0], prompt: q[1], explanation: q[2] };
  }).filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ bookmarks, completed: data.completed });
});

// POST /api/study/bookmarks  { subjectId, year, paper, index }
router.post("/bookmarks", (req, res) => {
  const r = ref(req.body);
  const index = req.body.index;
  if (!r || !Number.isInteger(index) || index < 0 || index >= r.qs.length) return res.status(400).json({ error: "That question does not exist" });
  const all = readAll();
  const data = mine(all, req.user.id);
  const existing = data.bookmarks.find((b) => b.subjectId === r.subjectId && b.year === r.year && b.paper === r.paper && b.index === index);
  if (existing) return res.json(existing);
  const bookmark = { id: `b_${crypto.randomUUID()}`, subjectId: r.subjectId, year: r.year, paper: r.paper, index, createdAt: new Date().toISOString() };
  data.bookmarks.push(bookmark);
  Store.write(DATA_DIR.study, all);
  res.status(201).json(bookmark);
});

// DELETE /api/study/bookmarks/:id
router.delete("/bookmarks/:id", (req, res) => {
  const all = readAll();
  const data = mine(all, req.user.id);
  const before = data.bookmarks.length;
  data.bookmarks = data.bookmarks.filter((b) => b.id !== req.params.id);
  if (data.bookmarks.length === before) return res.status(404).json({ error: "Bookmark not found" });
  Store.write(DATA_DIR.study, all);
  res.json({ ok: true });
});

// POST /api/study/completed  { subjectId, year, paper }   +15 XP the first time
router.post("/completed", (req, res) => {
  const r = ref(req.body);
  if (!r) return res.status(404).json({ error: "Paper not found" });
  const all = readAll();
  const data = mine(all, req.user.id);
  if (data.completed.some((c) => c.subjectId === r.subjectId && c.year === r.year && c.paper === r.paper)) {
    return res.json({ alreadyCompleted: true, xpGained: 0 });
  }
  data.completed.push({ subjectId: r.subjectId, year: r.year, paper: r.paper, at: new Date().toISOString() });
  Store.write(DATA_DIR.study, all);
  const progress = Progress.record(req.user.id, { xp: PAPER_XP });
  res.json({ xpGained: PAPER_XP, progress });
});

module.exports = router;

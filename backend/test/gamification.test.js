/**
 * Tests for XP, levels, streaks, badges and the weekly leaderboard (no server, no extra deps).
 * Run from the backend folder:  npm test
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

process.env.GCE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "gce-gami-"));

const Users = require("../services/Users");
const Progress = require("../services/Progress");
const Notifications = require("../services/Notifications");

Users.writeUsers([
  { id: "u1", username: "ann", passwordHash: "x", createdAt: new Date().toISOString() },
  { id: "u2", username: "ben", passwordHash: "x", createdAt: new Date().toISOString() },
]);
const day = (s) => new Date(`${s}T12:00:00Z`);

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok -", name); }

test("level n needs 50*(n-1)^2 XP in total", () => {
  assert.strictEqual(Progress.levelFor(0), 1);
  assert.strictEqual(Progress.levelFor(49), 1);
  assert.strictEqual(Progress.levelFor(50), 2);
  assert.strictEqual(Progress.levelFor(199), 2);
  assert.strictEqual(Progress.levelFor(200), 3);
  assert.strictEqual(Progress.levelFor(800), 5);
  const info = Progress.levelInfo(125); // level 2: 50..200
  assert.deepStrictEqual([info.level, info.xpIntoLevel, info.xpForNext, info.progress], [2, 75, 150, 50]);
});

test("streak grows on consecutive UTC days and resets after a gap", () => {
  Progress.record("u1", { xp: 10 }, day("2026-03-01"));
  Progress.record("u1", { xp: 10 }, day("2026-03-01")); // same day: no change
  assert.strictEqual(Progress.get("u1").streak.current, 1);
  Progress.record("u1", { xp: 10 }, day("2026-03-02"));
  Progress.record("u1", { xp: 10 }, day("2026-03-03"));
  assert.strictEqual(Progress.get("u1").streak.current, 3);
  Progress.record("u1", { xp: 10 }, day("2026-03-06")); // missed two days
  const p = Progress.get("u1");
  assert.strictEqual(p.streak.current, 1);
  assert.strictEqual(p.streak.longest, 3);
});

test("streak view: alive today or yesterday, dead after that", () => {
  const p = Progress.get("u1"); // last active 2026-03-06
  assert.strictEqual(Progress.streakView(p, day("2026-03-06")).activeToday, true);
  assert.strictEqual(Progress.streakView(p, day("2026-03-07")).current, 1);
  assert.strictEqual(Progress.streakView(p, day("2026-03-09")).current, 0);
});

test("streak-3 badge and notifications are created, level-up reported", () => {
  const types = Notifications.list("u1").map((n) => n.type);
  assert.ok(types.includes("badge") && types.includes("streak"));
  assert.ok(Progress.get("u1").badges["streak-3"]);
  const r = Progress.record("u2", { xp: 60 }, day("2026-03-01"));
  assert.strictEqual(r.levelUp, 2);
  assert.strictEqual(Progress.record("u2", { xp: 5 }, day("2026-03-01")).levelUp, undefined);
});

test("weekly standings only count XP since Monday (UTC); all-time counts everything", () => {
  // 2026-03-06 is a Friday; its week starts Monday 2026-03-02
  const wk = Progress.standings("week", day("2026-03-06"));
  const names = wk.map((r) => r.user.username);
  assert.ok(names.includes("ann") && names.includes("ben") === false); // ben's XP was on Sunday 03-01 -> previous week
  assert.strictEqual(wk.find((r) => r.user.username === "ann").xp, 30); // 03-02, 03-03 and 03-06
  const all = Progress.standings("all", day("2026-03-06"));
  assert.strictEqual(all.length, 2);
});

test("stats: seven day window ending today", () => {
  const s = Progress.stats("u1", day("2026-03-06"));
  assert.strictEqual(s.week.length, 7);
  assert.strictEqual(s.week[6].date, "2026-03-06");
  assert.strictEqual(s.week[6].count, 1);
  assert.strictEqual(s.badges.length, 10);
});

console.log(`\n${passed} tests passed`);

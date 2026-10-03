/**
 * Streak reminders: once a day, after REMINDER_HOUR_UTC (default 16), people whose streak
 * is at risk (active yesterday, not yet today) get one notification, if they allow it.
 */
const { DATA_DIR } = require("../config/db");
const Store = require("./Store");
const Users = require("./Users");
const Progress = require("./Progress");
const Notifications = require("./Notifications");

function run(now = new Date()) {
  const hour = Number(process.env.REMINDER_HOUR_UTC);
  if (now.getUTCHours() < (Number.isFinite(hour) ? hour : 16)) return 0;
  const today = Progress.dayKey(now);
  const yesterday = Progress.addDays(today, -1);
  const all = Progress.readAll();
  let sent = 0;
  Users.readUsers().forEach((u) => {
    const p = all[u.id];
    if (!p || !p.streak || p.streak.last !== yesterday || p.lastReminder === today) return;
    if (Users.publicUser(u).prefs.reminders === false) return;
    Notifications.add(u.id, {
      type: "reminder",
      title: `Keep your ${p.streak.current} day streak`,
      body: "Do one quiz or the daily challenge today.",
      link: "pages/daily.html",
    });
    p.lastReminder = today;
    sent++;
  });
  if (sent) Store.write(DATA_DIR.progress, all);
  return sent;
}

let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => { try { run(); } catch (e) { console.error("Reminders:", e.message); } }, 30 * 60 * 1000);
  timer.unref();
}

module.exports = { start, run };

/**
 * Storage configuration.
 *
 * The project uses flat JSON files as a lightweight "database".
 *  - Read-only content (subjects, papers, quiz) always lives in ./data
 *  - Data that changes while the app runs (users, scores, chat, notifications, study,
 *    progress) lives in ./data too, unless GCE_DATA_DIR points somewhere else.
 *
 * services/Store.js does the reading and (atomic) writing.
 */
const path = require("path");

const CONTENT_DIR = path.join(__dirname, "..", "data");
const LIVE_DIR = process.env.GCE_DATA_DIR ? path.resolve(process.env.GCE_DATA_DIR) : CONTENT_DIR;

const DATA_DIR = {
  subjects: path.join(CONTENT_DIR, "subjects.json"),
  papers: path.join(CONTENT_DIR, "papers.json"),
  quiz: path.join(CONTENT_DIR, "quiz.json"),
  users: path.join(LIVE_DIR, "users.json"),
  scores: path.join(LIVE_DIR, "scores.json"),
  chat: path.join(LIVE_DIR, "messages.json"),
  notifications: path.join(LIVE_DIR, "notifications.json"),
  study: path.join(LIVE_DIR, "study.json"),
  progress: path.join(LIVE_DIR, "progress.json"),
};

module.exports = { DATA_DIR };

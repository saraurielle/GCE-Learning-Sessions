/**
 * Storage configuration.
 *
 * The project currently uses flat JSON files as a lightweight "database"
 * (see each module's data/*.json). This file exists so that when you're
 * ready to move to a real database, there's a single place to set it up —
 * the controllers won't need to change how they're called, only how
 * readScores()/readUsers()-style helpers fetch data internally.
 *
 * Example upgrade path (SQLite via better-sqlite3):
 *
 *   const Database = require("better-sqlite3");
 *   const db = new Database(path.join(__dirname, "..", "data", "app.db"));
 *   module.exports = db;
 *
 * Example upgrade path (MongoDB via mongoose):
 *
 *   const mongoose = require("mongoose");
 *   async function connectDB() {
 *     await mongoose.connect(process.env.MONGO_URI);
 *     console.log("MongoDB connected");
 *   }
 *   module.exports = connectDB;
 */

const path = require("path");

const DATA_DIR = {
  users: path.join(__dirname, "..", "data", "users.json"),
  subjects: path.join(__dirname, "..", "data", "subjects.json"),
  papers: path.join(__dirname, "..", "data", "papers.json"),
  quiz: path.join(__dirname, "..", "data", "quiz.json"),
  scores: path.join(__dirname, "..", "data", "scores.json"),
  chat: path.join(__dirname, "..", "data", "messages.json"),
};

module.exports = { DATA_DIR };

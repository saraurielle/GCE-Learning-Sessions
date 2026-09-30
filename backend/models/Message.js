/**
 * Message model
 * One chat message posted in a room (e.g. "general" or a subject id).
 * username is copied at post time so history still reads correctly.
 */
class Message {
  constructor(room, userId, username, text, createdAt = new Date().toISOString()) {
    this.room = room;
    this.userId = userId;
    this.username = username;
    this.text = text;
    this.createdAt = createdAt;
  }
}

module.exports = Message;

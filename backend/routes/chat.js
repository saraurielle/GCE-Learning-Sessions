const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { requireAuth } = require("../middleware/auth");

// GET /api/chat/rooms
router.get("/rooms", chatController.getRooms);

// GET /api/chat/:room/messages   (public read)
router.get("/:room/messages", chatController.getMessages);

// GET /api/chat/:room/stream     (public live updates, Server-Sent Events)
router.get("/:room/stream", chatController.stream);

// POST /api/chat/:room/messages  (login required)
router.post("/:room/messages", requireAuth, chatController.postMessage);

// DELETE /api/chat/:room/messages/:messageId  (login required, own messages only)
router.delete("/:room/messages/:messageId", requireAuth, chatController.deleteMessage);

module.exports = router;

const express = require("express");
const router = express.Router();
const chat = require("../controllers/chatController");
const { requireAuth } = require("../middleware/auth");

router.get("/rooms", chat.getRooms);
router.get("/:room/messages", chat.getMessages);                       // public read
router.get("/:room/stream", chat.stream);                              // public live updates (SSE)
router.post("/:room/messages", requireAuth, chat.postMessage);
router.patch("/:room/messages/:messageId", requireAuth, chat.editMessage);
router.delete("/:room/messages/:messageId", requireAuth, chat.deleteMessage);
router.post("/:room/messages/:messageId/reactions", requireAuth, chat.react);
router.post("/:room/typing", requireAuth, chat.typing);

module.exports = router;

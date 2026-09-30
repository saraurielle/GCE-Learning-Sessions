/**
 * Quick self-contained test for the chat controller (no server, no extra deps).
 * Run from the backend folder:  npm test
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Use a throwaway data file so the real messages.json is never touched.
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gce-chat-")), "messages.json");
process.env.CHAT_DATA_FILE = tmp;

const chat = require("../controllers/chatController");
const hub = require("../services/ChatHub");

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const alice = { id: "u_alice", username: "alice" };
const bob = { id: "u_bob", username: "bob" };
const post = (room, user, text) => {
  const res = fakeRes();
  chat.postMessage({ params: { room }, user, body: { text } }, res);
  return res;
};

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok -", name);
}

test("rooms: General plus the 9 subjects", () => {
  const res = fakeRes();
  chat.getRooms({}, res);
  assert.strictEqual(res.body.length, 10);
  assert.strictEqual(res.body[0].id, "general");
});

test("post then read a message", () => {
  const res = post("general", alice, "  Hello everyone  ");
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.text, "Hello everyone");
  assert.strictEqual(res.body.username, "alice");
  const list = fakeRes();
  chat.getMessages({ params: { room: "general" }, query: {} }, list);
  assert.strictEqual(list.body.length, 1);
});

test("rejects empty, too long, unknown room", () => {
  assert.strictEqual(post("general", bob, "   ").statusCode, 400);
  assert.strictEqual(post("general", bob, "x".repeat(chat.MAX_LENGTH + 1)).statusCode, 400);
  assert.strictEqual(post("nope", bob, "hi").statusCode, 404);
  const res = fakeRes();
  chat.getMessages({ params: { room: "nope" }, query: {} }, res);
  assert.strictEqual(res.statusCode, 404);
});

test("rooms are separate", () => {
  post("physics", bob, "Anyone up for Paper 2?");
  const g = fakeRes(), p = fakeRes();
  chat.getMessages({ params: { room: "general" }, query: {} }, g);
  chat.getMessages({ params: { room: "physics" }, query: {} }, p);
  assert.strictEqual(g.body.length, 1);
  assert.strictEqual(p.body.length, 1);
});

test("rate limit kicks in after 5 quick messages", () => {
  const carol = { id: "u_carol", username: "carol" };
  for (let i = 0; i < 5; i++) assert.strictEqual(post("general", carol, "msg " + i).statusCode, 201);
  assert.strictEqual(post("general", carol, "one too many").statusCode, 429);
});

test("only the author can delete a message", () => {
  const id = post("history", alice, "delete me").body.id;
  const req = (user) => ({ params: { room: "history", messageId: id }, user });
  const denied = fakeRes();
  chat.deleteMessage(req(bob), denied);
  assert.strictEqual(denied.statusCode, 403);
  const ok = fakeRes();
  chat.deleteMessage(req(alice), ok);
  assert.strictEqual(ok.body.ok, true);
  const list = fakeRes();
  chat.getMessages({ params: { room: "history" }, query: {} }, list);
  assert.strictEqual(list.body.length, 0);
});

test("live stream: subscribers get chat + delete + presence events, cleanup works", () => {
  const handlers = {};
  const req = { params: { room: "biology" }, on: (ev, fn) => { handlers[ev] = fn; } };
  const written = [];
  const res = { writeHead() {}, write: (s) => written.push(s) };
  chat.stream(req, res);
  assert.strictEqual(hub.count("biology"), 1);

  const posted = post("biology", alice, "live message").body;
  chat.deleteMessage({ params: { room: "biology", messageId: posted.id }, user: alice }, fakeRes());

  const all = written.join("");
  assert.ok(all.includes("event: presence"));
  assert.ok(all.includes("event: chat") && all.includes("live message"));
  assert.ok(all.includes("event: delete"));

  handlers.close(); // browser disconnects
  assert.strictEqual(hub.count("biology"), 0);
});

console.log(`\n${passed} tests passed`);

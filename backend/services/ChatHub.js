/**
 * ChatHub
 * Keeps track of the browsers currently listening to each room over
 * Server-Sent Events (SSE) and pushes new events to them. No extra
 * dependency needed — SSE is plain HTTP.
 *
 * NOTE: this lives in the memory of one Node process. If you ever run
 * several server instances, replace it with Redis pub/sub or similar.
 */
class ChatHub {
  constructor() {
    this.rooms = new Map(); // roomId -> Set of response objects
  }

  count(room) {
    return this.rooms.has(room) ? this.rooms.get(room).size : 0;
  }

  subscribe(room, res) {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set());
    this.rooms.get(room).add(res);
    this.broadcast(room, "presence", { count: this.count(room) });
  }

  unsubscribe(room, res) {
    const set = this.rooms.get(room);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) this.rooms.delete(room);
    else this.broadcast(room, "presence", { count: set.size });
  }

  broadcast(room, event, data) {
    const set = this.rooms.get(room);
    if (!set) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) {
      try {
        res.write(payload);
      } catch (err) {
        set.delete(res); // dead connection
      }
    }
  }
}

module.exports = new ChatHub();

/** Tiny in-memory fixed-window rate limiter (one Node process). */
function limitMiddleware({ windowMs = 60000, max = 100, key = (req) => req.ip, message = "Too many requests." } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, e] of hits) if (e.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let e = hits.get(k);
    if (!e || e.reset <= now) { e = { count: 0, reset: now + windowMs }; hits.set(k, e); }
    e.count++;
    if (e.count > max) {
      res.set("Retry-After", String(Math.ceil((e.reset - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

module.exports = { limitMiddleware };

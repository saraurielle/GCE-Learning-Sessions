const fs = require("fs");
const path = require("path");

/** Reads a JSON file. Missing or empty file -> fallback. A corrupt file is copied aside, then fallback. */
function read(file, fallback) {
  try {
    const raw = fs.readFileSync(file, "utf-8").trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    if (err.code !== "ENOENT") {
      try { fs.copyFileSync(file, `${file}.corrupt-${Date.now()}`); } catch (e) { /* ignore */ }
    }
    return fallback;
  }
}

/** Writes atomically (temp file, then rename) so a crash never leaves half a file. */
function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

module.exports = { read, write };

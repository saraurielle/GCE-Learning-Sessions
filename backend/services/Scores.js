const { DATA_DIR } = require("../config/db");
const Store = require("./Store");

const all = () => Store.read(DATA_DIR.scores, []);
const forUser = (userId) => all().filter((s) => s.userId === userId);
function add(entry) {
  const scores = all();
  scores.push(entry);
  Store.write(DATA_DIR.scores, scores);
  return entry;
}

module.exports = { all, forUser, add };

/**
 * Subject model
 * Represents one of the 9 subjects available on the platform.
 */
class Subject {
  constructor(id, name, icon) {
    this.id = id;     // e.g. "mathematics"
    this.name = name; // e.g. "Mathematics"
    this.icon = icon; // e.g. "∑"
  }

  static fromJSON(json) {
    return new Subject(json.id, json.name, json.icon);
  }
}

module.exports = Subject;

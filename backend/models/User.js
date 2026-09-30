/**
 * User model
 * passwordHash is a bcrypt hash — the plain password is never stored.
 */
class User {
  constructor(id, username, passwordHash) {
    this.id = id;
    this.username = username;
    this.passwordHash = passwordHash;
  }
}

module.exports = User;

// lib/errors.js - Erros com código HTTP
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const erro = (msg, status = 400) => new HttpError(status, msg);
module.exports = { HttpError, erro };

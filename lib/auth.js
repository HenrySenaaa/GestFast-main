// lib/auth.js - Criptografia de credenciais (RNF 05) e tokens
const crypto = require('crypto');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}

function verifyPassword(pw, stored) {
  try {
    const [alg, saltHex, hashHex] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hashHex, 'hex');
    const h = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(h, expected);
  } catch (e) {
    return false;
  }
}

const newToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');

module.exports = { hashPassword, verifyPassword, newToken, hashToken };

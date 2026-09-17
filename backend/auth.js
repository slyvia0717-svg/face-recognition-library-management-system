const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const validPassword = p => typeof p === 'string' && p.length >= 8 && p.length <= 128;
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split(':') : [];
  const valid = parts.length === 3 && parts[0] === 'scrypt' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  const key = await scrypt(password, valid ? parts[1] : '00000000000000000000000000000000', 64);
  return valid && crypto.timingSafeEqual(key, Buffer.from(parts[2], 'hex'));
}
const tokenHash = t => crypto.createHash('sha256').update(t).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');
module.exports = { validPassword, hashPassword, verifyPassword, tokenHash, newToken };

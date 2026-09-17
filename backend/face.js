const { Worker } = require('node:worker_threads');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const VERSION = 'face-api-0.22.2-recognition-v1';
const failure = (status, message) => Object.assign(new Error(message), { status, publicMessage: message });
function decodeImage(image) {
  if (typeof image !== 'string' || image.length > 1400000) throw failure(400, '照片过大或格式不正确');
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match || match[2].length % 4) throw failure(400, '请使用 JPEG 或 PNG 照片');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 1024 * 1024 || bytes.length < 24) throw failure(400, '照片过大或格式不正确');
  let width, height;
  if (match[1] === 'png') {
    if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.toString('ascii',12,16) !== 'IHDR') throw failure(400, '照片格式不正确');
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20);
  } else {
    if (bytes[0] !== 255 || bytes[1] !== 216) throw failure(400, '照片格式不正确');
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      if (offset + 3 > bytes.length) break;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2].includes(marker) && length >= 8) { height = bytes.readUInt16BE(offset+3); width = bytes.readUInt16BE(offset+5); break; }
      offset += length;
    }
  }
  if (!width || !height || width < 160 || height < 160 || width > 1024 || height > 1024 || width * height > 800000) throw failure(400, '照片尺寸须为 160–1024 像素，请使用页面摄像头拍摄');
  return { bytes, mime: match[1] };
}
let worker, sequence = 0;
const pending = new Map();
function close() {
  const old = worker; worker = null;
  for (const job of pending.values()) { clearTimeout(job.timer); job.reject(failure(503, '人脸识别暂不可用，请使用密码登录')); }
  pending.clear();
  return old?.terminate();
}
function extract(image) {
  const input = decodeImage(image);
  if (pending.size) return Promise.reject(failure(429, '人脸识别处理中，请稍后重试'));
  if (!worker) {
    worker = new Worker(path.join(__dirname, 'face-worker.js'));
    const current = worker;
    current.on('message', result => {
      const job = pending.get(result.id); if (!job) return;
      clearTimeout(job.timer); pending.delete(result.id); current.unref();
      if (result.error) job.reject(failure(result.status, result.error));
      else if (!validDescriptor(result.descriptor)) job.reject(failure(503, '人脸模型返回异常，请使用密码登录'));
      else job.resolve(result.descriptor);
    });
    current.on('error', () => { if (worker === current) close(); });
    current.on('exit', () => { if (worker === current) close(); });
    current.unref();
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => close(), 45000);
    pending.set(id, { resolve, reject, timer }); worker.ref(); worker.postMessage({ id, ...input });
  });
}
function validDescriptor(value) { return Array.isArray(value) && value.length === 128 && value.every(Number.isFinite); }
function key(dbPath, create) {
  const file = process.env.FACE_KEY_PATH || path.join(path.dirname(dbPath), 'face.key');
  if (create && !fs.existsSync(file)) {
    try { fs.writeFileSync(file, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (err) { if (err.code !== 'EEXIST') throw err; }
  }
  let value;
  try { value = fs.readFileSync(file); } catch (_) { throw failure(503, '人脸密钥不可用，请使用密码登录并联系管理员'); }
  if (value.length !== 32) throw failure(503, '人脸密钥异常，请使用密码登录');
  return value;
}
function encrypt(descriptor, dbPath) {
  if (!validDescriptor(descriptor)) throw failure(503, '人脸特征异常');
  const plaintext = Buffer.alloc(512);
  descriptor.forEach((value, i) => plaintext.writeFloatLE(value, i * 4));
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(dbPath, true), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}
function matches(descriptor, encrypted, dbPath) {
  if (!validDescriptor(descriptor)) return false;
  try {
    const blob = Buffer.from(encrypted);
    if (blob.length !== 540) return false;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(dbPath, false), blob.subarray(0,12));
    decipher.setAuthTag(blob.subarray(12,28));
    const plaintext = Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
    let distance = 0;
    for (let i=0;i<128;i++) { const value = plaintext.readFloatLE(i*4); if (!Number.isFinite(value)) return false; distance += (descriptor[i]-value)**2; }
    return Math.sqrt(distance) < 0.45;
  } catch (err) { if (err.publicMessage) throw err; return false; }
}
module.exports = { extract, close, decodeImage, encrypt, matches, VERSION, failure };

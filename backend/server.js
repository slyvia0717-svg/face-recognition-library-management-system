const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const { hashPassword, verifyPassword, tokenHash, newToken, validPassword } = require('./auth');
const Joi = require('joi');
const library = require('./library');
const QRCode = require('qrcode');
const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


const dataDir = path.join(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.LIBRARY_DB_PATH || path.join(dataDir, 'library.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('数据库连接成功:', dbPath);
});

db.configure('busyTimeout', 10000);
// Serial scheduling limits lock waiters on the shared non-transaction connection.
db.serialize();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const safeUser = row => ({ id: row.id, 用户名: row.用户名, 角色: row.角色, 电话: row.电话, 真实姓名: row.真实姓名 });

async function ensureDatabase() {
  await run('PRAGMA foreign_keys = ON');
  await run(`CREATE TABLE IF NOT EXISTS 图书信息 (id INTEGER PRIMARY KEY, 书名 TEXT NOT NULL, 库存 INTEGER NOT NULL DEFAULT 0, 总数 INTEGER NOT NULL DEFAULT 0)`);
  await run(`CREATE TABLE IF NOT EXISTS 用户信息 (id INTEGER PRIMARY KEY, 用户名 TEXT UNIQUE NOT NULL, 角色 TEXT NOT NULL, 电话 TEXT, 真实姓名 TEXT, 照片 TEXT, password_hash TEXT)`);
  const columns = await all('PRAGMA table_info(用户信息)');
  if (!columns.some(column => column.name === 'password_hash')) await run('ALTER TABLE 用户信息 ADD COLUMN password_hash TEXT');
  await run(`CREATE TABLE IF NOT EXISTS 借阅信息 (id INTEGER PRIMARY KEY, 用户名 TEXT NOT NULL, 书名 TEXT NOT NULL, 借阅时间 TEXT, 归还时间 TEXT, 借阅状态 TEXT NOT NULL)`);
  await library.migrate(db, dbPath);
  await run(`CREATE TABLE IF NOT EXISTS borrow_requests (
    user_id INTEGER NOT NULL REFERENCES 用户信息(id) ON DELETE RESTRICT,
    request_id TEXT NOT NULL,
    book_id INTEGER NOT NULL REFERENCES 图书信息(id) ON DELETE RESTRICT,
    record_id INTEGER NOT NULL REFERENCES 借阅信息(id) ON DELETE RESTRICT,
    PRIMARY KEY(user_id,request_id)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES 用户信息(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL)`);
  await library.migrateBarcodes(db, dbPath);
  await run(`CREATE TABLE IF NOT EXISTS face_credentials (user_id INTEGER PRIMARY KEY REFERENCES 用户信息(id) ON DELETE CASCADE, descriptor BLOB NOT NULL, model_version TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  if ((await get('SELECT COUNT(*) AS count FROM 图书信息')).count === 0) {
    for (const [index, [title, stock]] of [['算法导论',5],['高性能MySQL',3],['深入理解计算机系统',4],['JavaScript高级程序设计',2],['人脸识别原理与实践',6],['机器学习入门',4]].entries()) {
      await run('INSERT INTO 图书信息 (书名,库存,总数,barcode) VALUES (?,?,?,?)', [title,stock,stock,'LIB'+String(index+1).padStart(6,'0')]);
    }
  }
  if ((await get('SELECT COUNT(*) AS count FROM 用户信息')).count === 0) {
    await run('INSERT INTO 用户信息 (用户名,角色,真实姓名) VALUES (?,?,?)', ['admin','管理员','系统管理员']);
  }
  await run('DELETE FROM auth_sessions WHERE expires_at <= ?', [Date.now()]);
}
const ready = ensureDatabase();
// Always finish migrations before accepting API requests.
app.use((req, res, next) => ready.then(() => next(), next));

const publicPaths = new Set(['/api/face/login', '/api/login', '/api/register', '/health', '/login']);
const userPaths = new Set(['/api/face/status', '/api/face/enroll', '/api/face', '/api/me', '/api/logout', '/api/books', '/api/borrowBook', '/api/returnBook', '/api/myBorrowRecords', '/api/books/byBarcode', '/api/bookCode']);
async function authenticate(req, res, next) {
  try {
    const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get('Authorization') || '');
    if (!match) return res.status(401).json({ success: false, message: '请先登录' });
    const row = await get(`SELECT u.id, u.用户名, u.角色, u.电话, u.真实姓名 FROM auth_sessions s JOIN 用户信息 u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`, [tokenHash(match[1]), Date.now()]);
    if (!row) return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
    req.user = safeUser(row);
    req.sessionHash = tokenHash(match[1]);
    next();
  } catch (err) { next(err); }
}
app.use((req, res, next) => {
  if (publicPaths.has(req.path)) return next();
  authenticate(req, res, err => {
    if (err) return next(err);
    if (!userPaths.has(req.path) && req.user.角色 !== '管理员') {
      return res.status(403).json({ success: false, message: '需要管理员权限' });
    }
    next();
  });
});

app.get('/api/me', (req, res) => res.json({ success: true, user: req.user }));
app.patch('/api/me', async (req, res, next) => {
  const schema = Joi.object({
    nickname: Joi.string().trim().min(1).max(64),
    name: Joi.string().trim().min(1).max(100),
    contact: Joi.string().trim().pattern(/^[+0-9 ()-]{3,32}$/)
  }).min(1).unknown(false);
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: '昵称和姓名不能为空；电话须为 3–32 位数字，可包含 +、空格、括号和短横线' });
  const columns = { nickname: '用户名', name: '真实姓名', contact: '电话' };
  const keys = Object.keys(value);
  try {
    // The account ID comes exclusively from the verified server session.
    const result = await run(`UPDATE 用户信息 SET ${keys.map(key => columns[key] + ' = ?').join(', ')} WHERE id = ?`, [...keys.map(key => value[key]), req.user.id]);
    if (!result.changes) return res.status(404).json({ success: false, message: '账号不存在' });
    const row = await get('SELECT id, 用户名, 角色, 电话, 真实姓名 FROM 用户信息 WHERE id = ?', [req.user.id]);
    res.json({ success: true, message: '个人信息已更新', user: safeUser(row) });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ success: false, message: '该昵称已被使用，请更换昵称' });
    next(err);
  }
});
app.post('/api/logout', async (req, res, next) => {
  try { await run('DELETE FROM auth_sessions WHERE token_hash = ?', [req.sessionHash]); res.json({ success: true }); }
  catch (err) { next(err); }
});
app.get('/api/myBorrowRecords', async (req, res, next) => {
  try { res.json(await all(`${library.recordsSql} WHERE r.user_id = ? ORDER BY r.id DESC`, [req.user.id])); }
  catch (err) { next(err); }
});

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'backend is running', timestamp: new Date().toISOString() });
});

app.get('/api/books', (req, res) => {
  const sql = req.user.角色 === '管理员' ? 'SELECT * FROM 图书信息 ORDER BY id' : 'SELECT * FROM 图书信息 WHERE archived=0 ORDER BY id';
  db.all(sql, (err, rows) => {
    if (err) {
      console.error('查询图书失败:', err.message);
      return res.status(500).json({ success: false, message: '查询失败' });
    }
    res.status(200).json(rows);
  });
});

const barcodeSchema = Joi.string().trim().pattern(/^[A-Za-z0-9_-]{1,64}$/);
app.get('/api/books/byBarcode', async (req, res, next) => {
  const { error, value } = barcodeSchema.required().validate(req.query.barcode);
  if (error) return res.status(400).json({ success: false, message: '图书编号须为 1–64 位字母、数字、短横线或下划线' });
  try {
    const book = await get('SELECT * FROM 图书信息 WHERE barcode=?',[value]);
    if (!book) return res.status(404).json({ success: false, message: '未找到此编号对应的图书，请联系管理员录入' });
    if (book.archived) return res.status(410).json({ success: false, message: '该图书已下架，无法借阅' });
    res.json({ success: true, book });
  } catch (err) { next(err); }
});
app.get('/api/bookCode', async (req, res, next) => {
  const { error, value } = Joi.number().integer().positive().required().validate(req.query.bookId);
  if (error) return res.status(400).json({ success: false, message: '图书编号不合法' });
  try {
    const book = await get('SELECT id,barcode,archived FROM 图书信息 WHERE id=?',[value]);
    if (!book || book.archived) return res.status(404).json({ success: false, message: '图书不存在或已下架' });
    const svg = await QRCode.toString(book.barcode, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, width: 320 });
    res.json({ success: true, bookId: book.id, barcode: book.barcode, svg });
  } catch (err) { next(err); }
});

const bookSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  total: Joi.number().integer().min(0).max(1000000).required(),
  stock: Joi.number().integer().min(0).max(Joi.ref('total')),
  barcode: barcodeSchema
});
app.post('/api/addBook', async (req, res, next) => {
  const { error, value } = bookSchema.validate(req.body);
  if (error || (value.stock !== undefined && value.stock !== value.total)) {
    return res.status(400).json({ success: false, message: '书名不能为空；数量须为非负整数，新图书库存须等于总数' });
  }
  try {
    const result = await run('INSERT INTO 图书信息 (书名,库存,总数,barcode) VALUES (?,?,?,?)',[value.title,value.total,value.total,value.barcode || ('LIB' + crypto.randomBytes(8).toString('hex'))]);
    const row = await get('SELECT * FROM 图书信息 WHERE id=?',[result.lastID]);
    res.json({ success: true, message: '添加图书成功', data: row });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ success: false, message: '图书编号已被使用，请更换' });
    next(err);
  }
});
app.post('/api/saveBook', async (req, res, next) => {
  const input = { title: req.body.书名 ?? req.body.title, total: req.body.总数 ?? req.body.total };
  if (req.body.barcode !== undefined) input.barcode = req.body.barcode;
  if (req.body.库存 !== undefined || req.body.stock !== undefined) input.stock = req.body.库存 ?? req.body.stock;
  const { error, value } = bookSchema.validate(input);
  const id = Number(req.body.id);
  if (error || !Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: '书名、总数或库存不合法' });
  try {
    const row = await library.saveBook(dbPath,id,value.title,value.total,value.stock,value.barcode);
    res.json({ success: true, message: '图书已更新', data: row });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ success: false, message: '图书编号已被使用，请更换' });
    next(err);
  }
});
app.post('/api/deleteBook', async (req, res, next) => {
  const id = Number(req.body.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: '图书编号不合法' });
  try {
    await library.archiveBook(dbPath,id);
    res.json({ success: true, message: '图书已下架，历史记录已保留' });
  } catch (err) { next(err); }
});

app.post('/api/register', async (req, res, next) => {
  const { nickname, name, contact, imageUrl, password } = req.body;
  if (typeof nickname !== 'string' || !nickname.trim() || nickname.length > 64 ||
      typeof name !== 'string' || !name.trim() || name.length > 100 ||
      typeof contact !== 'string' || !contact.trim() || contact.length > 32 || !validPassword(password) ||
      (imageUrl != null && typeof imageUrl !== 'string')) {
    return res.status(400).json({ success: false, message: '请填写完整信息，密码须为 8–128 个字符' });
  }
  try {
    const hash = await hashPassword(password);
    const result = await run('INSERT INTO 用户信息 (用户名,角色,电话,真实姓名,照片,password_hash) VALUES (?,?,?,?,?,?)', [nickname.trim(),'普通用户',contact.trim(),name.trim(),imageUrl || null,hash]);
    res.status(201).json({ success: true, message: '注册成功', user: { id: result.lastID, 用户名: nickname.trim(), 角色: '普通用户' } });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ success: false, message: '用户名已存在' });
    next(err);
  }
});

app.get('/api/getAdminPeople', (req, res) => {
  const sql = "SELECT id, 用户名, 角色, 电话, 真实姓名 FROM 用户信息 WHERE 角色 = '管理员'";
  db.all(sql, (err, rows) => {
    if (err) {
      console.error('查询管理员失败:', err.message);
      return res.status(500).json({ message: '查询失败' });
    }
    res.status(200).json(rows);
  });
});

app.get('/api/getUserPeople', (req, res) => {
  const sql = "SELECT id, 用户名, 角色, 电话, 真实姓名 FROM 用户信息 WHERE 角色 = '普通用户'";
  db.all(sql, (err, rows) => {
    if (err) {
      console.error('查询普通用户失败:', err.message);
      return res.status(500).json({ message: '查询失败' });
    }
    res.status(200).json(rows);
  });
});

app.put('/api/updatePerson', (req, res) => {
  const { id, 真实姓名, 用户名, 电话, 角色 } = req.body;
  if (角色 && !['管理员', '普通用户'].includes(角色)) return res.status(400).json({ success: false, message: '角色无效' });
  if (!id) {
    return res.status(400).json({ success: false, message: '缺少用户id' });
  }

  const updates = [];
  const values = [];

  if (真实姓名) {
    updates.push('真实姓名 = ?');
    values.push(真实姓名);
  }
  if (用户名) {
    updates.push('用户名 = ?');
    values.push(用户名);
  }
  if (电话) {
    updates.push('电话 = ?');
    values.push(电话);
  }
  if (角色) {
    updates.push('角色 = ?');
    values.push(角色);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: '没有需要更新的数据' });
  }

  values.push(Number(id));
  const sql = `UPDATE 用户信息 SET ${updates.join(', ')} WHERE id = ?`;

  db.run(sql, values, function (err) {
    if (err) {
      console.error('更新用户信息失败:', err.message);
      return res.status(500).json({ success: false, message: '更新失败' });
    }
    res.status(200).json({ success: true, message: '更新成功' });
  });
});

app.get('/api/getReturnStatus', (req, res) => {
  const sql = `
    SELECT
      COUNT(CASE WHEN 借阅状态 = '借阅' THEN 1 END) AS unreturned_count,
      COUNT(CASE WHEN 借阅状态 = '已还' THEN 1 END) AS returned_count
    FROM 借阅信息
  `;

  db.get(sql, (err, row) => {
    if (err) {
      console.error('查询归还状态失败:', err.message);
      return res.status(500).json({ message: '查询失败' });
    }
    res.status(200).json(row || { unreturned_count: 0, returned_count: 0 });
  });
});

app.get('/api/queryBorrowRecords', (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ message: '请提供日期参数' });
  }

  const sql = `${library.recordsSql} WHERE r.借阅时间 = ? OR r.归还时间 = ? ORDER BY r.id`;
  const countSql = `
    SELECT
      COUNT(CASE WHEN 借阅时间 = ? THEN 1 END) AS daily_borrowed_count,
      COUNT(CASE WHEN 归还时间 = ? THEN 1 END) AS daily_returned_count
    FROM 借阅信息
  `;

  db.all(sql, [date, date], (err, rows) => {
    if (err) {
      console.error('查询借阅记录失败:', err.message);
      return res.status(500).json({ message: '查询失败' });
    }

    db.get(countSql, [date, date], (countErr, countRow) => {
      if (countErr) {
        return res.status(500).json({ message: '查询失败' });
      }

      res.status(200).json({
        records: rows,
        dailyBorrowedCount: countRow ? countRow.daily_borrowed_count : 0,
        dailyReturnedCount: countRow ? countRow.daily_returned_count : 0
      });
    });
  });
});

app.get('/api/queryAllBorrowRecords', (req, res) => {
  const sql = `${library.recordsSql} ORDER BY r.id`;
  db.all(sql, (err, rows) => {
    if (err) {
      console.error('查询全部借阅记录失败:', err.message);
      return res.status(500).json({ message: '查询失败' });
    }
    res.status(200).json(rows);
  });
});

app.put('/api/updateBorrowRecord', async (req, res, next) => {
  const schema = Joi.object({
    id: Joi.number().integer().positive().required(),
    userId: Joi.number().integer().positive().required(),
    bookId: Joi.number().integer().positive().required(),
    status: Joi.string().valid('借阅','已还').required(),
    borrowTime: Joi.string().required(),
    returnTime: Joi.string().allow(null,'')
  });
  const { error, value } = schema.validate(req.body);
  if (error || !library.validDate(value.borrowTime) ||
      (value.status === '已还' && (!library.validDate(value.returnTime) || value.returnTime < value.borrowTime)) ||
      (value.status === '借阅' && value.returnTime)) {
    return res.status(400).json({ success: false, message: '请选择用户、图书和合法状态；日期须为 YYYYMMDD，归还日期不能早于借阅日期' });
  }
  try {
    await library.editRecord(dbPath,value);
    res.json({ success: true, message: '记录已更新，库存已同步' });
  } catch (err) { next(err); }
});
app.post('/api/borrowBook', async (req, res, next) => {
  const schema = Joi.object({
    bookId: Joi.number().integer().positive().required(),
    requestId: Joi.string().pattern(/^[A-Za-z0-9_-]{16,128}$/).required(),
    barcode: barcodeSchema.required()
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: '图书编号或请求编号不合法' });
  try {
    const result = await library.borrow(dbPath,req.user.id,value.bookId,value.requestId,value.barcode);
    res.json({ success: true, message: '借阅成功', data: result });
  } catch (err) { next(err); }
});
app.post('/api/returnBook', async (req, res, next) => {
  const { error, value } = Joi.object({ recordId: Joi.number().integer().positive().required() }).validate(req.body);
  if (error) return res.status(400).json({ success: false, message: '请提供个人借阅单号' });
  try {
    const result = await library.returnRecord(dbPath,req.user.id,value.recordId);
    res.json({ success: true, message: result.repeated ? '该借阅单已归还' : '还书成功', data: result });
  } catch (err) { next(err); }
});

// Limit password guesses without retaining an unbounded map of client addresses.
const attempts = new Map();
function loginLimit(req, res, next) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = req.ip;
  let entry = attempts.get(key);
  if (!entry) {
    if (attempts.size >= 10000) return res.status(429).json({ success: false, message: '请稍后重试' });
    entry = { count: 0, until: now + 15 * 60 * 1000 }; attempts.set(key, entry);
  }
  if (++entry.count > 20) return res.status(429).json({ success: false, message: '登录尝试过多，请稍后重试' });
  next();
}
app.post('/api/login', loginLimit, async (req, res, next) => {
  const { nickname, password } = req.body;
  if (typeof nickname !== 'string' || !nickname.trim() || nickname.length > 64 || !validPassword(password)) {
    return res.status(400).json({ success: false, message: '请输入用户名和密码（8–128 个字符）' });
  }
  try {
    const row = await get('SELECT id, 用户名, 角色, 电话, 真实姓名, password_hash FROM 用户信息 WHERE 用户名 = ?', [nickname.trim()]);
    if (!await verifyPassword(password, row && row.password_hash)) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    const token = newToken();
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
    await run('DELETE FROM auth_sessions WHERE expires_at <= ?', [Date.now()]);
    await run('INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', [tokenHash(token),row.id,expiresAt]);
    res.json({ success: true, user: safeUser(row), token, expiresAt });
  } catch (err) { next(err); }
});
require('./face-routes')({ app, dbPath, get, safeUser, loginLimit });
// Byte equality of photos is not identity verification. Disable this legacy bypass.
app.post('/login', (req, res) => res.status(410).json({ success: false, message: '请使用密码登录' }));
app.use((err, req, res, next) => {
  if (!err.publicMessage) console.error('请求失败:', err.message);
  res.status(err.status || 500).json({ success: false, message: err.publicMessage || '请求处理失败' });
});
if (require.main === module) {
  ready.then(() => app.listen(PORT, () => console.log(`服务已启动，监听端口 ${PORT}`)))
    .catch(err => { console.error('数据库初始化失败:', err.message); process.exit(1); });
}
module.exports = { app, db, ready };

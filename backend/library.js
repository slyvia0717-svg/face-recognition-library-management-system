const sqlite3 = require('sqlite3').verbose();
const fs = require('node:fs');
const path = require('node:path');
const dayjs = require('dayjs');

function queries(db) {
  return {
    run: (sql, args = []) => new Promise((resolve, reject) => db.run(sql, args, function (err) { err ? reject(err) : resolve(this); })),
    get: (sql, args = []) => new Promise((resolve, reject) => db.get(sql, args, (err, row) => err ? reject(err) : resolve(row))),
    all: (sql, args = []) => new Promise((resolve, reject) => db.all(sql, args, (err, rows) => err ? reject(err) : resolve(rows)))
  };
}
function fail(status, message) { const err = new Error(message); err.status = status; err.publicMessage = message; throw err; }

// A separate connection owns the entire transaction; unrelated requests cannot enter it.
function executeTransaction(dbPath, operation) {
  const db = new sqlite3.Database(dbPath);
  db.configure('busyTimeout', 10000);
  const q = queries(db);
  return (async () => {
    let begun = false;
    try {
      await q.run('PRAGMA foreign_keys = ON');
      await q.run('BEGIN IMMEDIATE'); begun = true;
      const result = await operation(q);
      await q.run('COMMIT'); begun = false;
      return result;
    } catch (err) {
      if (begun) await q.run('ROLLBACK');
      throw err;
    } finally { await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve())); }
  })();
}

const transactionTails = new Map();
function transaction(dbPath, operation) {
  // Queue local writers to avoid filling sqlite3 worker threads with lock waiters.
  const current = (transactionTails.get(dbPath) || Promise.resolve()).then(() => executeTransaction(dbPath, operation));
  const tail = current.catch(() => {});
  transactionTails.set(dbPath, tail);
  tail.then(() => { if (transactionTails.get(dbPath) === tail) transactionTails.delete(dbPath); });
  return current;
}

async function migrate(db, dbPath) {
  const q = queries(db);
  const columns = await q.all('PRAGMA table_info(借阅信息)');
  if (columns.some(column => column.name === 'user_id')) return;
  const report = { createdAt: new Date().toISOString(), unresolved: [], reservedStock: [] };
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${dbPath}.before-library-v2-${suffix}.db`;
  // SQLite produces a consistent backup, including any pending journal contents.
  await q.run('VACUUM INTO ?', [backup]);
  fs.chmodSync(backup, 0o600);
  await q.run('BEGIN IMMEDIATE');
  try {
    const books = await q.all('SELECT * FROM 图书信息');
    const users = await q.all('SELECT id, 用户名 FROM 用户信息');
    const records = await q.all('SELECT * FROM 借阅信息');
    const mapped = records.map(row => {
      const user = users.find(user => user.用户名 === row.用户名);
      const matches = books.filter(book => book.书名 === row.书名);
      const book = matches.length === 1 ? matches[0] : null;
      const issues = [];
      if (!user) issues.push('用户无法匹配，请核对');
      if (!book) issues.push(matches.length > 1 ? '书名重复，请核对图书' : '图书无法匹配，请核对');
      if (!['借阅', '已还'].includes(row.借阅状态)) throw new Error(`旧借阅记录 ${row.id} 状态无效，迁移已回滚`);
      if (issues.length) report.unresolved.push({ id: row.id, username: row.用户名, bookName: row.书名, reason: issues.join('；') });
      return { ...row, user_id: user?.id || null, book_id: book?.id || null, migration_issue: issues.join('；') || null };
    });
    await q.run(`CREATE TABLE 图书信息_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      书名 TEXT NOT NULL CHECK(length(trim(书名)) > 0),
      库存 INTEGER NOT NULL CHECK(typeof(库存) = 'integer' AND 库存 >= 0),
      总数 INTEGER NOT NULL CHECK(typeof(总数) = 'integer' AND 总数 >= 0 AND 库存 <= 总数),
      legacy_reserved INTEGER NOT NULL DEFAULT 0 CHECK(typeof(legacy_reserved) = 'integer' AND legacy_reserved >= 0 AND 库存 + legacy_reserved <= 总数),
      archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
    )`);
    for (const book of books) {
      const active = mapped.filter(row => row.book_id === book.id && row.借阅状态 === '借阅').length;
      const reserved = book.总数 - book.库存 - active;
      if (!Number.isInteger(reserved) || reserved < 0 || book.库存 < 0 || book.总数 < 0) throw new Error(`图书 ${book.id} 的旧库存账目有冲突，迁移已回滚`);
      if (reserved) report.reservedStock.push({ bookId: book.id, count: reserved, reason: '旧库存缺口没有对应借阅记录，保留占用量，需核对实物' });
      await q.run('INSERT INTO 图书信息_v2 (id,书名,库存,总数,legacy_reserved) VALUES (?,?,?,?,?)', [book.id,book.书名,book.库存,book.总数,reserved]);
    }
    await q.run(`CREATE TABLE 借阅信息_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES 用户信息(id) ON DELETE RESTRICT,
      book_id INTEGER REFERENCES 图书信息_v2(id) ON DELETE RESTRICT,
      用户名 TEXT NOT NULL,
      书名 TEXT NOT NULL,
      借阅时间 TEXT,
      归还时间 TEXT,
      借阅状态 TEXT NOT NULL CHECK(借阅状态 IN ('借阅','已还')),
      migration_issue TEXT,
      request_id TEXT,
      request_book_id INTEGER REFERENCES 图书信息_v2(id) ON DELETE RESTRICT,
      CHECK((user_id IS NOT NULL AND book_id IS NOT NULL) OR migration_issue IS NOT NULL),
      UNIQUE(user_id,request_id)
    )`);
    for (const row of mapped) {
      await q.run('INSERT INTO 借阅信息_v2 (id,user_id,book_id,用户名,书名,借阅时间,归还时间,借阅状态,migration_issue) VALUES (?,?,?,?,?,?,?,?,?)', [row.id,row.user_id,row.book_id,row.用户名,row.书名,row.借阅时间,row.归还时间,row.借阅状态,row.migration_issue]);
    }
    await q.run('DROP TRIGGER IF EXISTS sync_borrow_username');
    await q.run('DROP TABLE 借阅信息');
    await q.run('DROP TABLE 图书信息');
    await q.run('ALTER TABLE 图书信息_v2 RENAME TO 图书信息');
    await q.run('ALTER TABLE 借阅信息_v2 RENAME TO 借阅信息');
    await q.run('CREATE INDEX borrow_user_status ON 借阅信息(user_id,借阅状态)');
    await q.run('CREATE INDEX borrow_book_status ON 借阅信息(book_id,借阅状态)');
    const foreignIssues = await q.all('PRAGMA foreign_key_check');
    if (foreignIssues.length) throw new Error('外键检查失败，迁移已回滚');
    await q.run('COMMIT');
  } catch (err) { await q.run('ROLLBACK'); throw err; }
  report.backup = backup;
  fs.writeFileSync(`${dbPath}.migration-v2.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(`借阅数据迁移完成：${report.unresolved.length} 条待核对；备份 ${path.basename(backup)}`);
}

async function migrateBarcodes(db, dbPath) {
  const q = queries(db);
  const columns = await q.all('PRAGMA table_info(图书信息)');
  if (!columns.some(column => column.name === 'barcode')) {
    const suffix = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = `${dbPath}.before-barcode-v1-${suffix}.db`;
    await q.run('VACUUM INTO ?', [backup]); fs.chmodSync(backup, 0o600);
    await q.run('BEGIN IMMEDIATE');
    try {
      await q.run(`ALTER TABLE 图书信息 ADD COLUMN barcode TEXT CHECK(barcode IS NULL OR
        (length(barcode) BETWEEN 1 AND 64 AND barcode NOT GLOB '*[^A-Za-z0-9_-]*'))`);
      await q.run("UPDATE 图书信息 SET barcode = 'LIB' || printf('%06d',id)");
      await q.run('CREATE UNIQUE INDEX book_barcode_unique ON 图书信息(barcode)');
      await q.run(`CREATE TRIGGER book_barcode_insert BEFORE INSERT ON 图书信息 WHEN NEW.barcode IS NULL
        BEGIN SELECT RAISE(ABORT,'barcode required'); END`);
      await q.run(`CREATE TRIGGER book_barcode_update BEFORE UPDATE OF barcode ON 图书信息 WHEN NEW.barcode IS NULL
        BEGIN SELECT RAISE(ABORT,'barcode required'); END`);
      await q.run('COMMIT');
    } catch (err) { await q.run('ROLLBACK'); throw err; }
    console.log('图书编号初始化完成，迁移前备份已保存');
  }
  const requestColumns = await q.all('PRAGMA table_info(borrow_requests)');
  if (!requestColumns.some(column => column.name === 'barcode')) {
    await q.run('ALTER TABLE borrow_requests ADD COLUMN barcode TEXT');
    await q.run('UPDATE borrow_requests SET barcode=(SELECT barcode FROM 图书信息 WHERE id=borrow_requests.book_id)');
  }
}

// Explicit columns avoid duplicate names in SQLite row objects.
const recordsSql = `SELECT r.id,r.user_id,r.book_id,r.借阅时间,r.归还时间,r.借阅状态,r.migration_issue,
  COALESCE(u.用户名,r.用户名) AS 用户名, COALESCE(b.书名,r.书名) AS 书名
  FROM 借阅信息 r LEFT JOIN 用户信息 u ON u.id = r.user_id LEFT JOIN 图书信息 b ON b.id = r.book_id`;
async function borrow(dbPath, userId, bookId, requestId, barcode) {
  return transaction(dbPath, async q => {
    const previous = await q.get('SELECT record_id AS id,book_id AS request_book_id,barcode FROM borrow_requests WHERE user_id=? AND request_id=?',[userId,requestId]);
    if (previous) {
      if (previous.request_book_id !== bookId || previous.barcode !== barcode) fail(409,'此请求编号已用于另一图书');
      return { id: previous.id, repeated: true };
    }
    const book = await q.get('SELECT * FROM 图书信息 WHERE id=?',[bookId]);
    if (!book || book.archived) fail(404,'图书不存在或已下架');
    if (book.barcode !== barcode) fail(409,'图书编号已变化或与所选图书不匹配，请重新扫描');
    const changed = await q.run('UPDATE 图书信息 SET 库存=库存-1 WHERE id=? AND 库存>0 AND archived=0',[bookId]);
    if (!changed.changes) fail(409,'暂无库存，无法借阅');
    const user = await q.get('SELECT 用户名 FROM 用户信息 WHERE id=?',[userId]);
    if (!user) fail(401,'账号不存在');
    const row = await q.run(`INSERT INTO 借阅信息 (user_id,book_id,用户名,书名,借阅时间,借阅状态,request_id,request_book_id) VALUES (?,?,?,?,?,'借阅',?,?)`,[userId,bookId,user.用户名,book.书名,dayjs().format('YYYYMMDD'),requestId,bookId]);
    await q.run('INSERT INTO borrow_requests (user_id,request_id,book_id,record_id,barcode) VALUES (?,?,?,?,?)',[userId,requestId,bookId,row.lastID,barcode]);
    return { id: row.lastID, repeated: false };
  });
}
async function returnRecord(dbPath, userId, recordId) {
  return transaction(dbPath, async q => {
    const row = await q.get('SELECT * FROM 借阅信息 WHERE id=? AND user_id=?',[recordId,userId]);
    if (!row) fail(404,'没有对应的个人借阅记录');
    if (row.migration_issue || !row.book_id) fail(409,'此旧记录需管理员先核对关联信息');
    if (row.借阅状态 === '已还') return { id: row.id, repeated: true };
    const changed = await q.run(`UPDATE 借阅信息 SET 借阅状态='已还',归还时间=? WHERE id=? AND user_id=? AND 借阅状态='借阅'`,[dayjs().format('YYYYMMDD'),row.id,userId]);
    if (!changed.changes) fail(409,'记录状态已变化，请刷新');
    const stock = await q.run('UPDATE 图书信息 SET 库存=库存+1 WHERE id=? AND 库存+legacy_reserved<总数',[row.book_id]);
    if (!stock.changes) fail(409,'库存账目异常，归还操作已回滚，请联系管理员');
    return { id: row.id, repeated: false };
  });
}
async function saveBook(dbPath, id, title, total, submittedStock, barcode) {
  return transaction(dbPath, async q => {
    const book = await q.get('SELECT * FROM 图书信息 WHERE id=? AND archived=0',[id]);
    if (!book) fail(404,'图书不存在或已下架');
    const { count } = await q.get("SELECT COUNT(*) AS count FROM 借阅信息 WHERE book_id=? AND 借阅状态='借阅'",[id]);
    const stock = total-count-book.legacy_reserved;
    if (stock < 0) fail(409,'总数不能小于未归还数量与旧账保留占用量之和');
    if (submittedStock !== undefined && submittedStock !== stock) fail(409,'库存由借阅记录计算，不能独立修改；请刷新后只修改总数');
    await q.run('UPDATE 图书信息 SET 书名=?,总数=?,库存=?,barcode=? WHERE id=?',[title,total,stock,barcode === undefined ? book.barcode : barcode,id]);
    return q.get('SELECT * FROM 图书信息 WHERE id=?',[id]);
  });
}
async function archiveBook(dbPath, id) {
  return transaction(dbPath, async q => {
    const book = await q.get('SELECT * FROM 图书信息 WHERE id=?',[id]);
    if (!book) fail(404,'图书不存在');
    const { count } = await q.get("SELECT COUNT(*) AS count FROM 借阅信息 WHERE book_id=? AND 借阅状态='借阅'",[id]);
    if (count || book.legacy_reserved) fail(409,'尚有未归还图书或待核对的库存占用，不能下架');
    await q.run('UPDATE 图书信息 SET archived=1 WHERE id=?',[id]);
  });
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return false;
  const iso = `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
  const d = new Date(iso+'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === iso;
}
async function editRecord(dbPath, input) {
  return transaction(dbPath, async q => {
    const old = await q.get('SELECT * FROM 借阅信息 WHERE id=?',[input.id]);
    if (!old) fail(404,'借阅记录不存在');
    const user = await q.get('SELECT id,用户名 FROM 用户信息 WHERE id=?',[input.userId]);
    const book = await q.get('SELECT * FROM 图书信息 WHERE id=?',[input.bookId]);
    if (!user || !book) fail(400,'用户或图书不存在');
    const activeOld = old.借阅状态 === '借阅' && old.book_id;
    const activeNew = input.status === '借阅';
    if (activeNew && book.archived) fail(409,'不能将已下架图书设为借阅');
    if (activeOld) {
      const released = await q.run('UPDATE 图书信息 SET 库存=库存+1 WHERE id=? AND 库存+legacy_reserved<总数',[old.book_id]);
      if (!released.changes) fail(409,'原图书库存异常，修改已回滚');
    }
    if (activeNew) {
      const reserved = await q.run('UPDATE 图书信息 SET 库存=库存-1 WHERE id=? AND 库存>0',[book.id]);
      if (!reserved.changes) fail(409,'新图书库存不足，修改已回滚');
    }
    await q.run(`UPDATE 借阅信息 SET user_id=?,book_id=?,用户名=?,书名=?,借阅状态=?,借阅时间=?,归还时间=?,migration_issue=NULL WHERE id=?`,[user.id,book.id,user.用户名,book.书名,input.status,input.borrowTime,input.status === '已还' ? input.returnTime : null,old.id]);
    // Keep the original request owner stable. A reassigned historical record must not
    // carry an idempotency key belonging to its former user.
    if (old.user_id !== user.id) await q.run('UPDATE 借阅信息 SET request_id=NULL WHERE id=?',[old.id]);
  });
}
module.exports = { queries, transaction, migrate, migrateBarcodes, recordsSql, borrow, returnRecord, saveBook, archiveBook, editRecord, validDate, fail };

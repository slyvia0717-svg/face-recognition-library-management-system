const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { hashPassword, tokenHash } = require('../auth');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'library-auth-test-'));
process.env.LIBRARY_DB_PATH = path.join(temp, 'test.db');
const runOn = (db, sql, args = []) => new Promise((resolve, reject) => db.run(sql,args,function(err){ err ? reject(err) : resolve(this); }));
const { request } = require('./helpers');
test('migration, credentials, sessions and role/ownership enforcement', async () => {
  // Start with a pre-auth database, so migration is also covered.
  const legacy = new sqlite3.Database(process.env.LIBRARY_DB_PATH);
  await runOn(legacy,'CREATE TABLE 用户信息 (id INTEGER PRIMARY KEY, 用户名 TEXT UNIQUE NOT NULL, 角色 TEXT NOT NULL, 电话 TEXT, 真实姓名 TEXT, 照片 TEXT)');
  await runOn(legacy,'INSERT INTO 用户信息 (用户名,角色,真实姓名) VALUES (?,?,?)',['admin','管理员','保留姓名']);
  await new Promise((resolve,reject)=>legacy.close(err=>err?reject(err):resolve()));
  const { app, db, ready } = require('../server');
  try {
    await ready;
    const run = (sql,args) => runOn(db,sql,args);
    assert.equal((await request(app,'POST','/api/login',{nickname:'admin'})).status,400);
    assert.equal((await request(app,'POST','/api/login',{nickname:'admin',password:'test-admin-password'})).status,401);
    await run('UPDATE 用户信息 SET password_hash=? WHERE 用户名=?',[await hashPassword('test-admin-password'),'admin']);
    const admin = await request(app,'POST','/api/login',{nickname:'admin',password:'test-admin-password'});
    assert.equal(admin.status,200); assert.equal(admin.data.user.真实姓名,'保留姓名');
    assert.equal('password_hash' in admin.data.user,false); assert.equal('照片' in admin.data.user,false);
    for(const name of ['alice','bob']) {
      const r=await request(app,'POST','/api/register',{nickname:name,name,contact:'123',password:'test-user-password',角色:'管理员'});
      assert.equal(r.status,201); assert.equal(r.data.user.角色,'普通用户');
    }
    assert.equal((await request(app,'POST','/api/register',{nickname:'alice',name:'a',contact:'1',password:'test-user-password'})).status,409);
    assert.equal((await request(app,'POST','/api/login',{nickname:'alice',password:'incorrect-password'})).status,401);
    const alice=(await request(app,'POST','/api/login',{nickname:'alice',password:'test-user-password'})).data.token;
    const bob=(await request(app,'POST','/api/login',{nickname:'bob',password:'test-user-password'})).data.token;
    for (const [method,url,body] of [['GET','/api/getUserPeople'],['GET','/api/queryAllBorrowRecords'],['GET','/api/getReturnStatus'],['GET','/api/getAdminPeople'],['GET','/api/queryBorrowRecords?date=20260917'],['POST','/api/addBook',{}],['POST','/api/saveBook',{}],['POST','/api/deleteBook',{}],['PUT','/api/updatePerson',{}],['PUT','/api/updateBorrowRecord',{}]]) {
      assert.equal((await request(app,method,url,body)).status,401,url);
      assert.equal((await request(app,method,url,body,alice)).status,403,url);
    }
    assert.equal((await request(app,'GET','/api/getUserPeople',undefined,admin.data.token)).status,200);
    assert.equal((await request(app,'GET','/api/me',undefined,'a'.repeat(64))).status,401);
    assert.equal((await request(app,'POST','/login',{})).status,410);
    assert.equal((await request(app,'POST','/api/borrowBook',{bookId:1,userId:'admin'},alice)).status,400);
    assert.equal((await request(app,'POST','/api/borrowBook',{bookId:1,requestId:'auth-test-borrow-01',barcode:'LIB000001'},alice)).status,200);
    assert.equal((await request(app,'POST','/api/returnBook',{recordId:1},bob)).status,404);
    assert.equal((await request(app,'GET','/api/myBorrowRecords',undefined,bob)).data.length,0);
    const records=(await request(app,'GET','/api/myBorrowRecords',undefined,alice)).data;
    assert.equal(records.length,1); assert.equal(records[0].用户名,'alice');
    assert.equal((await request(app,'PATCH','/api/me',{name:'别人'})).status,401);
    for (const body of [{}, {id:1,name:'别人'}, {角色:'管理员'}, {nickname:'  '}, {contact:'abc'}, {name:'x'.repeat(101)}]) {
      assert.equal((await request(app,'PATCH','/api/me',body,alice)).status,400);
    }
    assert.equal((await request(app,'PATCH','/api/me',{nickname:'bob'},alice)).status,409);
    assert.equal((await request(app,'GET','/api/me',undefined,alice)).data.user.用户名,'alice');
    const profile = await request(app,'PATCH','/api/me',{nickname:' alice-new ',name:'新姓名',contact:'+86 13800000000'},alice);
    assert.equal(profile.status,200);
    assert.equal(profile.data.user.用户名,'alice-new');
    assert.equal(profile.data.user.真实姓名,'新姓名');
    assert.equal(profile.data.user.电话,'+86 13800000000');
    assert.equal(profile.data.user.角色,'普通用户');
    assert.equal((await request(app,'GET','/api/me',undefined,bob)).data.user.用户名,'bob');
    assert.equal((await request(app,'GET','/api/myBorrowRecords',undefined,alice)).data[0].用户名,'alice-new');
    assert.equal((await request(app,'POST','/api/login',{nickname:'alice',password:'test-user-password'})).status,401);
    assert.equal((await request(app,'POST','/api/login',{nickname:'alice-new',password:'test-user-password'})).status,200);
    assert.equal((await request(app,'POST','/api/returnBook',{recordId:records[0].id},alice)).status,200);
    assert.equal((await request(app,'POST','/api/logout',{},alice)).status,200);
    assert.equal((await request(app,'GET','/api/me',undefined,alice)).status,401);
    const reset = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname,'../set-password.js'),'bob'], { env: { ...process.env, LIBRARY_NEW_PASSWORD: 'reset-user-password' }, encoding: 'utf8' });
    assert.equal(reset.status,0,reset.stderr);
    assert.equal((await request(app,'GET','/api/me',undefined,bob)).status,401);
    const bobNew=(await request(app,'POST','/api/login',{nickname:'bob',password:'reset-user-password'})).data.token;
    await run('UPDATE auth_sessions SET expires_at=0 WHERE token_hash=?',[tokenHash(bobNew)]);
    assert.equal((await request(app,'GET','/api/me',undefined,bobNew)).status,401);
    await run('UPDATE 用户信息 SET 角色=? WHERE 用户名=?',['普通用户','admin']);
    assert.equal((await request(app,'GET','/api/getUserPeople',undefined,admin.data.token)).status,403);
    for(let i=0;i<21;i++) await request(app,'POST','/api/login',{nickname:'missing',password:'test-user-password'});
    assert.equal((await request(app,'POST','/api/login',{nickname:'missing',password:'test-user-password'})).status,429);
  } finally { await new Promise(resolve=>db.close(resolve)); fs.rmSync(temp,{recursive:true,force:true}); }
});

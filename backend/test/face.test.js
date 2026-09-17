const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PNG } = require('pngjs');
const face = require('../face');
const { request } = require('./helpers');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'library-face-test-'));
process.env.LIBRARY_DB_PATH = path.join(temp, 'test.db');
function photo(width = 320, height = 240) {
  const png = new PNG({ width, height }); png.data.fill(255);
  return 'data:image/png;base64,'+PNG.sync.write(png).toString('base64');
}
const image = photo();
const vector = Array.from({ length: 128 }, (_,i) => Math.sin(i)/10);
test('real server-side models load and reject a frame without a face; input bounds and encrypted matching', async () => {
  try {
    assert.throws(() => face.decodeImage('data:image/svg+xml;base64,AAAA'), { status: 400 });
    const badJpeg = Buffer.alloc(32,255); badJpeg[1]=216;
    assert.throws(() => face.decodeImage('data:image/jpeg;base64,'+badJpeg.toString('base64')), { status: 400 });
    assert.throws(() => face.decodeImage(photo(1100,160)), { status: 400 });
    assert.throws(() => face.decodeImage(photo(100,100)), { status: 400 });
    const invalid = Buffer.from(image.split(',')[1], 'base64'); invalid.writeUInt32BE(1000000,16);
    assert.throws(() => face.decodeImage('data:image/png;base64,'+invalid.toString('base64')), { status: 400 });
    await assert.rejects(face.extract(image), { status: 422 });
    const humanPhoto = name => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname,'fixtures/faces',name+'.jpg')).toString('base64');
    const first = await face.extract(humanPhoto('angry'));
    const second = await face.extract(humanPhoto('surprised'));
    assert.equal(first.length,128); assert.equal(second.length,128);
    const stored = face.encrypt(first,process.env.LIBRARY_DB_PATH);
    assert.equal(face.matches(await face.extract(humanPhoto('angry')),stored,process.env.LIBRARY_DB_PATH),true);
    assert.equal(face.matches(second,stored,process.env.LIBRARY_DB_PATH),false);
    const encrypted = face.encrypt(vector, process.env.LIBRARY_DB_PATH);
    assert.equal(encrypted.length,540);
    assert.equal(fs.statSync(path.join(temp,'face.key')).mode & 0o777,0o600);
    assert.equal(face.matches(vector,encrypted,process.env.LIBRARY_DB_PATH),true);
    assert.equal(face.matches(vector.map(x=>x+0.01),encrypted,process.env.LIBRARY_DB_PATH),true);
    assert.equal(face.matches(vector.map(x=>x+0.1),encrypted,process.env.LIBRARY_DB_PATH),false);
    const tampered = Buffer.from(encrypted); tampered[100]^=1;
    assert.equal(face.matches(vector,tampered,process.env.LIBRARY_DB_PATH),false);
    assert.equal(face.matches(Array(128).fill(NaN),encrypted,process.env.LIBRARY_DB_PATH),false);
    assert.notDeepEqual(face.encrypt(vector,process.env.LIBRARY_DB_PATH),encrypted);
  } finally { await face.close(); }
});
test('face enrollment, login, role enforcement, credential races, deletion and password recovery', async () => {
  const { app, db, ready } = require('../server');
  const q = require('../library').queries(db);
  const original = face.extract;
  let calls = 0, extractImpl = async () => vector;
  face.extract = async value => { face.decodeImage(value); calls++; return extractImpl(); };
  let ip = 0;
  // Independent addresses prevent the rate-limit from hiding unrelated assertions.
  const req = (method,url,body,token) => request(app,method,url,body,token,'127.0.0.'+(++ip));
  try {
    await ready;
    for (const name of ['alice','bob']) assert.equal((await req('POST','/api/register',{nickname:name,name,contact:'123',password:'face-test-password'})).status,201);
    const alice = (await req('POST','/api/login',{nickname:'alice',password:'face-test-password'})).data;
    const aliceOther = (await req('POST','/api/login',{nickname:'alice',password:'face-test-password'})).data.token;
    const bob = (await req('POST','/api/login',{nickname:'bob',password:'face-test-password'})).data;
    assert.equal((await req('GET','/api/face/status')).status,401);
    assert.equal((await req('GET','/api/face/status',undefined,alice.token)).data.enrolled,false);
    assert.equal((await req('POST','/api/face/enroll',{password:'face-test-password',image})).status,401);
    assert.equal((await req('POST','/api/face/enroll',{password:'wrong-password',image},alice.token)).status,403);
    assert.equal(calls,0);
    for (const extra of [{userId:bob.user.id},{descriptor:vector},{角色:'管理员'}]) assert.equal((await req('POST','/api/face/enroll',{password:'face-test-password',image,...extra},alice.token)).status,400);
    assert.equal((await req('POST','/api/face/login',{nickname:'alice',image})).status,401);
    assert.equal(calls,0);
    assert.equal((await req('POST','/api/face/enroll',{password:'face-test-password',image},alice.token)).status,200);
    assert.equal((await req('GET','/api/me',undefined,aliceOther)).status,401);
    assert.equal((await req('GET','/api/me',undefined,bob.token)).status,200);
    const status = (await req('GET','/api/face/status',undefined,alice.token)).data;
    assert.deepEqual(Object.keys(status).sort(),['enrolled','success','updatedAt']);
    assert.equal(status.enrolled,true);
    assert.equal((await req('GET','/api/face/status',undefined,bob.token)).data.enrolled,false);
    const stored = await q.get('SELECT * FROM face_credentials WHERE user_id=?',[alice.user.id]);
    assert.equal(stored.descriptor.length,540);
    assert.equal(face.matches(vector,stored.descriptor,process.env.LIBRARY_DB_PATH),true);
    assert.equal((await req('POST','/api/face/login',{nickname:'alice',image,角色:'管理员'})).status,400);
    let login = await req('POST','/api/face/login',{nickname:'alice',image});
    assert.equal(login.status,200); assert.equal(login.data.user.id,alice.user.id); assert.equal(login.data.user.角色,'普通用户');
    assert.equal((await req('GET','/api/getUserPeople',undefined,login.data.token)).status,403);
    assert.equal('descriptor' in login.data.user,false); assert.equal('password_hash' in login.data.user,false);
    await q.run('UPDATE auth_sessions SET expires_at=0 WHERE token_hash=?',[require('../auth').tokenHash(login.data.token)]);
    assert.equal((await req('GET','/api/me',undefined,login.data.token)).status,401);
    extractImpl = async () => vector.map(x=>x+0.1);
    assert.equal((await req('POST','/api/face/login',{nickname:'alice',image})).status,401);
    extractImpl = async () => { throw face.failure(422,'未检测到人脸'); };
    assert.equal((await req('POST','/api/face/enroll',{password:'face-test-password',image},alice.token)).status,422);
    assert.equal((await q.get('SELECT descriptor FROM face_credentials WHERE user_id=?',[alice.user.id])).descriptor.equals(stored.descriptor),true);
    extractImpl = async () => { throw face.failure(503,'模型不可用'); };
    assert.equal((await req('POST','/api/face/login',{nickname:'alice',image})).status,503);
    extractImpl = async () => vector;
    // A rename keeps enrollment bound to the fixed account ID.
    await req('PATCH','/api/me',{nickname:'alice-new'},alice.token);
    assert.equal((await req('POST','/api/face/login',{nickname:'alice',image})).status,401);
    assert.equal((await req('POST','/api/face/login',{nickname:'alice-new',image})).status,200);
    // Roles are fetched after inference, not accepted from the client or cached.
    extractImpl = async () => { await q.run('UPDATE 用户信息 SET 角色=? WHERE id=?',['管理员',alice.user.id]); return vector; };
    login = await req('POST','/api/face/login',{nickname:'alice-new',image});
    assert.equal(login.data.user.角色,'管理员');
    await q.run('UPDATE 用户信息 SET 角色=? WHERE id=?',['普通用户',alice.user.id]);
    assert.equal((await req('GET','/api/getUserPeople',undefined,login.data.token)).status,403);
    // Deleting/replacing enrollment during inference cannot produce a new session.
    extractImpl = async () => { await q.run('DELETE FROM face_credentials WHERE user_id=?',[alice.user.id]); return vector; };
    const before = (await q.get('SELECT COUNT(*) AS n FROM auth_sessions')).n;
    assert.equal((await req('POST','/api/face/login',{nickname:'alice-new',image})).status,401);
    assert.equal((await q.get('SELECT COUNT(*) AS n FROM auth_sessions')).n,before);
    extractImpl = async () => vector;
    assert.equal((await req('POST','/api/face/enroll',{password:'face-test-password',image},alice.token)).status,200);
    const other = (await req('POST','/api/face/login',{nickname:'alice-new',image})).data.token;
    assert.equal((await req('DELETE','/api/face',{password:'wrong-password'},alice.token)).status,403);
    assert.equal((await req('DELETE','/api/face',{password:'face-test-password',userId:alice.user.id},bob.token)).status,400);
    assert.equal((await req('DELETE','/api/face',{password:'face-test-password'},bob.token)).status,200);
    assert.equal((await req('GET','/api/face/status',undefined,alice.token)).data.enrolled,true);
    assert.equal((await req('DELETE','/api/face',{password:'face-test-password'},alice.token)).status,200);
    assert.equal((await req('GET','/api/me',undefined,other)).status,401);
    assert.equal((await req('POST','/api/face/login',{nickname:'alice-new',image})).status,401);
    // Session revoked during capture prevents a delayed enrollment write.
    extractImpl = async () => { await q.run('DELETE FROM auth_sessions WHERE token_hash=?',[require('../auth').tokenHash(alice.token)]); return vector; };
    assert.equal((await req('POST','/api/face/enroll',{password:'face-test-password',image},alice.token)).status,401);
    assert.equal(await q.get('SELECT * FROM face_credentials WHERE user_id=?',[alice.user.id]),undefined);
    extractImpl = async () => vector;
    const fresh = (await req('POST','/api/login',{nickname:'alice-new',password:'face-test-password'})).data.token;
    assert.equal((await req('POST','/api/face/enroll',{password:'face-test-password',image},fresh)).status,200);
    const reset = require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'../set-password.js'),'alice-new'],{ env:{...process.env,LIBRARY_NEW_PASSWORD:'reset-face-password'},encoding:'utf8' });
    assert.equal(reset.status,0,reset.stderr);
    assert.equal(await q.get('SELECT * FROM face_credentials WHERE user_id=?',[alice.user.id]),undefined);
    assert.equal((await req('GET','/api/me',undefined,fresh)).status,401);
    assert.equal((await req('POST','/api/login',{nickname:'alice-new',password:'reset-face-password'})).status,200);
    assert.equal((await req('POST','/login',{imageUrl:image})).status,410);
    // Full HTTP enrollment and login with the real model, not the test extractor.
    face.extract = original;
    const humanPhoto = name => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname,'fixtures/faces',name+'.jpg')).toString('base64');
    const genuine = (await req('POST','/api/login',{nickname:'alice-new',password:'reset-face-password'})).data.token;
    assert.equal((await req('POST','/api/face/enroll',{password:'reset-face-password',image:humanPhoto('angry')},genuine)).status,200);
    const realLogin = await req('POST','/api/face/login',{nickname:'alice-new',image:humanPhoto('angry')});
    assert.equal(realLogin.status,200); assert.equal(realLogin.data.user.id,alice.user.id);
    assert.equal((await req('POST','/api/face/login',{nickname:'alice-new',image:humanPhoto('surprised')})).status,401);
    assert.equal((await req('GET','/api/me',undefined,realLogin.data.token)).status,200);
    assert.equal((await req('DELETE','/api/face',{password:'reset-face-password'},genuine)).status,200);

    for (let i=0;i<20;i++) assert.equal((await request(app,'POST','/api/face/login',{nickname:'missing',image},undefined,'127.0.1.1')).status,401);
    assert.equal((await request(app,'POST','/api/face/login',{nickname:'missing',image},undefined,'127.0.1.1')).status,429);
  } finally { face.extract = original; await face.close(); await new Promise(resolve => db.close(resolve)); }
});

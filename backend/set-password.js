const readline = require('node:readline');
const { Writable } = require('node:stream');
const { db, ready } = require('./server');
const { validPassword, hashPassword } = require('./auth');
async function main() {
  const username = process.argv[2];
  if (!username) throw new Error('用法：node set-password.js <用户名>');
  await ready;
  let password = process.env.LIBRARY_NEW_PASSWORD;
  if (!password) {
    if (!process.stdin.isTTY) throw new Error('请在终端运行，或通过 LIBRARY_NEW_PASSWORD 环境变量提供密码');
    const output = new Writable({ write(chunk, encoding, callback) { callback(); } });
    const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
    process.stdout.write('请输入新密码（输入隐藏）：');
    password = await new Promise(resolve => rl.question('', resolve));
    rl.close(); process.stdout.write('\n');
  }
  if (!validPassword(password)) throw new Error('密码须为 8–128 个字符');
  const hash = await hashPassword(password);
  const run = (sql, args = []) => new Promise((resolve, reject) => db.run(sql,args,function(err) { err ? reject(err) : resolve(this); }));
  await run('BEGIN IMMEDIATE');
  try {
    const result = await run('UPDATE 用户信息 SET password_hash = ? WHERE 用户名 = ?', [hash,username]);
    if (!result.changes) throw new Error('用户不存在');
    await run('DELETE FROM auth_sessions WHERE user_id = (SELECT id FROM 用户信息 WHERE 用户名 = ?)', [username]);
    await run('DELETE FROM face_credentials WHERE user_id = (SELECT id FROM 用户信息 WHERE 用户名 = ?)', [username]);
    await run('COMMIT');
  } catch (err) { await run('ROLLBACK'); throw err; }
  console.log('密码已设置，该账号现有会话已注销，人脸凭据已删除');
}
main().catch(err => { console.error(err.message); process.exitCode = 1; }).finally(() => db.close());

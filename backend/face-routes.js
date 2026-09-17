const Joi = require('joi');
const face = require('./face');
const library = require('./library');
const { verifyPassword, newToken, tokenHash } = require('./auth');
module.exports = function install({ app, dbPath, get, safeUser, loginLimit }) {
  const password = Joi.string().min(8).max(128).required();
  const image = Joi.string().max(1400000).required();
  const check = (schema, body) => {
    const result = schema.unknown(false).validate(body);
    if (result.error) throw face.failure(400, '请填写正确的昵称、密码和摄像头照片');
    return result.value;
  };
  async function verified(req, value) {
    const row = await get('SELECT id,password_hash FROM 用户信息 WHERE id=?', [req.user.id]);
    if (!await verifyPassword(value.password, row?.password_hash)) throw face.failure(403, '当前密码错误');
    return row;
  }
  async function stillVerified(q, req, row) {
    const current = await q.get('SELECT u.id,u.password_hash FROM 用户信息 u JOIN auth_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?', [req.sessionHash, Date.now()]);
    if (!current || current.id !== row.id || current.password_hash !== row.password_hash) throw face.failure(401, '登录信息已变化，请重新登录');
  }
  app.get('/api/face/status', async (req, res, next) => {
    try {
      const row = await get('SELECT updated_at FROM face_credentials WHERE user_id=?', [req.user.id]);
      res.json({ success: true, enrolled: !!row, updatedAt: row?.updated_at || null });
    } catch (err) { next(err); }
  });
  app.post('/api/face/enroll', loginLimit, async (req, res, next) => {
    try {
      const value = check(Joi.object({ password, image }), req.body);
      const row = await verified(req, value);
      const descriptor = await face.extract(value.image);
      const encrypted = face.encrypt(descriptor, dbPath);
      await library.transaction(dbPath, async q => {
        await stillVerified(q, req, row);
        await q.run('INSERT INTO face_credentials(user_id,descriptor,model_version,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET descriptor=excluded.descriptor,model_version=excluded.model_version,updated_at=excluded.updated_at', [row.id,encrypted,face.VERSION,new Date().toISOString()]);
        await q.run('DELETE FROM auth_sessions WHERE user_id=? AND token_hash<>?', [row.id,req.sessionHash]);
      });
      res.json({ success: true, message: '人脸已录入，其他登录会话已注销' });
    } catch (err) { next(err); }
  });
  app.delete('/api/face', loginLimit, async (req, res, next) => {
    try {
      const value = check(Joi.object({ password }), req.body);
      const row = await verified(req, value);
      await library.transaction(dbPath, async q => {
        await stillVerified(q, req, row);
        await q.run('DELETE FROM face_credentials WHERE user_id=?', [row.id]);
        await q.run('DELETE FROM auth_sessions WHERE user_id=? AND token_hash<>?', [row.id,req.sessionHash]);
      });
      res.json({ success: true, message: '人脸已删除，其他登录会话已注销' });
    } catch (err) { next(err); }
  });
  app.post('/api/face/login', loginLimit, async (req, res, next) => {
    try {
      const value = check(Joi.object({ nickname: Joi.string().trim().min(1).max(64).required(), image }), req.body);
      const row = await get('SELECT u.*,f.descriptor,f.model_version FROM 用户信息 u JOIN face_credentials f ON f.user_id=u.id WHERE u.用户名=?', [value.nickname]);
      if (!row?.password_hash || row.model_version !== face.VERSION) throw face.failure(401, '人脸验证失败，请使用密码登录或先录入人脸');
      const descriptor = await face.extract(value.image);
      if (!face.matches(descriptor, row.descriptor, dbPath)) throw face.failure(401, '人脸验证失败，请使用密码登录');
      const result = await library.transaction(dbPath, async q => {
        const current = await q.get('SELECT u.*,f.descriptor,f.model_version FROM 用户信息 u JOIN face_credentials f ON f.user_id=u.id WHERE u.id=?', [row.id]);
        if (!current || current.password_hash !== row.password_hash || current.model_version !== face.VERSION || !Buffer.from(current.descriptor).equals(Buffer.from(row.descriptor))) throw face.failure(401, '人脸凭据已变化，请重新登录');
        const token = newToken(), expiresAt = Date.now()+8*60*60*1000;
        await q.run('DELETE FROM auth_sessions WHERE expires_at<=?', [Date.now()]);
        await q.run('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', [tokenHash(token),current.id,expiresAt]);
        return { success: true, user: safeUser(current), token, expiresAt };
      });
      res.json(result);
    } catch (err) { next(err); }
  });
};

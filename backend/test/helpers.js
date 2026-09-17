const http = require('node:http');
const net = require('node:net');
function request(app, method, url, body, token, clientAddress) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    if (clientAddress) Object.defineProperty(socket, 'remoteAddress', { value: clientAddress });
    const req = new http.IncomingMessage(socket);
    req.method = method; req.url = url;
    const data = body === undefined ? null : JSON.stringify(body);
    req.headers = { host: 'localhost', ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}), ...(token ? { authorization: 'Bearer '+token } : {}) };
    const res = new http.ServerResponse(req);
    let text = '';
    res.write = chunk => { text += chunk; return true; };
    res.end = chunk => { if(chunk) text += chunk; resolve({ status: res.statusCode, data: text ? JSON.parse(text) : null }); return res; };
    req.on('error',reject);
    app.handle(req,res,err => reject(err || new Error('Unhandled request')));
    if(data) req.push(data);
    req.push(null);
  });
}

module.exports = { request };

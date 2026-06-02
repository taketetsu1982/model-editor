#!/usr/bin/env node
// editors/server.js — editorをlocalhost配信し /model でJSONを読み書きするローカルサーバ
//   使い方: node server.js <modelPath> [port]
const http = require('http');
const fs = require('fs');
const path = require('path');
const core = require('./lib/server-core.js');

const ROOT = __dirname; // editors/
const modelPathArg = process.argv[2];
const startPort = parseInt(process.argv[3], 10) || 8765;

if (!modelPathArg) {
  console.error('error: モデルJSONのパスを指定してください (node server.js <modelPath> [port])');
  process.exit(1);
}
const modelPath = path.resolve(modelPathArg);
if (!fs.existsSync(modelPath)) {
  console.error('error: モデルJSONが見つかりません: ' + modelPath);
  process.exit(1);
}

const server = http.createServer(function(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // /model — 対象JSONの読み書き
  if (urlPath === '/model') {
    if (req.method === 'GET') {
      fs.readFile(modelPath, 'utf8', function(err, data) {
        if (err) { res.writeHead(500); res.end('read error'); return; }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Model-Name': path.basename(modelPath),
        });
        res.end(data);
      });
      return;
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', function(c) { body += c; });
      req.on('end', function() {
        try { JSON.parse(body); } catch (e) { res.writeHead(400); res.end('invalid json'); return; }
        const tmp = modelPath + '.tmp';
        fs.writeFile(tmp, body, function(werr) {
          if (werr) { res.writeHead(500); res.end('write error'); return; }
          fs.rename(tmp, modelPath, function(rerr) {
            if (rerr) { res.writeHead(500); res.end('rename error'); return; }
            res.writeHead(200); res.end('ok');
          });
        });
      });
      return;
    }
    res.writeHead(405); res.end('method not allowed');
    return;
  }

  // 静的配信（GETのみ）
  if (req.method === 'GET') {
    const filePath = core.resolveStaticPath(urlPath, ROOT);
    if (!filePath) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(filePath, function(err, data) {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': core.contentTypeFor(filePath) });
      res.end(data);
    });
    return;
  }

  res.writeHead(405); res.end('method not allowed');
});

// ポート探索（使用中なら +1、最大20回）
function listen(port, attempts) {
  function onError(e) {
    if (e.code === 'EADDRINUSE' && attempts > 0) {
      listen(port + 1, attempts - 1);
    } else {
      console.error('error: サーバ起動に失敗しました: ' + e.message);
      process.exit(1);
    }
  }
  server.once('error', onError);
  server.listen(port, '127.0.0.1', function() {
    server.removeListener('error', onError);
    console.log('http://localhost:' + port + '/');
  });
}
listen(startPort, 20);

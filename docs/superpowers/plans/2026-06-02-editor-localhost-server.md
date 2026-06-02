# editor localhostローカルサーバ方式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** editor.html を localhost サーバ経由で配信し、対象JSONを fetch で自動読込・サーバ直書き保存することで、ファイル選択を完全に不要にする。

**Architecture:** Node標準モジュールのみの小さなHTTPサーバ（`editors/server.js`）が editor.html / lib を配信し、`/model` の GET/PUT で対象JSONを読み書きする。editor.html はロード時に `location.protocol` でサーバモードかを判定し、サーバモードでは `fetch('/model')` で自動読込・`PUT /model` で保存する。`file://` で開いた場合は従来の File System Access API / ピッカー / D&D にフォールバックする。

**Tech Stack:** Node.js（標準 http / fs / path のみ、追加依存なし）、ブラウザJS（既存のグローバルscript構成）、テストは vitest（`npx vitest run`）。

参照スペック: `docs/superpowers/specs/2026-06-02-editor-localhost-server-design.md`

---

## File Structure

| ファイル | 種別 | 責務 |
|---|---|---|
| `editors/lib/server-core.js` | 新規 | サーバの純粋ヘルパ（`contentTypeFor`, `resolveStaticPath`）。I/Oなし・テスト可能 |
| `editors/lib/server-core.test.js` | 新規 | server-core の単体テスト |
| `editors/server.js` | 新規 | HTTPサーバ起動本体。server-core を使い静的配信 + `/model` GET/PUT。`node server.js <modelPath> [port]` |
| `editors/lib/file-io.js` | 変更 | クライアント側サーバモード対応（`detectMode`/`loadModelFromServer`/`saveModelToServer` の追加と `createFileIO` への統合） |
| `editors/lib/file-io.test.js` | 変更 | 上記新関数とサーバモード保存経路のテスト |
| `editors/editor.html` | 変更 | ロード時にサーバモードを判定し `io.initServerMode()` を呼ぶ |
| `skills/edit/SKILL.md` | 変更 | サーバ起動 → localhostで開く → 完了時に停止＆読み戻すフローに更新 |

---

## Task 1: server-core.js の純粋ヘルパ

**Files:**
- Create: `editors/lib/server-core.js`
- Test: `editors/lib/server-core.test.js`

- [ ] **Step 1: 失敗するテストを書く**

Create `editors/lib/server-core.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const { contentTypeFor, resolveStaticPath } = require('./server-core.js');

describe('contentTypeFor', () => {
  it('拡張子ごとに正しいMIMEを返す', () => {
    expect(contentTypeFor('/x/editor.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeFor('/x/lib/file-io.js')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeFor('/x/lib/editor-base.css')).toBe('text/css; charset=utf-8');
    expect(contentTypeFor('/x/product-model.json')).toBe('application/json; charset=utf-8');
  });
  it('未知の拡張子はoctet-stream', () => {
    expect(contentTypeFor('/x/foo.bin')).toBe('application/octet-stream');
    expect(contentTypeFor('/x/noext')).toBe('application/octet-stream');
  });
});

describe('resolveStaticPath', () => {
  const root = '/srv/editors';
  it("'/' は editor.html を指す", () => {
    expect(resolveStaticPath('/', root)).toBe(path.resolve(root, 'editor.html'));
  });
  it('lib配下のファイルを解決する', () => {
    expect(resolveStaticPath('/lib/file-io.js', root)).toBe(path.resolve(root, 'lib/file-io.js'));
  });
  it('rootの外へ出るパスはnullを返す（トラバーサル防止）', () => {
    expect(resolveStaticPath('/../secrets.txt', root)).toBe(null);
    expect(resolveStaticPath('/../../etc/passwd', root)).toBe(null);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run editors/lib/server-core.test.js`
Expected: FAIL（`Cannot find module './server-core.js'`）

- [ ] **Step 3: 最小実装を書く**

Create `editors/lib/server-core.js`:

```js
// editors/lib/server-core.js — サーバの純粋ヘルパ（I/Oなし）
(function(exports) {
  var path = require('path');

  var TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };

  // contentTypeFor(filePath) — 拡張子からMIMEタイプを返す
  exports.contentTypeFor = function(filePath) {
    var i = filePath.lastIndexOf('.');
    var ext = i >= 0 ? filePath.slice(i) : '';
    return TYPES[ext] || 'application/octet-stream';
  };

  // resolveStaticPath(urlPath, rootDir) — URLパスをroot内の絶対パスへ解決
  //   '/' は editor.html を指す。rootの外へ出る場合は null（トラバーサル防止）
  exports.resolveStaticPath = function(urlPath, rootDir) {
    var rel = urlPath === '/' ? 'editor.html' : urlPath.replace(/^\/+/, '');
    var resolved = path.resolve(rootDir, rel);
    var normRoot = path.resolve(rootDir);
    if (resolved !== normRoot && !resolved.startsWith(normRoot + path.sep)) return null;
    return resolved;
  };

})(typeof module !== 'undefined' ? module.exports : (window.__serverCore = {}));
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run editors/lib/server-core.test.js`
Expected: PASS（8 tests）

- [ ] **Step 5: コミット**

```bash
git add editors/lib/server-core.js editors/lib/server-core.test.js
git commit -m "feat: サーバ用純粋ヘルパ server-core を追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: server.js 起動本体

**Files:**
- Create: `editors/server.js`

このタスクはNodeのI/Oが中心のため、ユニットテストではなく起動スモークテスト（curl）で検証する。

- [ ] **Step 1: server.js を書く**

Create `editors/server.js`:

```js
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
```

- [ ] **Step 2: 起動スモークテスト（GET /model）**

Run:
```bash
node editors/server.js sample/product-model.json 8765 & SRV=$!
sleep 1
curl -s -i http://localhost:8765/model | head -5
curl -s http://localhost:8765/ | head -3
kill $SRV
```
Expected: `/model` が `200` と `X-Model-Name: product-model.json` を返し、`/` が editor.html の先頭（`<!DOCTYPE html>` 等）を返す。

> 注: `sample/product-model.json` が存在しない場合は、リポジトリ内の任意の `*.json`（例 `git show HEAD:sample/product-model.json > /tmp/pm.json` で用意）を使う。テスト後 `editors/*.tmp` が残っていないことも確認する。

- [ ] **Step 3: 保存スモークテスト（PUT /model）と範囲外拒否**

Run:
```bash
cp sample/product-model.json /tmp/pm-test.json
node editors/server.js /tmp/pm-test.json 8766 & SRV=$!
sleep 1
curl -s -X PUT -d '{"objects":{},"views":{}}' http://localhost:8766/model
echo "--- 不正JSON ---"
curl -s -o /dev/null -w "%{http_code}\n" -X PUT -d 'not json' http://localhost:8766/model
echo "--- トラバーサル ---"
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:8766/../server.js'
kill $SRV
cat /tmp/pm-test.json
```
Expected: 正常PUTは `ok`、不正JSONは `400`、トラバーサルは `403`。`/tmp/pm-test.json` の中身が `{"objects":{},"views":{}}` に更新されている。

- [ ] **Step 4: コミット**

```bash
git add editors/server.js
git commit -m "feat: editorをlocalhost配信するserver.jsを追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: file-io.js クライアント側の純粋ヘルパ

**Files:**
- Modify: `editors/lib/file-io.js`（`exports` に3関数を追加）
- Test: `editors/lib/file-io.test.js`（テスト追加）

- [ ] **Step 1: 失敗するテストを追加**

`editors/lib/file-io.test.js` の末尾（最後の `});` の後）に以下を追記。あわせてファイル冒頭の require 行を
`const { createFileIO, validateVariants } = require('./file-io.js');`
から
`const { createFileIO, validateVariants, detectMode, loadModelFromServer, saveModelToServer } = require('./file-io.js');`
へ変更する。

```js
describe('detectMode', () => {
  it('http/https はサーバモード', () => {
    expect(detectMode('http:')).toBe('server');
    expect(detectMode('https:')).toBe('server');
  });
  it('file はファイルモード', () => {
    expect(detectMode('file:')).toBe('file');
  });
});

describe('loadModelFromServer', () => {
  it('GET /model の本文をパースし name と共に返す', async () => {
    const fetchImpl = async (url) => {
      expect(url).toBe('/model');
      return {
        ok: true,
        headers: { get: (k) => (k === 'X-Model-Name' ? 'product-model.json' : null) },
        text: async () => '{"objects":{"a":{}},"views":{}}',
      };
    };
    const result = await loadModelFromServer(fetchImpl);
    expect(result.name).toBe('product-model.json');
    expect(result.data.objects.a).toEqual({});
  });
  it('レスポンスが ok でなければ例外', async () => {
    const fetchImpl = async () => ({ ok: false, status: 500 });
    await expect(loadModelFromServer(fetchImpl)).rejects.toThrow();
  });
});

describe('saveModelToServer', () => {
  it('PUT /model に整形JSONを送り ok を返す', async () => {
    let captured = null;
    const fetchImpl = async (url, opts) => {
      captured = { url, opts };
      return { ok: true };
    };
    const ok = await saveModelToServer({ objects: {}, views: {} }, fetchImpl);
    expect(ok).toBe(true);
    expect(captured.url).toBe('/model');
    expect(captured.opts.method).toBe('PUT');
    expect(captured.opts.body).toBe(JSON.stringify({ objects: {}, views: {} }, null, 2) + '\n');
  });
  it('ok でなければ false', async () => {
    const ok = await saveModelToServer({}, async () => ({ ok: false }));
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run editors/lib/file-io.test.js`
Expected: FAIL（`detectMode is not a function` 等）

- [ ] **Step 3: file-io.js に3関数を追加**

`editors/lib/file-io.js` の `exports.validateVariants = function(data) {...};`（32行目付近の閉じ括弧）の直後に以下を追加する:

```js
  /**
   * detectMode(protocol) — 配信元プロトコルから動作モードを判定
   *   'http:' / 'https:' → 'server'（localhostサーバ経由）
   *   それ以外（'file:' 等） → 'file'（従来のFile System Access API）
   */
  exports.detectMode = function(protocol) {
    return (protocol === 'http:' || protocol === 'https:') ? 'server' : 'file';
  };

  /**
   * loadModelFromServer(fetchImpl) — GET /model で対象JSONを取得
   *   戻り値: { data: object, name: string }
   *   失敗時は例外を投げる
   */
  exports.loadModelFromServer = async function(fetchImpl) {
    var res = await fetchImpl('/model');
    if (!res || !res.ok) throw new Error('model fetch failed: ' + (res && res.status));
    var name = (res.headers && res.headers.get && res.headers.get('X-Model-Name')) || 'product-model.json';
    var text = await res.text();
    return { data: JSON.parse(text), name: name };
  };

  /**
   * saveModelToServer(full, fetchImpl) — PUT /model で対象JSONを保存
   *   戻り値: true（成功） / false（失敗）
   */
  exports.saveModelToServer = async function(full, fetchImpl) {
    var res = await fetchImpl('/model', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(full, null, 2) + '\n',
    });
    return !!(res && res.ok);
  };
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run editors/lib/file-io.test.js`
Expected: PASS（既存14 + 新規6 = 20 tests）

- [ ] **Step 5: コミット**

```bash
git add editors/lib/file-io.js editors/lib/file-io.test.js
git commit -m "feat: file-ioにサーバモード用の純粋ヘルパを追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: createFileIO へサーバモードを統合

**Files:**
- Modify: `editors/lib/file-io.js`（`createFileIO` 内部）
- Test: `editors/lib/file-io.test.js`（serverMode保存経路のテスト追加）

- [ ] **Step 1: 失敗するテストを追加**

`editors/lib/file-io.test.js` の末尾に以下を追記。`createFileIO` の serverMode 保存経路を、`config.fetchImpl` 注入 + 最小DOMスタブで検証する。

```js
// 最小DOMスタブ: updateStatus等が参照する要素を用意する
function withDomStub(fn) {
  const store = {};
  const make = () => ({ className: '', textContent: '', style: {}, classList: { add(){}, remove(){}, toggle(){} } });
  global.document = { getElementById: (id) => (store[id] || (store[id] = make())) };
  global.window = global.window || {};
  return Promise.resolve(fn()).finally(() => { delete global.document; });
}

describe('createFileIO サーバモード', () => {
  it('initServerMode が /model を読み loadData を呼ぶ', async () => {
    await withDomStub(async () => {
      let loaded = null;
      global.window['__test'] = (d) => { loaded = d; };
      const io = createFileIO(makeConfig({
        loadDataKey: '__test',
        fetchImpl: async () => ({
          ok: true,
          headers: { get: () => 'product-model.json' },
          text: async () => '{"objects":{"x":{}},"views":{}}',
        }),
      }));
      await io.initServerMode();
      expect(loaded.objects.x).toEqual({});
      expect(io.isServerMode()).toBe(true);
    });
  });

  it('サーバモードの writeFile は PUT /model を呼ぶ', async () => {
    await withDomStub(async () => {
      let putCalled = false;
      const io = createFileIO(makeConfig({
        getFullJson: () => ({ objects: {}, views: {} }),
        fetchImpl: async (url, opts) => {
          if (opts && opts.method === 'PUT') { putCalled = true; return { ok: true }; }
          return { ok: true, headers: { get: () => 'm.json' }, text: async () => '{"objects":{},"views":{}}' };
        },
      }));
      await io.initServerMode();
      const ok = await io.writeFile();
      expect(ok).toBe(true);
      expect(putCalled).toBe(true);
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run editors/lib/file-io.test.js`
Expected: FAIL（`io.initServerMode is not a function`）

- [ ] **Step 3: createFileIO を統合実装する**

3-a. `createFileIO` 冒頭の状態変数（48行目付近）を変更:

```js
    var fileHandle = null, autoSaveEnabled = false, saveTimer = null, isSaving = false;
```
↓
```js
    var fileHandle = null, autoSaveEnabled = false, saveTimer = null, isSaving = false;
    var serverMode = false, serverModelName = '';
    var fetchImpl = config.fetchImpl || (typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null);
```

3-b. `scheduleAutoSave`（72-76行目付近）のガードを変更:

```js
    function scheduleAutoSave() {
      if (saveTimer) clearTimeout(saveTimer);
      if (!fileHandle || !autoSaveEnabled) return;
      saveTimer = setTimeout(function() { writeFile(); }, 500);
    }
```
↓
```js
    function scheduleAutoSave() {
      if (saveTimer) clearTimeout(saveTimer);
      if ((!fileHandle && !serverMode) || !autoSaveEnabled) return;
      saveTimer = setTimeout(function() { writeFile(); }, 500);
    }
```

3-c. `markModified`（67-70行目付近）を変更:

```js
    function markModified() {
      el(ids.edited).style.display = 'inline';
      if (autoSaveEnabled && fileHandle) scheduleAutoSave();
    }
```
↓
```js
    function markModified() {
      el(ids.edited).style.display = 'inline';
      if (autoSaveEnabled && (fileHandle || serverMode)) scheduleAutoSave();
    }
```

3-d. `writeFile`（79行目付近）の関数先頭に serverMode 分岐を追加。`async function writeFile() {` の直後に挿入:

```js
    async function writeFile() {
      if (serverMode) {
        if (isSaving) return false;
        var fullS = config.getFullJson();
        if (!fullS) return false;
        isSaving = true;
        updateStatus('saving', serverModelName, '');
        try {
          var ok = await exports.saveModelToServer(fullS, fetchImpl);
          if (ok) { updateStatus('connected', serverModelName); el(ids.edited).style.display = 'none'; }
          else updateStatus('error', 'Save failed');
          return ok;
        } catch (e) {
          console.error(e);
          updateStatus('error', 'Save failed');
          return false;
        } finally {
          isSaving = false;
        }
      }
      if (!fileHandle || isSaving) return false;
      // ...（既存のFile System Access API経路はそのまま）
```

> 注: 既存の `if (!fileHandle || isSaving) return false;` 行はそのまま残す。serverMode分岐をその直前に挿入する形になる。

3-e. `initServerMode` を追加する。`onFileConnected` 関数（114行目付近）の直後に追加:

```js
    // initServerMode() — サーバモードを初期化し /model を自動読込する
    async function initServerMode() {
      if (!fetchImpl) { updateStatus('error', 'fetch利用不可'); return; }
      try {
        var result = await exports.loadModelFromServer(fetchImpl);
        serverMode = true;
        serverModelName = result.name;
        autoSaveEnabled = true;
        el(ids.autoBtn).style.display = 'flex';
        el(ids.autoBtn).classList.add('active');
        updateStatus('connected', serverModelName);
        var cb = window[config.loadDataKey];
        if (cb) cb(result.data);
      } catch (e) {
        console.error('server mode init failed:', e);
        updateStatus('error', 'サーバ読込失敗');
        // フォールバック: 従来のConnect UIのまま操作可能
      }
    }
```

3-f. `handleConnect`（134行目付近）の先頭に serverMode 分岐を追加:

```js
    async function handleConnect() {
      if (serverMode) {
        var sok = await writeFile();
        if (sok) showToast('保存しました');
        return;
      }
      if (fileHandle) {
        // ...（既存）
```

3-g. `setupKeyboard` 内の Cmd+S 処理（221行目付近）を変更:

```js
          if (fileHandle) writeFile().then(function(ok) { if (ok) showToast('保存しました'); });
```
↓
```js
          if (fileHandle || serverMode) writeFile().then(function(ok) { if (ok) showToast('保存しました'); });
```

3-h. 戻り値オブジェクト（242-252行目付近）に `initServerMode` と `isServerMode` を追加:

```js
    return {
      updateStatus: updateStatus,
      showToast: showToast,
      markModified: markModified,
      writeFile: writeFile,
      handleConnect: handleConnect,
      toggleAuto: toggleAuto,
      setupDragDrop: setupDragDrop,
      setupKeyboard: setupKeyboard,
      getFileHandle: function() { return fileHandle; },
      initServerMode: initServerMode,
      isServerMode: function() { return serverMode; },
    };
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run editors/lib/file-io.test.js`
Expected: PASS（既存20 + 新規2 = 22 tests）

- [ ] **Step 5: 全テストを実行して回帰がないことを確認**

Run: `npx vitest run editors/`
Expected: 全テストファイル PASS

- [ ] **Step 6: コミット**

```bash
git add editors/lib/file-io.js editors/lib/file-io.test.js
git commit -m "feat: createFileIOにサーバモード(自動読込/PUT保存)を統合

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: editor.html でサーバモードを起動

**Files:**
- Modify: `editors/editor.html:85`（`io.setupKeyboard();` の直後）

- [ ] **Step 1: 初期化呼び出しを追加**

`editors/editor.html` の以下の行:

```js
io.setupDragDrop();
io.setupKeyboard();
```
を次に変更（最後に1行追加）:

```js
io.setupDragDrop();
io.setupKeyboard();
// localhostサーバ経由で開かれた場合は対象JSONを自動読込する
if(window.__editorIO.detectMode(location.protocol)==='server'){io.initServerMode();}
```

- [ ] **Step 2: file:// 後方互換の確認**

Run: `open editors/editor.html`
Expected: 従来通り起動し、ファイル未選択状態（Connectボタン表示）になる。`detectMode('file:')` が `'file'` を返すため `initServerMode` は呼ばれない。コンソールにエラーが出ないことを確認する。

- [ ] **Step 3: サーバモードの手動E2E確認**

Run:
```bash
cp sample/product-model.json /tmp/pm-e2e.json
node editors/server.js /tmp/pm-e2e.json 8767 & SRV=$!
sleep 1
open http://localhost:8767/
```
Expected: ブラウザが開き、**ファイル選択なしで** モデルが自動表示される。編集してオブジェクトを動かすと自動保存され、`/tmp/pm-e2e.json` が更新される（`cat /tmp/pm-e2e.json` で確認）。確認後 `kill $SRV`。

- [ ] **Step 4: コミット**

```bash
git add editors/editor.html
git commit -m "feat: editor起動時にサーバモードを自動判定して読込

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: edit スキルをサーバ方式に更新

**Files:**
- Modify: `skills/edit/SKILL.md`

- [ ] **Step 1: SKILL.md を書き換える**

`skills/edit/SKILL.md` の `## Output` 以降（11行目以降）を以下で置き換える:

````markdown
## Output

- ローカルサーバを起動し、`http://localhost:<port>/` でHTMLエディタをブラウザに開く

> **注:** `{EDITOR_DIR}` はプロジェクトごとに異なる。導入時に実際のパスに置換すること。

## Execution Steps

### Step 1: 対象JSONのパスを決める

- 引数でパスが渡された場合（例: `/edit sample/product-model.json`）はそれを使う
- 省略時はリポジトリ内の `product-model.json` を1件検出して使う
  - 0件: パス指定を促して中断する
  - 複数件: 候補を提示してどれを編集するか確認する

### Step 2: ローカルサーバを起動する

`{EDITOR_DIR}/server.js` をバックグラウンドで起動し、標準出力に出る URL（`http://localhost:<port>/`）を取得する。

```bash
node {EDITOR_DIR}/server.js <対象JSONの絶対パス>
```

> サーバは `127.0.0.1` のみにバインドする。ポート8765が使用中なら自動で空きポートを探す。

### Step 3: ブラウザで開く

取得した URL を開く。

```bash
open http://localhost:<port>/
```

### Step 4: 案内メッセージ

```
Editor opened (localhost):
- URL:  http://localhost:<port>/
- JSON: <対象JSONのパス>

ファイル選択は不要です。モデルが自動で読み込まれ、編集内容は自動保存されます。

- Object タブ: オブジェクト・リレーションを編集
- Pane タブ: ペイン・Pane Graph（drilldown/embed）を編集
- Screen タブ: デバイスごとのペイン構成を編集
- 編集が完了したら教えてください
```

### Step 5: 完了処理（編集終了後）

1. 起動したサーバプロセスを停止する
2. 対象JSONを読み込んで変更内容を確認する

> 保存はファイルに直書きされるため、完了前でも対象JSONをいつでも読み戻せる。
````

- [ ] **Step 2: 整合性の目視確認**

`skills/edit/SKILL.md` を読み返し、`{EDITOR_DIR}` の参照・サーバ起動コマンド・案内メッセージに矛盾がないこと、`product-model.json` のパス決定ロジックが Step 1 と一致していることを確認する。

- [ ] **Step 3: コミット**

```bash
git add skills/edit/SKILL.md
git commit -m "docs: editスキルをlocalhostサーバ方式に更新

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 最終確認とバージョン更新

**Files:**
- Modify: `.claude-plugin/plugin.json`（バージョン）

- [ ] **Step 1: 全テスト実行**

Run: `npx vitest run editors/`
Expected: 全 PASS

- [ ] **Step 2: バージョンを上げる**

`.claude-plugin/plugin.json` の version を確認し、機能追加（後方互換あり）なので **マイナーバージョン** を上げる（例 `0.13.7` → `0.14.0`）。現行値を読んでから +1 する。

- [ ] **Step 3: コミット**

```bash
git add .claude-plugin/plugin.json
git commit -m "chore: バージョンを0.14.0に更新

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 完了条件

- `npx vitest run editors/` が全PASS
- `node editors/server.js <path>` 起動 → localhostで開く → ファイル選択なしで自動読込・自動保存される
- `open editors/editor.html`（file://）でも従来通り動作する（後方互換）
- `/edit` スキルがサーバ起動 → 開く → 完了時停止＆読み戻しのフローになっている

// docs/reqs/lib/file-io.js — 両エディタ共通のファイルI/O基盤
(function(exports) {

  /**
   * validateVariants(data) — _variantsの構造を検証する
   *
   * 戻り値:
   *   null                — 有効（エラーなし）
   *   string              — エラーメッセージ
   *
   * 検証ルール:
   *   - _variantsキーが存在しない → null（通常モードとして有効）
   *   - _variantsが配列でない → エラー
   *   - いずれかのvariantにidが存在しない → エラー
   *   - いずれかのvariantにobjectsもviewsも存在しない → エラー
   */
  exports.validateVariants = function(data) {
    if (!Object.prototype.hasOwnProperty.call(data, '_variants')) return null;
    var variants = data._variants;
    if (!Array.isArray(variants)) return '_variantsは配列である必要があります';
    if (variants.length === 0) return '_variantsが空です';
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      if (!Object.prototype.hasOwnProperty.call(v, 'id')) {
        return 'variant[' + i + ']にidが存在しません';
      }
      if (!Object.prototype.hasOwnProperty.call(v, 'objects') && !Object.prototype.hasOwnProperty.call(v, 'views')) {
        return 'variant[' + i + ']にobjectsもviewsも存在しません';
      }
    }
    return null;
  };

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
    // name はレスポンスヘッダ X-Model-Name、無ければ 'product-model.json'
    var name = (res.headers && res.headers.get && res.headers.get('X-Model-Name')) || 'product-model.json';
    var text = await res.text();
    try {
      return { data: JSON.parse(text), name: name };
    } catch (pe) {
      throw new Error('model JSON parse failed: ' + pe.message);
    }
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

  /**
   * createFileIO(config) — エディタ用ファイルI/Oインスタンスを生成
   *
   * config: {
   *   ids: { toast, dot, label, hint, edited, autoBtn, overlay },
   *   getFullJson: () => object|null,
   *   onDisconnect: () => void,        // passthrough等のリセット用
   *   loadDataKey: string,             // window上のロードコールバック名
   *   keys: { undo, redo, copy, paste, cut, del },  // window上の関数名
   *   filePickerId: string,
   *   fetchImpl: typeof fetch (省略時はwindow.fetch。テスト注入用),
   * }
   */
  exports.createFileIO = function(config) {
    var ids = config.ids;
    var fileHandle = null, autoSaveEnabled = false, saveTimer = null, isSaving = false;
    var serverMode = false, serverModelName = '';
    var fetchImpl = config.fetchImpl || (typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null);

    function el(id) { return document.getElementById(id); }

    function updateStatus(s, l, h) {
      var dot = el(ids.dot);
      dot.className = 'ed-dot ' + ((s && autoSaveEnabled) ? s : (s === 'error' ? s : ''));
      el(ids.label).textContent = l || '';
      el(ids.hint).textContent = h || '';
    }

    function showToast(m) {
      var t = el(ids.toast);
      t.textContent = m;
      t.classList.add('show');
      clearTimeout(t._timer);
      t._timer = setTimeout(function() { t.classList.remove('show'); }, 2000);
    }

    function markModified() {
      el(ids.edited).style.display = 'inline';
      if (autoSaveEnabled && (fileHandle || serverMode)) scheduleAutoSave();
    }

    function scheduleAutoSave() {
      if (saveTimer) clearTimeout(saveTimer);
      if ((!fileHandle && !serverMode) || !autoSaveEnabled) return;
      saveTimer = setTimeout(function() { writeFile(); }, 500);
    }

    // 成功時 true、失敗・スキップ時 false を返す
    async function writeFile() {
      if (serverMode) {
        if (isSaving) return false;
        var full = config.getFullJson();
        if (!full) return false;
        isSaving = true;
        updateStatus('saving', serverModelName, '');
        try {
          var ok = await exports.saveModelToServer(full, fetchImpl);
          if (ok) { updateStatus('connected', serverModelName); el(ids.edited).style.display = 'none'; }
          else { updateStatus('error', 'Save failed'); showToast('自動保存に失敗しました'); }
          return ok;
        } catch (e) {
          console.error(e);
          updateStatus('error', 'Save failed');
          showToast('自動保存に失敗しました');
          return false;
        } finally {
          isSaving = false;
        }
      }
      if (!fileHandle || isSaving) return false;
      var full = config.getFullJson();
      if (!full) return false;
      isSaving = true;
      updateStatus('saving', fileHandle.name, '');
      var writable = null;
      try {
        writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(full, null, 2) + '\n');
        await writable.close();
        updateStatus('connected', fileHandle.name);
        el(ids.edited).style.display = 'none';
        return true;
      } catch (e) {
        console.error(e);
        if (writable) try { await writable.abort(); } catch(_) {}
        updateStatus('error', 'Save failed');
        if (e.name === 'NotAllowedError') disconnectFile();
        return false;
      } finally {
        isSaving = false;
      }
    }

    function disconnectFile() {
      fileHandle = null;
      autoSaveEnabled = false;
      if (saveTimer) clearTimeout(saveTimer);
      el(ids.autoBtn).style.display = 'none';
      el(ids.edited).style.display = 'none';
      updateStatus('', 'Connect', '(Drop a JSON file)');
      if (config.onDisconnect) config.onDisconnect();
    }

    function onFileConnected(h) {
      fileHandle = h;
      if (!autoSaveEnabled) {
        autoSaveEnabled = true;
        el(ids.autoBtn).classList.add('active');
      }
      el(ids.autoBtn).style.display = 'flex';
      updateStatus('connected', h.name);
    }

    // initServerMode() — サーバモードを初期化し /model を自動読込する
    async function initServerMode() {
      if (!fetchImpl) { updateStatus('error', 'fetch利用不可'); return; }
      try {
        var result = await exports.loadModelFromServer(fetchImpl);
        var cb = window[config.loadDataKey];
        if (!cb) {
          // ロード先コールバックが未登録なら、空モデルの誤上書きを防ぐためサーバモードを開始しない
          console.error('initServerMode: loadDataコールバック(' + config.loadDataKey + ')が未登録です');
          updateStatus('error', '読込先が見つかりません');
          return;
        }
        cb(result.data);
        // データ受け渡し成功後にサーバモードと自動保存を有効化する
        serverMode = true;
        serverModelName = result.name;
        autoSaveEnabled = true;
        el(ids.autoBtn).style.display = 'flex';
        el(ids.autoBtn).classList.add('active');
        updateStatus('connected', serverModelName);
      } catch (e) {
        console.error('server mode init failed:', e);
        // サーバから読めない場合はファイルを開くフォールバックへ誘導する。
        // serverMode は false のままなので、Connectボタン押下で showOpenFilePicker が動く。
        // パースエラーとネットワーク/その他を区別して通知する。
        var msg = /parse/i.test(e && e.message || '') ? 'モデルJSONが不正です' : 'サーバ読込失敗';
        updateStatus('error', msg, 'クリックでファイルを開く');
        showToast('サーバから読み込めませんでした。Connectからファイルを開いてください');
      }
    }

    function loadJson(text, fileName) {
      var d;
      try { d = JSON.parse(text); } catch (parseErr) {
        console.error('JSON parse error:', parseErr.message, fileName);
        updateStatus('error', 'Invalid JSON');
        return null;
      }
      return d;
    }

    async function handleConnect() {
      if (serverMode) {
        var sok = await writeFile();
        if (sok) showToast('保存しました');
        return;
      }
      if (fileHandle) {
        var ok = await writeFile();
        if (ok) showToast('保存しました');
        return;
      }
      if (!('showOpenFilePicker' in window)) { showToast('JSONファイルをドロップしてください'); return; }
      try {
        var picked = await window.showOpenFilePicker({
          id: config.filePickerId,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        var h = picked[0];
        var f = await h.getFile();
        var t = await f.text();
        var d = loadJson(t, h.name);
        if (!d) return;
        onFileConnected(h);
        var cb = window[config.loadDataKey];
        if (cb) cb(d);
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error(e);
          var msg = e.name === 'NotAllowedError' ? 'ファイルアクセスが拒否されました'
                  : e.name === 'SecurityError' ? 'セキュリティエラー'
                  : 'ファイルを開けませんでした';
          updateStatus('error', msg);
        }
      }
    }

    function toggleAuto() {
      autoSaveEnabled = !autoSaveEnabled;
      el(ids.autoBtn).classList.toggle('active', autoSaveEnabled);
      showToast('自動保存 ' + (autoSaveEnabled ? 'ON' : 'OFF'));
      if (fileHandle || serverMode) {
        el(ids.dot).className = 'ed-dot ' + (autoSaveEnabled ? 'connected' : '');
      }
      if (autoSaveEnabled && (fileHandle || serverMode)) scheduleAutoSave();
    }

    function setupDragDrop() {
      var dragC = 0;
      var ov = el(ids.overlay);
      document.addEventListener('dragenter', function(e) {
        if (e.dataTransfer.types.includes('Files')) { dragC++; ov.classList.add('active'); }
      });
      document.addEventListener('dragleave', function(e) {
        if (e.dataTransfer.types.includes('Files')) { dragC--; if (dragC <= 0) { dragC = 0; ov.classList.remove('active'); } }
      });
      document.addEventListener('dragover', function(e) {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      });
      document.addEventListener('drop', async function(e) {
        dragC = 0; ov.classList.remove('active');
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        try {
          for (var item of [...e.dataTransfer.items]) {
            if (item.kind !== 'file' || typeof item.getAsFileSystemHandle !== 'function') continue;
            var h = await item.getAsFileSystemHandle();
            if (h.kind === 'file' && h.name.endsWith('.json')) {
              var f = await h.getFile();
              var t = await f.text();
              var d = loadJson(t, h.name);
              if (!d) return;
              onFileConnected(h);
              var cb = window[config.loadDataKey];
              if (cb) cb(d);
              return;
            }
          }
          updateStatus('error', 'Drop not supported');
        } catch (dropErr) {
          console.error(dropErr);
          updateStatus('error', 'ファイル読み込みに失敗しました');
        }
      });
    }

    function setupKeyboard() {
      var keys = config.keys;
      document.addEventListener('keydown', function(e) {
        var mod = e.metaKey || e.ctrlKey;
        var inField = e.target.closest('input,textarea,select,[contenteditable]');
        if (mod && e.key === 's') {
          e.preventDefault();
          if (fileHandle || serverMode) writeFile().then(function(ok) { if (ok) showToast('保存しました'); });
          return;
        }
        if (inField) return;
        if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); window[keys.undo]?.(); }
        if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); window[keys.redo]?.(); }
        if (mod && e.key === 'c') { if (window[keys.copy]?.()) { e.preventDefault(); } }
        if (mod && e.key === 'v') { if (window[keys.paste]?.()) { e.preventDefault(); } }
        if (mod && e.key === 'x') { if (window[keys.cut]?.()) { e.preventDefault(); } }
        if (e.key === 'Delete' || e.key === 'Backspace') { if (window[keys.del]?.()) { e.preventDefault(); } }
        if (mod && e.key === 'a') { if (window[keys.selectAll]?.()) { e.preventDefault(); } }
        if (mod && e.key === 'd') { if (window[keys.duplicate]?.()) { e.preventDefault(); } }
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) >= 0) {
          var step = e.shiftKey ? 10 : 1;
          var dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          var dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          if (window[keys.moveSelection]?.({dx: dx, dy: dy})) { e.preventDefault(); }
        }
      });
    }

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
  };

})(typeof module !== 'undefined' ? module.exports : (window.__editorIO = window.__editorIO || {}));

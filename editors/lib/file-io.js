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
   * createFileIO(config) — エディタ用ファイルI/Oインスタンスを生成
   *
   * config: {
   *   ids: { toast, dot, label, hint, edited, autoBtn, overlay },
   *   getFullJson: () => object|null,
   *   onDisconnect: () => void,        // passthrough等のリセット用
   *   loadDataKey: string,             // window上のロードコールバック名
   *   keys: { undo, redo, copy, paste, cut, del },  // window上の関数名
   *   filePickerId: string,
   * }
   */
  exports.createFileIO = function(config) {
    var ids = config.ids;
    var fileHandle = null, autoSaveEnabled = false, saveTimer = null, isSaving = false;

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
      if (autoSaveEnabled && fileHandle) scheduleAutoSave();
    }

    function scheduleAutoSave() {
      if (saveTimer) clearTimeout(saveTimer);
      if (!fileHandle || !autoSaveEnabled) return;
      saveTimer = setTimeout(function() { writeFile(); }, 500);
    }

    // 成功時 true、失敗・スキップ時 false を返す
    async function writeFile() {
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
      if (fileHandle) {
        el(ids.dot).className = 'ed-dot ' + (autoSaveEnabled ? 'connected' : '');
      }
      if (autoSaveEnabled && fileHandle) scheduleAutoSave();
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
          if (fileHandle) writeFile().then(function(ok) { if (ok) showToast('保存しました'); });
          return;
        }
        if (inField) return;
        if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); window[keys.undo]?.(); }
        if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); window[keys.redo]?.(); }
        if (mod && e.key === 'c') { if (window[keys.copy]?.()) { e.preventDefault(); } }
        if (mod && e.key === 'v') { if (window[keys.paste]?.()) { e.preventDefault(); } }
        if (mod && e.key === 'x') { if (window[keys.cut]?.()) { e.preventDefault(); } }
        if (e.key === 'Delete' || e.key === 'Backspace') { if (window[keys.del]?.()) { e.preventDefault(); } }
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
    };
  };

})(typeof module !== 'undefined' ? module.exports : (window.__editorIO = window.__editorIO || {}));

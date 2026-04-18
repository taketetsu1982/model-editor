# キーボードショートカット追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** エディタに Cmd+A（全選択）/ Cmd+D（複製）/ Space+ドラッグ（パン）/ 矢印キー（移動）の4ショートカットを追加する

**Architecture:** `file-io.js` の `setupKeyboard` に Cmd+A/D/矢印キーを追加し、`editor.html` の App でコールバックを登録。Space+ドラッグは `useCanvas` フック内で完結させる。

**Tech Stack:** React 18（CDN）、Babel（JSXトランスパイル）、Vitest（テスト）

**参照Spec:** `docs/superpowers/specs/2026-04-18-keyboard-shortcuts-design.md`

---

## ファイル構成

| ファイル | 変更内容 |
|----------|---------|
| `editors/lib/file-io.js` | `setupKeyboard` に Cmd+A/D/矢印キーを追加。`keys` configに3つ追加 |
| `editors/lib/ui-components.js` | `useCanvas` に Space+ドラッグ（spaceHeld state）を追加 |
| `editors/editor.html` | App: keys config拡張、handleSelectAll/handleDuplicateItem/handleMoveSelection追加、グローバル登録。各View: カーソルにspaceHeld反映、Space中のmousedown処理 |

---

### Task 1: file-io.js — Cmd+A / Cmd+D / 矢印キーの追加

**Files:**
- Modify: `editors/lib/file-io.js` (setupKeyboard関数, L214-231)

- [ ] **Step 1: `setupKeyboard` に Cmd+A / Cmd+D / 矢印キーを追加**

`editors/lib/file-io.js` の `setupKeyboard` 関数内、L230（`if (e.key === 'Delete' ...`）の後に以下を追加:

```js
        if (mod && e.key === 'a') { e.preventDefault(); window[keys.selectAll]?.(); }
        if (mod && e.key === 'd') { e.preventDefault(); window[keys.duplicate]?.(); }
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key) >= 0) {
          var step = e.shiftKey ? 10 : 1;
          var dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          var dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          if (window[keys.moveSelection]?.({dx: dx, dy: dy})) { e.preventDefault(); }
        }
```

- [ ] **Step 2: テスト実行**

Run: `npx vitest run`
Expected: 全テストPASS

- [ ] **Step 3: コミット**

```bash
git add editors/lib/file-io.js
git commit -m "feat: setupKeyboardにCmd+A/D/矢印キーを追加"
```

---

### Task 2: editor.html — keys config拡張 + handleSelectAll

**Files:**
- Modify: `editors/editor.html`

- [ ] **Step 1: keys configに3つ追加**

L95付近:

修正前:
```js
  keys:{undo:'__edUndo',redo:'__edRedo',copy:'__edCopy',paste:'__edPaste',cut:'__edCut',del:'__edDelete'},
```

修正後:
```js
  keys:{undo:'__edUndo',redo:'__edRedo',copy:'__edCopy',paste:'__edPaste',cut:'__edCut',del:'__edDelete',selectAll:'__edSelectAll',duplicate:'__edDuplicateItem',moveSelection:'__edMoveSelection'},
```

- [ ] **Step 2: App内に handleSelectAll を追加**

App関数内、`handleDelete` の後（L696のグローバル関数登録の前）に追加:

```js
  // 全選択
  const handleSelectAll=useCallback(()=>{
    if(tab==='object'){
      const ids=new Set((activeModel.objects||[]).map(e=>e.id));
      if(ids.size===0)return;
      setObjSelId(null);
      // ObjectViewのmultiSelはObjectView内部stateなので、window経由で更新
      window.__edSetMultiSel?.(ids);
      return;
    }
    if(tab==='pane'){
      const ids=new Set((activeModel.views||[]).map(v=>v.id));
      if(ids.size===0)return;
      window.__edSetMultiSel?.(ids);
      return;
    }
  },[tab,activeModel]);
```

注意: Object/MapViewの `multiSel` はView内部のstateなので、Appから直接設定できない。`window.__edSetMultiSel` をView側で登録する仕組みが必要。

- [ ] **Step 3: ObjectView内で `__edSetMultiSel` を登録**

ObjectView内（`useCanvas` の後あたり）に追加:

```js
  useEffect(()=>{
    window.__edSetMultiSel=ids=>{setMultiSel(ids);multiOffsets.current={};};
    return()=>{window.__edSetMultiSel=null;};
  },[]);
```

- [ ] **Step 4: MapView内でも同様に登録**

MapView内に追加:

```js
  useEffect(()=>{
    window.__edSetMultiSel=ids=>{setMultiSel(ids);multiOffsets.current={};setSelId(null);setSelNavId(null);setEditLabel(false);};
    return()=>{window.__edSetMultiSel=null;};
  },[]);
```

- [ ] **Step 5: グローバル関数登録に handleSelectAll を追加**

L698付近:

修正前:
```js
    window.__edUndo=handleUndo;window.__edRedo=handleRedo;
    window.__edCopy=handleCopy;window.__edPaste=handlePaste;
    window.__edCut=handleCut;window.__edDelete=handleDelete;
    return()=>{window.__edUndo=window.__edRedo=window.__edCopy=window.__edPaste=window.__edCut=window.__edDelete=null;};
  },[handleUndo,handleRedo,handleCopy,handlePaste,handleCut,handleDelete]);
```

修正後:
```js
    window.__edUndo=handleUndo;window.__edRedo=handleRedo;
    window.__edCopy=handleCopy;window.__edPaste=handlePaste;
    window.__edCut=handleCut;window.__edDelete=handleDelete;
    window.__edSelectAll=handleSelectAll;
    return()=>{window.__edUndo=window.__edRedo=window.__edCopy=window.__edPaste=window.__edCut=window.__edDelete=window.__edSelectAll=null;};
  },[handleUndo,handleRedo,handleCopy,handlePaste,handleCut,handleDelete,handleSelectAll]);
```

- [ ] **Step 6: 手動テスト**

1. Objectタブで Cmd+A → 全オブジェクトが選択される
2. Paneタブで Cmd+A → 全ペインが選択される
3. Screenタブで Cmd+A → 何も起きない
4. input内でCmd+A → ブラウザのテキスト全選択が動作する

- [ ] **Step 7: コミット**

```bash
git add editors/editor.html
git commit -m "feat: Cmd+A全選択を追加"
```

---

### Task 3: editor.html — handleDuplicateItem（Cmd+D）

**Files:**
- Modify: `editors/editor.html`

- [ ] **Step 1: App内に handleDuplicateItem を追加**

App内、`handleSelectAll` の後に追加:

```js
  // 複製（Cmd+D）
  const handleDuplicateItem=useCallback(()=>{
    if(tab==='object'){
      if(!objSelId)return false;
      // 既存のペーストロジックと同じパターン
      const ent=(activeModel.objects||[]).find(e=>e.id===objSelId);
      if(!ent)return false;
      const newId=uid();
      effectiveSetModel(m=>{const names=m.objects.map(e=>e.name);return{...m,objects:[...m.objects,{...JSON.parse(JSON.stringify(ent)),id:newId,name:uniqueName(ent.name,names),x:(ent.x||0)+20,y:(ent.y||0)+20,relations:ent.relations.map(r=>({...r,id:uid()}))}]};});
      setObjSelId(newId);
      showToast('Duplicated: '+ent.name);
      return true;
    }
    if(tab==='pane'){
      const{vwId}=mapSelRef.current;
      if(!vwId)return false;
      const vw=(activeModel.views||[]).find(s=>s.id===vwId);
      if(!vw)return false;
      const newId=uid();
      effectiveSetModel(m=>({...m,views:[...m.views,{...JSON.parse(JSON.stringify(vw)),id:newId,x:(vw.x||0)+20,y:(vw.y||0)+20}]}));
      showToast('Duplicated');
      return true;
    }
    if(tab==='screen'){
      const scId=scrSelRef.current;
      if(!scId)return false;
      const sc=(activeModel.screens||[]).find(s=>s.id===scId);
      if(!sc)return false;
      const newId=uid();
      effectiveSetModel(m=>({...m,screens:[...(m.screens||[]),{...JSON.parse(JSON.stringify(sc)),id:newId,x:(sc.x||0)+20,y:(sc.y||0)+20}]}));
      showToast('Duplicated: '+sc.name);
      return true;
    }
    return false;
  },[tab,objSelId,activeModel,effectiveSetModel]);
```

- [ ] **Step 2: グローバル関数登録に追加**

```js
    window.__edDuplicateItem=handleDuplicateItem;
```

cleanupにも追加:
```js
    window.__edDuplicateItem=null;
```

依存配列にも追加:
```js
  },[handleUndo,handleRedo,handleCopy,handlePaste,handleCut,handleDelete,handleSelectAll,handleDuplicateItem]);
```

- [ ] **Step 3: 手動テスト**

1. Objectタブでオブジェクト選択 → Cmd+D → 複製される（+20, +20オフセット）
2. Paneタブでペイン選択 → Cmd+D → 複製される
3. Screenタブでスクリーン選択 → Cmd+D → 複製される
4. 何も選択していない → Cmd+D → 何も起きない

- [ ] **Step 4: コミット**

```bash
git add editors/editor.html
git commit -m "feat: Cmd+D複製を追加"
```

---

### Task 4: editor.html — handleMoveSelection（矢印キー）

**Files:**
- Modify: `editors/editor.html`

- [ ] **Step 1: App内に handleMoveSelection を追加**

App内、`handleDuplicateItem` の後に追加:

```js
  // 矢印キー移動
  const handleMoveSelection=useCallback(({dx,dy})=>{
    if(tab==='object'){
      if(objSelId){
        effectiveSetModel(m=>({...m,objects:m.objects.map(e=>e.id===objSelId?{...e,x:(e.x||0)+dx,y:(e.y||0)+dy}:e)}));
        return true;
      }
      return false;
    }
    if(tab==='pane'){
      const{vwId}=mapSelRef.current;
      if(vwId){
        effectiveSetModel(m=>({...m,views:m.views.map(v=>v.id===vwId?{...v,x:(v.x||0)+dx,y:(v.y||0)+dy}:v)}));
        return true;
      }
      return false;
    }
    if(tab==='screen'){
      const scId=scrSelRef.current;
      if(scId){
        effectiveSetModel(m=>({...m,screens:(m.screens||[]).map(s=>s.id===scId?{...s,x:(s.x||0)+dx,y:(s.y||0)+dy}:s)}));
        return true;
      }
      return false;
    }
    return false;
  },[tab,objSelId,effectiveSetModel]);
```

注意: multiSel対応も必要。ObjectView/MapViewでmultiSelがある場合は全選択アイテムを移動。`window.__edGetMultiSel` を追加。

- [ ] **Step 2: multiSel対応を追加**

handleMoveSelectionのobjectブロックを修正:

```js
    if(tab==='object'){
      const multi=window.__edGetMultiSel?.();
      if(multi&&multi.size>0){
        effectiveSetModel(m=>({...m,objects:m.objects.map(e=>multi.has(e.id)?{...e,x:(e.x||0)+dx,y:(e.y||0)+dy}:e)}));
        return true;
      }
      if(objSelId){
        effectiveSetModel(m=>({...m,objects:m.objects.map(e=>e.id===objSelId?{...e,x:(e.x||0)+dx,y:(e.y||0)+dy}:e)}));
        return true;
      }
      return false;
    }
    if(tab==='pane'){
      const multi=window.__edGetMultiSel?.();
      if(multi&&multi.size>0){
        effectiveSetModel(m=>({...m,views:m.views.map(v=>multi.has(v.id)?{...v,x:(v.x||0)+dx,y:(v.y||0)+dy}:v)}));
        return true;
      }
      const{vwId}=mapSelRef.current;
      if(vwId){
        effectiveSetModel(m=>({...m,views:m.views.map(v=>v.id===vwId?{...v,x:(v.x||0)+dx,y:(v.y||0)+dy}:v)}));
        return true;
      }
      return false;
    }
```

- [ ] **Step 3: ObjectView/MapViewで `__edGetMultiSel` を登録**

ObjectView内の `__edSetMultiSel` 登録と同じuseEffectに追加:

```js
  useEffect(()=>{
    window.__edSetMultiSel=ids=>{setMultiSel(ids);multiOffsets.current={};};
    window.__edGetMultiSel=()=>multiSel;
    return()=>{window.__edSetMultiSel=null;window.__edGetMultiSel=null;};
  },[multiSel]);
```

MapView も同様（deps に `multiSel` を追加）。

- [ ] **Step 4: グローバル関数登録に追加**

```js
    window.__edMoveSelection=handleMoveSelection;
```

cleanupと依存配列も更新。

- [ ] **Step 5: 手動テスト**

1. オブジェクト選択 → 矢印キーで1px移動
2. Shift+矢印で10px移動
3. 複数選択 → 矢印キーで全選択アイテムが同時移動
4. input内では矢印キーでカーソルが通常動作

- [ ] **Step 6: コミット**

```bash
git add editors/editor.html
git commit -m "feat: 矢印キーで選択アイテムを移動（Shift+矢印で10px）"
```

---

### Task 5: useCanvas — Space+ドラッグ（ハンドツール）

**Files:**
- Modify: `editors/lib/ui-components.js` (useCanvas関数)

- [ ] **Step 1: useCanvas に spaceHeld state とキーリスナーを追加**

`useCanvas` 関数内、Escape useEffectの後（L170付近）に追加:

```js
    // Space+ドラッグ（ハンドツール）
    var spaceHeldState = useState(false), spaceHeld = spaceHeldState[0], setSpaceHeld = spaceHeldState[1];

    useEffect(function() {
      function onDown(e) {
        if (e.key === ' ' && !e.target.closest('input,textarea,select,[contenteditable]')) {
          e.preventDefault();
          setSpaceHeld(true);
        }
      }
      function onUp(e) {
        if (e.key === ' ') {
          setSpaceHeld(false);
        }
      }
      // タブ切替やフォーカス喪失時にspaceHeldをリセット
      function onBlur() { setSpaceHeld(false); }
      window.addEventListener('keydown', onDown);
      window.addEventListener('keyup', onUp);
      window.addEventListener('blur', onBlur);
      return function() {
        window.removeEventListener('keydown', onDown);
        window.removeEventListener('keyup', onUp);
        window.removeEventListener('blur', onBlur);
      };
    }, []);
```

- [ ] **Step 2: onMouseMove を Space+パン対応に拡張**

現在の `onMouseMove` はパン中のみ処理する。Space押下中のパン開始をサポートするため、`onBgMouseDown` を修正不要（各Viewの mousedown で `spaceHeld` をチェックして `canvas.onBgMouseDown` を呼ぶ）。

ただし `onMouseMove` の依存配列に変更なし（パン中の処理は既存のまま）。

- [ ] **Step 3: 返り値に spaceHeld を追加**

```js
    return {
      svgRef: svgRef, zoom: zoom, setZoom: setZoom, pan: pan, setPan: setPan,
      panning: panning, spaceHeld: spaceHeld, onWheel: onWheel, onBgMouseDown: onBgMouseDown,
      onMouseMove: onMouseMove, onMouseUpOrLeave: onMouseUpOrLeave
    };
```

- [ ] **Step 4: テスト実行**

Run: `npx vitest run`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add editors/lib/ui-components.js
git commit -m "feat: useCanvasにSpace+ドラッグのハンドツール機能を追加"
```

---

### Task 6: editor.html — 各ViewにSpace+ドラッグを統合

**Files:**
- Modify: `editors/editor.html`

- [ ] **Step 1: ObjectView — canvasからspaceHeldを取得、mousedownとカーソルに反映**

ObjectViewの canvas destructure を修正:

修正前:
```js
  const{svgRef,zoom,setZoom,pan,setPan,panning}=canvas;
```

修正後:
```js
  const{svgRef,zoom,setZoom,pan,setPan,panning,spaceHeld}=canvas;
```

ObjectViewのSVGの `onMouseMove` ハンドラ（`onMM`）の先頭にSpace+パン処理を追加:

```js
  const onMM=useCallback(e=>{
    // Space+ドラッグ中はパン処理のみ
    if(canvas.onMouseMove(e))return;
    if(connDrag){...
```

ただし既存のonMMでは `canvas.onMouseMove(e)` が末尾にある。Space押下中のパンはドラッグ操作より優先すべきなので、先頭に移動する:

修正前:
```js
  const onMM=useCallback(e=>{if(connDrag){...}if(relDrag){...}if(drag){...return;}canvas.onMouseMove(e);},[...]);
```

修正後:
```js
  const onMM=useCallback(e=>{if(spaceHeld&&canvas.onMouseMove(e))return;if(connDrag){...}if(relDrag){...}if(drag){...return;}canvas.onMouseMove(e);},[...]);
```

依存配列に `spaceHeld` を追加。

次に、SVGの各要素の `onMouseDown` で、`spaceHeld` 時はパン開始に切り替え:

SVG要素の onMouseDown を修正。ObjectViewのSVG:

修正前:
```jsx
<rect ... onMouseDown={e=>{if(conn!==null)return;canvas.onBgMouseDown(e);}}/>
```

修正後:
```jsx
<rect ... onMouseDown={e=>{if(spaceHeld){canvas.onBgMouseDown(e);return;}if(conn!==null)return;canvas.onBgMouseDown(e);}}/>
```

ボックスのonMouseDownの先頭にも追加:

```js
  const onBoxMD=(e,id)=>{if(spaceHeld){canvas.onBgMouseDown(e);return;}e.stopPropagation();...
```

カーソルスタイル修正:

修正前:
```jsx
style={{cursor:connDrag?"grabbing":relDrag?"grabbing":drag?"grabbing":panning?"grabbing":connOn?"crosshair":"grab",...}}
```

修正後:
```jsx
style={{cursor:spaceHeld?(panning?"grabbing":"grab"):connDrag?"grabbing":relDrag?"grabbing":drag?"grabbing":panning?"grabbing":connOn?"crosshair":"grab",...}}
```

`onUp` にも spaceHeld でのパン終了を追加:

修正前の onUp 末尾:
```js
  if(drag)setModel(m=>m);setDrag(null);canvas.onMouseUpOrLeave();
```

修正後:
```js
  if(spaceHeld){canvas.onMouseUpOrLeave();return;}if(drag)setModel(m=>m);setDrag(null);canvas.onMouseUpOrLeave();
```

- [ ] **Step 2: MapView — 同様のSpace+ドラッグ対応**

MapViewでも同じパターンで修正:
- destructureに `spaceHeld` 追加
- `onMM` の先頭に `if(spaceHeld&&canvas.onMouseMove(e))return;` 追加、依存配列に `spaceHeld` 追加
- `onBoxMD` の先頭に `if(spaceHeld){canvas.onBgMouseDown(e);return;}` 追加
- 背景rectの `onMouseDown` に `spaceHeld` チェック追加
- カーソルスタイルに `spaceHeld` 追加
- `onUp` に `if(spaceHeld){canvas.onMouseUpOrLeave();return;}` 追加

- [ ] **Step 3: ScreenView — 同様のSpace+ドラッグ対応**

ScreenViewでも同じパターン:
- destructureに `spaceHeld` 追加
- `onMM` の先頭に `if(spaceHeld&&canvas.onMouseMove(e))return;` 追加
- `onBoxMD` の先頭に `if(spaceHeld){canvas.onBgMouseDown(e);return;}` 追加
- カーソルスタイルに `spaceHeld` 追加
- `onUp` に `if(spaceHeld){canvas.onMouseUpOrLeave();return;}` 追加

- [ ] **Step 4: 手動テスト**

1. Spaceキーを押しながらドラッグ → パン操作
2. Space離す → 通常操作に戻る
3. Connectモード中にSpace+ドラッグ → パン操作、Space離すとConnectモード継続
4. ノード上でSpace+ドラッグ → ノード移動ではなくパン操作

- [ ] **Step 5: コミット**

```bash
git add editors/editor.html
git commit -m "feat: Space+ドラッグでハンドツール（パン）を全タブに追加"
```

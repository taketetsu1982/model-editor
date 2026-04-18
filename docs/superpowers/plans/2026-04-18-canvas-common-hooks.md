# Canvas共通操作の抽出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ObjectView/MapView/ScreenViewで重複しているキャンバス操作を`useCanvas`フックと`ZoomControls`コンポーネントに抽出する

**Architecture:** `editors/lib/ui-components.js`に`useCanvas`カスタムフック（zoom/pan/wheel/Escape/viewState管理）と`ZoomControls`コンポーネント（ズームボタン群）を追加。各Viewから重複コードを削除し、`useCanvas`の返り値を使う形に置き換える。

**Tech Stack:** React 18（CDN）、Babel（JSXトランスパイル）、Vitest（テスト）

**参照Spec:** `docs/superpowers/specs/2026-04-18-canvas-common-hooks-design.md`

---

## ファイル構成

| ファイル | 役割 | 変更種別 |
|----------|------|---------|
| `editors/lib/ui-components.js` | `useCanvas` フック、`ZoomControls` コンポーネント追加 | 修正 |
| `editors/editor.html` | ObjectView/MapView/ScreenViewの共通コード削除・置き換え、App側の修正 | 修正 |

---

### Task 1: `useCanvas` フックの実装

**Files:**
- Modify: `editors/lib/ui-components.js`

- [ ] **Step 1: `useCanvas` フックを `useHistory` の後、`VariantBar` の前に追加**

以下のコードを `editors/lib/ui-components.js` の `useHistory` 関数の閉じ括弧の後（`VariantBar` の前）に追加する:

```js
  // キャンバス共通操作フック
  // zoom/pan/wheel/パン操作/Escape/viewState保存を統合
  function useCanvas(config) {
    var items = config.items, itemW = config.itemW, itemH = config.itemH;
    var savedViewState = config.savedViewState, onViewStateChange = config.onViewStateChange;
    var onEscape = config.onEscape;

    var initPan = useInitialPan(items, itemW, itemH, lib.loadGenRef || {current:0});
    var svgRef = initPan.svgRef, pan = initPan.pan, setPan = initPan.setPan;

    var panningState = useState(false), panning = panningState[0], setPanning = panningState[1];
    var zoomState = useState(savedViewState && savedViewState.zoom ? savedViewState.zoom : 1);
    var zoom = zoomState[0], setZoom = zoomState[1];

    var panStart = useRef({x:0, y:0, px:0, py:0});
    var zoomRef = useRef(savedViewState && savedViewState.zoom ? savedViewState.zoom : 1);
    var panRef = useRef(savedViewState && savedViewState.pan ? savedViewState.pan : {x:0, y:0});

    // zoom/panをrefに同期
    useEffect(function() { zoomRef.current = zoom; }, [zoom]);
    useEffect(function() { panRef.current = pan; }, [pan]);

    // 保存されたpanがあれば復元
    useEffect(function() {
      if (savedViewState && savedViewState.pan) setPan(savedViewState.pan);
    }, []);

    // アンマウント時にzoom/panを保存
    useEffect(function() {
      return function() {
        if (onViewStateChange) onViewStateChange({zoom: zoomRef.current, pan: panRef.current});
      };
    }, []);

    // Escapeキーリスナー
    useEffect(function() {
      if (!onEscape) return;
      var handler = function(e) {
        if (e.key === 'Escape') onEscape();
      };
      window.addEventListener('keydown', handler);
      return function() { window.removeEventListener('keydown', handler); };
    }, [onEscape]);

    // Wheelハンドラ（Ctrl+Wheelでズーム、通常Wheelでパン）
    var onWheel = useCallback(function(e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        var r = svgRef.current.getBoundingClientRect();
        var mx = e.clientX - r.left, my = e.clientY - r.top;
        var d = e.deltaY > 0 ? 0.92 : 1.08;
        setZoom(function(z) {
          var nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * d));
          var wx = mx / z + pan.x, wy = my / z + pan.y;
          setPan({x: wx - mx / nz, y: wy - my / nz});
          return nz;
        });
      } else {
        setPan(function(p) { return {x: p.x + e.deltaX / zoom, y: p.y + e.deltaY / zoom}; });
      }
    }, [zoom, pan]);

    // 背景mousedown（パン開始）
    var onBgMouseDown = useCallback(function(e) {
      setPanning(true);
      panStart.current = {x: e.clientX, y: e.clientY, px: pan.x, py: pan.y};
    }, [pan]);

    // mousemove内で呼ぶ。パン中ならtrueを返す
    var onMouseMove = useCallback(function(e) {
      if (!panning) return false;
      setPan({
        x: panStart.current.px - (e.clientX - panStart.current.x) / zoom,
        y: panStart.current.py - (e.clientY - panStart.current.y) / zoom
      });
      return true;
    }, [panning, zoom]);

    // mouseup/mouseleave内で呼ぶ
    var onMouseUpOrLeave = useCallback(function() {
      setPanning(false);
    }, []);

    return {
      svgRef: svgRef, zoom: zoom, setZoom: setZoom, pan: pan, setPan: setPan,
      panning: panning, onWheel: onWheel, onBgMouseDown: onBgMouseDown,
      onMouseMove: onMouseMove, onMouseUpOrLeave: onMouseUpOrLeave
    };
  }
```

- [ ] **Step 2: `useCanvas` をエクスポートに追加**

`exports.useHistory = useHistory;` の後に追加:

```js
  exports.useCanvas = useCanvas;
```

- [ ] **Step 3: `loadGenRef` をlib経由で参照可能にする**

`useCanvas` 内で `loadGenRef` を使っている。これは `editor.html` のグローバル変数。`useInitialPan` が第4引数として受け取る形式なので、`useCanvas` のconfigにも追加する。

`useCanvas` の先頭を修正:

```js
  function useCanvas(config) {
    var items = config.items, itemW = config.itemW, itemH = config.itemH;
    var savedViewState = config.savedViewState, onViewStateChange = config.onViewStateChange;
    var onEscape = config.onEscape, loadGenRef = config.loadGenRef;

    var initPan = useInitialPan(items, itemW, itemH, loadGenRef);
```

- [ ] **Step 4: テスト実行で既存テストが壊れていないことを確認**

Run: `npx vitest run`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add editors/lib/ui-components.js
git commit -m "feat: useCanvasフックを追加（zoom/pan/wheel/Escape/viewState管理を統合）"
```

---

### Task 2: `ZoomControls` コンポーネントの実装

**Files:**
- Modify: `editors/lib/ui-components.js`

- [ ] **Step 1: `ZoomControls` コンポーネントを `useCanvas` の後、`VariantBar` の前に追加**

```js
  // ズームボタン群コンポーネント
  // props: { svgRef, zoom, setZoom, pan, setPan }
  function ZoomControls(props) {
    var svgRef = props.svgRef, zoom = props.zoom, setZoom = props.setZoom, pan = props.pan, setPan = props.setPan;

    function zoomBy(factor) {
      var r = svgRef.current && svgRef.current.getBoundingClientRect();
      if (!r) return;
      var cx = r.width / 2, cy = r.height / 2;
      setZoom(function(z) {
        var nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor));
        var wx = cx / z + pan.x, wy = cy / z + pan.y;
        setPan({x: wx - cx / nz, y: wy - cy / nz});
        return nz;
      });
    }

    function resetZoom() {
      var r = svgRef.current && svgRef.current.getBoundingClientRect();
      if (!r) return;
      var cx = r.width / 2, cy = r.height / 2;
      setZoom(function(z) {
        var wx = cx / z + pan.x, wy = cy / z + pan.y;
        setPan({x: wx - cx, y: wy - cy});
        return 1;
      });
    }

    var btnStyle = {width:28, height:28, border:"none", background:"transparent", cursor:"pointer", fontSize:16, color:"#5F6368", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center"};
    var pctStyle = {minWidth:48, height:28, border:"none", background:"transparent", cursor:"pointer", fontSize:12, fontWeight:500, color:"#5F6368", borderRadius:14, fontFamily:"inherit"};
    var hover = function(e) { e.target.style.background = "#F5F5F5"; };
    var unhover = function(e) { e.target.style.background = "transparent"; };

    return h("div", {style:{position:"absolute", bottom:16, right:16, display:"flex", alignItems:"center", gap:4, background:"white", borderRadius:"var(--md-sys-shape-full)", padding:"4px 8px", boxShadow:"var(--md-sys-elevation-1)"}},
      h("button", {onClick: function() { zoomBy(0.8); }, style: btnStyle, onMouseEnter: hover, onMouseLeave: unhover}, "\u2212"),
      h("button", {onClick: resetZoom, style: pctStyle, onMouseEnter: hover, onMouseLeave: unhover}, Math.round(zoom * 100) + "%"),
      h("button", {onClick: function() { zoomBy(1.25); }, style: btnStyle, onMouseEnter: hover, onMouseLeave: unhover}, "+")
    );
  }
```

- [ ] **Step 2: `ZoomControls` をエクスポートに追加**

```js
  exports.ZoomControls = ZoomControls;
```

- [ ] **Step 3: テスト実行**

Run: `npx vitest run`
Expected: 全テストPASS

- [ ] **Step 4: コミット**

```bash
git add editors/lib/ui-components.js
git commit -m "feat: ZoomControlsコンポーネントを追加（ズームボタン群を共通化）"
```

---

### Task 3: ObjectView を `useCanvas` + `ZoomControls` に置き換え

**Files:**
- Modify: `editors/editor.html`

- [ ] **Step 1: インポートに `useCanvas` と `ZoomControls` を追加**

L107付近:

修正前:
```js
const{M3,Input,Sel,Btn,SLabel,useInitialPan,useHistory,VariantBar}=window.__editorUI;
```

修正後:
```js
const{M3,Input,Sel,Btn,SLabel,useInitialPan,useHistory,useCanvas,ZoomControls,VariantBar}=window.__editorUI;
```

- [ ] **Step 2: ObjectView の共通コードを `useCanvas` に置き換え**

ObjectView内（L142-167付近）の以下を削除:

```js
  const{svgRef,pan,setPan}=useInitialPan(model.objects,EW,EH,loadGenRef);
  const[panning,setPanning]=useState(false);
  const[zoom,setZoom]=useState(savedViewState?.zoom||1);
  useEffect(()=>{if(savedViewState?.pan)setPan(savedViewState.pan);},[]);
  useEffect(()=>()=>{if(onViewStateChange)onViewStateChange({zoom:zoomRef.current,pan:panRef.current});},[]);
  const zoomRef=useRef(savedViewState?.zoom||1),panRef=useRef(savedViewState?.pan||{x:0,y:0});
  useEffect(()=>{zoomRef.current=zoom;},[zoom]);
  useEffect(()=>{panRef.current=pan;},[pan]);
```

および:

```js
  useEffect(()=>{const onKey=e=>{if(e.key==='Escape'){setMultiSel(new Set());multiOffsets.current={};setConnDrag(null);}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[]);
```

および:

```js
  const onBgMD=e=>{if(conn!==null)return;setPanning(true);panStart.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};};
```

および `onWheel` の定義全体を削除。

代わりに以下を追加:

```js
  const canvas=useCanvas({items:model.objects,itemW:EW,itemH:EH,savedViewState,onViewStateChange,loadGenRef,onEscape:useCallback(()=>{setMultiSel(new Set());multiOffsets.current={};setConnDrag(null);},[])});
  const{svgRef,zoom,setZoom,pan,setPan,panning}=canvas;
```

- [ ] **Step 3: `onMM` 内のパン処理を `canvas.onMouseMove` に置き換え**

ObjectViewの `onMM`（L165付近）の末尾にある:

```js
if(panning){setPan({x:panStart.current.px-(e.clientX-panStart.current.x)/zoom,y:panStart.current.py-(e.clientY-panStart.current.y)/zoom});}
```

を以下に置き換え:

```js
canvas.onMouseMove(e);
```

- [ ] **Step 4: `onUp` 内のパン終了を `canvas.onMouseUpOrLeave` に置き換え**

ObjectViewの `onUp`（L166付近）の末尾にある:

```js
setPanning(false);
```

を以下に置き換え:

```js
canvas.onMouseUpOrLeave();
```

- [ ] **Step 5: `onBgMD` を `canvas.onBgMouseDown` に置き換え**

SVGの `onMouseDown={onBgMD}` の `<rect>` 要素で、パン開始前にconnチェックが必要。ObjectViewでは `conn !== null` の時にパン開始をスキップする。

SVGの背景rectの `onMouseDown` を修正:

```jsx
onMouseDown={e=>{if(conn!==null)return;canvas.onBgMouseDown(e);}}
```

- [ ] **Step 6: `onWheel` を `canvas.onWheel` に置き換え**

SVGの `onWheel={onWheel}` を `onWheel={canvas.onWheel}` に変更。

- [ ] **Step 7: ズームボタン群を `ZoomControls` に置き換え**

ObjectView内の3つのzoomボタン（L197-201の `<div style={{position:"absolute",bottom:16,right:16,...}}>` ブロック全体）を以下に置き換え:

```jsx
<ZoomControls svgRef={svgRef} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan}/>
```

- [ ] **Step 8: `panStart` refの宣言を整理**

`useCanvas` が `panStart` を内部で持つため、ObjectViewの `panStart` ref宣言を削除。ただし `dOff` と `multiOffsets` はView固有なので残す:

修正前:
```js
  const dOff=useRef({x:0,y:0}),panStart=useRef({x:0,y:0,px:0,py:0}),multiOffsets=useRef({});
```

修正後:
```js
  const dOff=useRef({x:0,y:0}),multiOffsets=useRef({});
```

- [ ] **Step 9: 手動テスト — ブラウザでObjectタブの操作確認**

1. ドラッグでパン
2. Ctrl+Wheelでズーム
3. ズームボタン（+/-/reset）
4. Escapeで選択解除
5. タブ切替でzoom/panが復元される

- [ ] **Step 10: コミット**

```bash
git add editors/editor.html
git commit -m "refactor: ObjectViewのキャンバス操作をuseCanvas+ZoomControlsに置き換え"
```

---

### Task 4: MapView を `useCanvas` + `ZoomControls` に置き換え

**Files:**
- Modify: `editors/editor.html`

- [ ] **Step 1: MapViewの共通コードを `useCanvas` に置き換え**

MapView内（L209-237付近）から以下を削除:

```js
  const{svgRef,pan,setPan}=useInitialPan(model.views,SW,SH,loadGenRef);
  const[panning,setPanning]=useState(false),[zoom,setZoom]=useState(savedViewState?.zoom||1);
  useEffect(()=>{if(savedViewState?.pan)setPan(savedViewState.pan);},[]);
  useEffect(()=>()=>{if(onViewStateChange)onViewStateChange({zoom:zoomRef.current,pan:panRef.current});},[]);
  const zoomRef=useRef(savedViewState?.zoom||1),panRef=useRef(savedViewState?.pan||{x:0,y:0});
  useEffect(()=>{zoomRef.current=zoom;},[zoom]);
  useEffect(()=>{panRef.current=pan;},[pan]);
```

および Escape useEffect、`onBgMD`、`onWheel` を削除。

代わりに追加:

```js
  const canvas=useCanvas({items:model.views,itemW:SW,itemH:SH,savedViewState,onViewStateChange,loadGenRef,onEscape:useCallback(()=>{setMultiSel(new Set());multiOffsets.current={};setConnDrag(null);},[])});
  const{svgRef,zoom,setZoom,pan,setPan,panning}=canvas;
```

- [ ] **Step 2: `onMM` の末尾パン処理を `canvas.onMouseMove(e)` に置き換え**

- [ ] **Step 3: `onUp` の末尾 `setPanning(false)` を `canvas.onMouseUpOrLeave()` に置き換え**

- [ ] **Step 4: SVG背景rectの `onMouseDown` を修正**

```jsx
onMouseDown={e=>{if(connOn)return;canvas.onBgMouseDown(e);}}
```

- [ ] **Step 5: SVGの `onWheel={onWheel}` を `onWheel={canvas.onWheel}` に**

- [ ] **Step 6: ズームボタン群を `<ZoomControls .../>` に置き換え**

- [ ] **Step 7: `panStart` ref宣言を削除**

修正前:
```js
  const dOff=useRef({x:0,y:0}),panStart=useRef({x:0,y:0,px:0,py:0}),didDrag=useRef(false),multiOffsets=useRef({});
```

修正後:
```js
  const dOff=useRef({x:0,y:0}),didDrag=useRef(false),multiOffsets=useRef({});
```

- [ ] **Step 8: 手動テスト — ブラウザでPaneタブの操作確認**

- [ ] **Step 9: コミット**

```bash
git add editors/editor.html
git commit -m "refactor: MapViewのキャンバス操作をuseCanvas+ZoomControlsに置き換え"
```

---

### Task 5: ScreenView を `useCanvas` + `ZoomControls` に置き換え + App修正

**Files:**
- Modify: `editors/editor.html`

- [ ] **Step 1: ScreenViewのpropsに `savedViewState` / `onViewStateChange` を追加**

修正前:
```js
function ScreenView({model,setModel,setModelSilent,onSelChange,onSplit}){
```

修正後:
```js
function ScreenView({model,setModel,setModelSilent,onSelChange,onSplit,savedViewState,onViewStateChange}){
```

- [ ] **Step 2: ScreenViewの共通コードを `useCanvas` に置き換え**

以下を削除:

```js
  const{svgRef,pan,setPan}=useInitialPan((model.screens||[]).filter(s=>(s.device||devices[0])===deviceTab),SCR_MIN_W,100,loadGenRef);
  const[panning,setPanning]=useState(false);
  const[zoom,setZoom]=useState(1);
  const dOff=useRef({x:0,y:0}),panStart=useRef({x:0,y:0,px:0,py:0});
```

および `onBgMD`、`onWheel` を削除。

代わりに追加:

```js
  const canvas=useCanvas({items:(model.screens||[]).filter(s=>(s.device||devices[0])===deviceTab),itemW:SCR_MIN_W,itemH:100,savedViewState,onViewStateChange,loadGenRef,onEscape:useCallback(()=>{setSelId(null);},[])});
  const{svgRef,zoom,setZoom,pan,setPan,panning}=canvas;
  const dOff=useRef({x:0,y:0});
```

- [ ] **Step 3: `onMM` の末尾パン処理を `canvas.onMouseMove(e)` に置き換え**

- [ ] **Step 4: `onUp` の末尾 `setPanning(false)` を `canvas.onMouseUpOrLeave()` に置き換え**

- [ ] **Step 5: SVG背景rectの `onMouseDown={onBgMD}` を `onMouseDown={canvas.onBgMouseDown}` に**

ScreenViewにはconnチェックがないので直接渡す。

- [ ] **Step 6: SVGの `onWheel={onWheel}` を `onWheel={canvas.onWheel}` に**

- [ ] **Step 7: ズームボタン群を `<ZoomControls .../>` に置き換え**

- [ ] **Step 8: App側の `tabViewState` に `screen` エントリを追加**

修正前:
```js
  const tabViewState=useRef({object:{zoom:null,pan:null},pane:{zoom:null,pan:null}});
```

修正後:
```js
  const tabViewState=useRef({object:{zoom:null,pan:null},pane:{zoom:null,pan:null},screen:{zoom:null,pan:null}});
```

- [ ] **Step 9: App内のScreenView呼び出しに `savedViewState` / `onViewStateChange` を追加**

通常表示とSplit表示の両方の ScreenView に追加:

```jsx
<ScreenView ... savedViewState={tabViewState.current.screen} onViewStateChange={s=>{tabViewState.current.screen=s;}} />
```

- [ ] **Step 10: 手動テスト — ブラウザでScreenタブの操作確認**

1. ドラッグでパン
2. Ctrl+Wheelでズーム
3. ズームボタン（+/-/reset）
4. Escapeで選択解除（新規追加された機能）
5. タブ切替でzoom/panが復元される（新規追加された機能）

- [ ] **Step 11: テスト実行**

Run: `npx vitest run`
Expected: 全テストPASS

- [ ] **Step 12: コミット**

```bash
git add editors/editor.html
git commit -m "refactor: ScreenViewのキャンバス操作をuseCanvas+ZoomControlsに置き換え、viewState保存を追加"
```

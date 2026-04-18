# マーキー選択 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** キャンバス背景ドラッグで矩形範囲選択（マーキー選択）を実装し、パンをSpace+ドラッグに完全移行する

**Architecture:** `useCanvas`に`marquee`state（矩形座標）とマーキー開始/更新/完了ロジックを追加。`onBgMouseDown`をマーキー開始に変更し、`spaceHeld`時のみパンを維持。各Viewでマーキー矩形を描画し、完了時に交差判定でmultiSelを更新。

**Tech Stack:** React 18（CDN）、Babel（JSXトランスパイル）

---

## ファイル構成

| ファイル | 変更内容 |
|----------|---------|
| `editors/lib/ui-components.js` | `useCanvas`: marquee state、onBgMouseDown変更、onMouseMove/onMouseUpOrLeave拡張、config.onMarqueeEnd追加 |
| `editors/editor.html` | 各View: マーキー矩形SVG描画、onMarqueeEnd実装、カーソル変更 |

---

### Task 1: useCanvas にマーキー選択ロジックを追加

**Files:**
- Modify: `editors/lib/ui-components.js`

変更内容:

1. `marquee` state を追加（spaceHeldの後あたり）:
```js
    var marqueeState = useState(null), marquee = marqueeState[0], setMarquee = marqueeState[1];
    var marqueeShift = useRef(false);
    var onMarqueeEnd = config.onMarqueeEnd;
```

2. `onBgMouseDown` を変更 — spaceHeld時はパン、それ以外はマーキー開始:
```js
    var onBgMouseDown = useCallback(function(e) {
      if (spaceHeld) {
        setPanning(true);
        panStart.current = {x: e.clientX, y: e.clientY, px: pan.x, py: pan.y};
      } else {
        if (!svgRef.current) return;
        var r = svgRef.current.getBoundingClientRect();
        var cx = (e.clientX - r.left) / zoom + pan.x;
        var cy = (e.clientY - r.top) / zoom + pan.y;
        setMarquee({x1: cx, y1: cy, x2: cx, y2: cy});
        marqueeShift.current = e.shiftKey;
      }
    }, [pan, zoom, spaceHeld]);
```

3. `onMouseMove` を拡張 — マーキー中なら矩形更新:
```js
    var onMouseMove = useCallback(function(e) {
      if (panning) {
        setPan({
          x: panStart.current.px - (e.clientX - panStart.current.x) / zoom,
          y: panStart.current.py - (e.clientY - panStart.current.y) / zoom
        });
        return true;
      }
      if (marquee) {
        if (!svgRef.current) return true;
        var r = svgRef.current.getBoundingClientRect();
        var cx = (e.clientX - r.left) / zoom + pan.x;
        var cy = (e.clientY - r.top) / zoom + pan.y;
        setMarquee(function(m) { return m ? {x1: m.x1, y1: m.y1, x2: cx, y2: cy} : null; });
        return true;
      }
      return false;
    }, [panning, marquee, zoom, pan]);
```

4. `onMouseUpOrLeave` を拡張 — マーキー完了時にコールバック:
```js
    var onMouseUpOrLeave = useCallback(function(e) {
      if (marquee) {
        var rect = {
          x: Math.min(marquee.x1, marquee.x2),
          y: Math.min(marquee.y1, marquee.y2),
          w: Math.abs(marquee.x2 - marquee.x1),
          h: Math.abs(marquee.y2 - marquee.y1)
        };
        // 十分な大きさがあればマーキー選択として処理
        if (rect.w > 2 || rect.h > 2) {
          if (onMarqueeEnd) onMarqueeEnd(rect, marqueeShift.current);
        }
        setMarquee(null);
        return;
      }
      setPanning(false);
    }, [marquee, onMarqueeEnd]);
```

5. 返り値に `marquee` を追加:
```js
    return {
      svgRef: svgRef, zoom: zoom, setZoom: setZoom, pan: pan, setPan: setPan,
      panning: panning, spaceHeld: spaceHeld, marquee: marquee,
      onWheel: onWheel, onBgMouseDown: onBgMouseDown,
      onMouseMove: onMouseMove, onMouseUpOrLeave: onMouseUpOrLeave
    };
```

---

### Task 2: 各View にマーキー矩形描画 + 交差判定 + カーソル変更

**Files:**
- Modify: `editors/editor.html`

変更内容（3つのView共通パターン）:

1. **canvas destructureにmarqueeを追加**:
```js
const{svgRef,zoom,setZoom,pan,setPan,panning,spaceHeld,marquee}=canvas;
```

2. **useCanvas configにonMarqueeEndを追加**（各View固有の交差判定）:

ObjectView:
```js
const canvas=useCanvas({...,onMarqueeEnd:useCallback((rect,shift)=>{
  const hit=new Set();
  (model.objects||[]).forEach(e=>{
    if(e.x<rect.x+rect.w && e.x+EW>rect.x && e.y<rect.y+rect.h && e.y+EH>rect.y) hit.add(e.id);
  });
  if(hit.size===0)return;
  setMultiSel(shift?prev=>{const next=new Set(prev);hit.forEach(id=>next.add(id));return next;}:hit);
  setSelId(null);setSelRelId(null);multiOffsets.current={};
},[model.objects])});
```

MapView（カード高さが可変なのでfindNodeを使う）:
```js
onMarqueeEnd:useCallback((rect,shift)=>{
  const hit=new Set();
  (model.views||[]).forEach(vw=>{
    const n=findNode(vw.id);
    if(!n)return;
    if(vw.x<rect.x+rect.w && vw.x+SW>rect.x && vw.y<rect.y+rect.h && vw.y+n.h>rect.y) hit.add(vw.id);
  });
  if(hit.size===0)return;
  setMultiSel(shift?prev=>{const next=new Set(prev);hit.forEach(id=>next.add(id));return next;}:hit);
  setSelId(null);setSelNavId(null);setEditLabel(false);multiOffsets.current={};
},[model.views])
```

ScreenView（multiSelがないのでスキップ — マーキーで1つだけ選択）:
```js
onMarqueeEnd:useCallback((rect,shift)=>{
  const items=(model.screens||[]).filter(s=>(s.device||devices[0])===deviceTab);
  for(var i=0;i<items.length;i++){
    const sc=items[i];const{w:cw,h:ch}=scrCardSize(sc,model.views,model.objects);
    if((sc.x||0)<rect.x+rect.w && (sc.x||0)+cw>rect.x && (sc.y||0)<rect.y+rect.h && (sc.y||0)+ch>rect.y){setSelId(sc.id);return;}
  }
},[model.screens,model.views,model.objects,deviceTab])
```

3. **SVG上にマーキー矩形を描画**（`</g>`閉じタグの後、`</svg>`の前に追加）:

```jsx
{marquee&&<rect x={marquee.x1<marquee.x2?marquee.x1:marquee.x2} y={marquee.y1<marquee.y2?marquee.y1:marquee.y2} width={Math.abs(marquee.x2-marquee.x1)} height={Math.abs(marquee.y2-marquee.y1)} fill="rgba(26,115,232,0.08)" stroke="#1A73E8" strokeWidth={1/zoom} strokeDasharray={`${4/zoom} ${2/zoom}`} pointerEvents="none" transform={`scale(${zoom}) translate(${-pan.x},${-pan.y})`}/>}
```

注意: マーキー矩形はキャンバス座標系なのでtransformが必要。ただし他のノードと同じ`<g>`の中に入れるか、別途transformを指定する。別途指定の方がシンプル（gの外で独立描画）。

実際にはgの外でscale+translateを個別に指定:
```jsx
{marquee&&<rect x={(Math.min(marquee.x1,marquee.x2)-pan.x)*zoom} y={(Math.min(marquee.y1,marquee.y2)-pan.y)*zoom} width={Math.abs(marquee.x2-marquee.x1)*zoom} height={Math.abs(marquee.y2-marquee.y1)*zoom} fill="rgba(26,115,232,0.08)" stroke="#1A73E8" strokeWidth={1} strokeDasharray="4 2" pointerEvents="none"/>}
```

こちらの方がシンプル（スクリーン座標に変換して描画）。

4. **カーソル変更**: デフォルトを `grab` → `default` に。

ObjectView SVG:
```
cursor:spaceHeld?(panning?"grabbing":"grab"):marquee?"crosshair":connDrag?"grabbing":...中略...:connOn?"crosshair":"default"
```

MapView/ScreenView も同様にデフォルトを `default` に。

5. **背景rectのonMouseDown**: ConnectモードチェックとspaceHeldチェックの位置を調整。

ObjectView背景rect:
```jsx
onMouseDown={e=>{if(conn!==null&&!spaceHeld)return;canvas.onBgMouseDown(e);}}
```
（spaceHeld時はConnectモード中でもパン開始。非spaceHeld時かつconn中はマーキーしない）

MapView:
```jsx
onMouseDown={e=>{if(connOn&&!spaceHeld)return;canvas.onBgMouseDown(e);}}
```

ScreenView: 変更なし（`canvas.onBgMouseDown` をそのまま渡す）。

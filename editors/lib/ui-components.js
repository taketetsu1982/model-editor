// docs/reqs/lib/ui-components.js — 両エディタ共通React UIコンポーネント
// JSXを使わずReact.createElementで定義（file://でのCORS制約回避）
(function(exports) {
  var h = React.createElement;
  var useState = React.useState, useRef = React.useRef, useCallback = React.useCallback, useEffect = React.useEffect;
  var lib = window.__editorLib;
  var ZOOM_MIN = lib.ZOOM_MIN, ZOOM_MAX = lib.ZOOM_MAX, MAX_HISTORY = lib.MAX_HISTORY, calcCenterPan = lib.calcCenterPan;

  // M3 デザイントークン参照
  var M3 = {
    primary:"var(--md-sys-color-primary)",onPrimary:"var(--md-sys-color-on-primary)",primaryContainer:"var(--md-sys-color-primary-container)",onPrimaryContainer:"var(--md-sys-color-on-primary-container)",
    surface:"var(--md-sys-color-surface)",surfaceContLow:"var(--md-sys-color-surface-container-low)",surfaceCont:"var(--md-sys-color-surface-container)",surfaceContHigh:"var(--md-sys-color-surface-container-high)",surfaceContHighest:"var(--md-sys-color-surface-container-highest)",
    onSurface:"var(--md-sys-color-on-surface)",onSurfaceVar:"var(--md-sys-color-on-surface-variant)",
    outline:"var(--md-sys-color-outline)",outlineVar:"var(--md-sys-color-outline-variant)",
    error:"var(--md-sys-color-error)",errorContainer:"var(--md-sys-color-error-container)",onErrorContainer:"var(--md-sys-color-on-error-container)",
    shapeSm:"var(--md-sys-shape-sm)",shapeMd:"var(--md-sys-shape-md)",shapeLg:"var(--md-sys-shape-lg)",shapeFull:"var(--md-sys-shape-full)",
    surfaceDim:"var(--md-sys-color-surface-dim)",shapeXs:"var(--md-sys-shape-xs)",
  };

  // フォーム入力
  function Input(props) {
    var style = props.style, rest = Object.assign({}, props);
    delete rest.style;
    var origFocus = rest.onFocus, origBlur = rest.onBlur;
    return h("input", Object.assign({}, rest, {
      style: Object.assign({border:"1px solid "+M3.outlineVar,borderRadius:M3.shapeSm,background:M3.surface,color:M3.onSurface,fontSize:14,fontWeight:400,lineHeight:"20px",padding:"8px 16px",outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"}, style),
      onFocus: function(e){e.target.style.borderColor="#1A73E8";e.target.style.boxShadow="0 0 0 3px rgba(26,115,232,.12)";if(origFocus)origFocus(e);},
      onBlur: function(e){e.target.style.borderColor="";e.target.style.boxShadow="none";if(origBlur)origBlur(e);}
    }));
  }

  // セレクトボックス
  function Sel(props) {
    var style = props.style, children = props.children, rest = Object.assign({}, props);
    delete rest.style; delete rest.children;
    return h("select", Object.assign({}, rest, {
      style: Object.assign({border:"1px solid "+M3.outlineVar,borderRadius:M3.shapeSm,background:M3.surface,color:M3.onSurface,fontSize:14,fontWeight:400,lineHeight:"20px",padding:"8px 16px",outline:"none",fontFamily:"inherit"}, style)
    }), children);
  }

  // ボタン
  function Btn(props) {
    var bg = props.danger?M3.errorContainer:props.accent?"#1A73E8":props.ghost?"transparent":M3.surfaceCont;
    var fg = props.danger?M3.onErrorContainer:props.accent?M3.onPrimary:props.ghost?"#1A73E8":M3.onSurface;
    var bd = props.ghost?"1px solid "+M3.outlineVar:"none";
    return h("button", {
      onClick: props.onClick,
      style: {background:bg,border:bd,color:fg,borderRadius:M3.shapeFull,padding:props.small?"8px 16px":"8px 24px",fontSize:14,fontWeight:500,lineHeight:"20px",letterSpacing:"0.1px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",transition:"box-shadow .15s, background .15s"},
      onMouseEnter: function(e){e.target.style.boxShadow="var(--md-sys-elevation-1)";},
      onMouseLeave: function(e){e.target.style.boxShadow="none";}
    }, props.children);
  }

  // セクションラベル
  function SLabel(props) {
    return h("div", {style:{fontSize:12,fontWeight:500,lineHeight:"16px",letterSpacing:"0.5px",color:M3.onSurfaceVar,textTransform:"uppercase",marginBottom:8}}, props.children);
  }

  // 初期パン位置計算フック
  function useInitialPan(items, iw, ih, loadGenRef) {
    var svgRef = useRef();
    var panState = useState({x:0,y:0}), pan = panState[0], setPan = panState[1];
    var lastGen = useRef(-1);
    useEffect(function() {
      var gen = loadGenRef.current;
      if (lastGen.current === gen || !items || items.length === 0 || !svgRef.current) return;
      requestAnimationFrame(function() {
        if (!svgRef.current) return;
        var r = svgRef.current.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var c = calcCenterPan(items, iw, ih);
        setPan({x: c.cx - r.width/2, y: c.cy - r.height/2 + 40});
        lastGen.current = gen;
      });
    }, [items, iw, ih]);
    return {svgRef: svgRef, pan: pan, setPan: setPan};
  }

  // 履歴管理フック
  // 各履歴エントリは {data, variantId} 形式でバリアントIDを記録する
  function useHistory(initial, showToast) {
    var dataState = useState(initial), data = dataState[0], setDataRaw = dataState[1];
    var histRef = useRef({stack:[{data: JSON.parse(JSON.stringify(initial)), variantId: null}], idx:0});
    var dirtyRef = useRef(false);

    var setData = useCallback(function(updater, variantId) {
      dirtyRef.current = true;
      setDataRaw(function(prev) {
        var next = typeof updater === 'function' ? updater(prev) : updater;
        var hist = histRef.current;
        hist.stack = hist.stack.slice(0, hist.idx + 1);
        hist.stack.push({data: JSON.parse(JSON.stringify(next)), variantId: variantId || null});
        if (hist.stack.length > MAX_HISTORY) { hist.stack.shift(); } else { hist.idx++; }
        return next;
      });
    }, []);

    var setDataSilent = useCallback(function(updater) {
      setDataRaw(function(prev) { return typeof updater === 'function' ? updater(prev) : updater; });
    }, []);

    var undo = useCallback(function() {
      var hist = histRef.current;
      if (hist.idx <= 0) return null;
      hist.idx--;
      var entry = hist.stack[hist.idx];
      dirtyRef.current = true;
      setDataRaw(JSON.parse(JSON.stringify(entry.data)));
      showToast('Undo');
      return entry.variantId;
    }, [showToast]);

    var redo = useCallback(function() {
      var hist = histRef.current;
      if (hist.idx >= hist.stack.length - 1) return null;
      hist.idx++;
      var entry = hist.stack[hist.idx];
      dirtyRef.current = true;
      setDataRaw(JSON.parse(JSON.stringify(entry.data)));
      showToast('Redo');
      return entry.variantId;
    }, [showToast]);

    var reset = useCallback(function(newData) {
      setDataRaw(newData);
      histRef.current = {stack:[{data: JSON.parse(JSON.stringify(newData)), variantId: null}], idx:0};
    }, []);

    return {data:data, setData:setData, setDataSilent:setDataSilent, undo:undo, redo:redo, reset:reset, histRef:histRef, dirtyRef:dirtyRef};
  }

  // キャンバス共通操作フック
  // zoom/pan/wheel/パン操作/Escape/viewState保存を統合
  function useCanvas(config) {
    var items = config.items, itemW = config.itemW, itemH = config.itemH;
    var savedViewState = config.savedViewState, onViewStateChange = config.onViewStateChange;
    var onEscape = config.onEscape, loadGenRef = config.loadGenRef;

    var initPan = useInitialPan(items, itemW, itemH, loadGenRef);
    var svgRef = initPan.svgRef, pan = initPan.pan, setPan = initPan.setPan;

    var panningState = useState(false), panning = panningState[0], setPanning = panningState[1];
    var zoomState = useState(savedViewState && savedViewState.zoom != null ? savedViewState.zoom : 1);
    var zoom = zoomState[0], setZoom = zoomState[1];

    var panStart = useRef({x:0, y:0, px:0, py:0});
    var zoomRef = useRef(savedViewState && savedViewState.zoom != null ? savedViewState.zoom : 1);
    var panRef = useRef(savedViewState && savedViewState.pan ? savedViewState.pan : {x:0, y:0});

    useEffect(function() { zoomRef.current = zoom; }, [zoom]);
    useEffect(function() { panRef.current = pan; }, [pan]);

    useEffect(function() {
      if (savedViewState && savedViewState.pan) setPan(savedViewState.pan);
    }, []);

    useEffect(function() {
      return function() {
        if (onViewStateChange) onViewStateChange({zoom: zoomRef.current, pan: panRef.current});
      };
    }, []);

    useEffect(function() {
      if (!onEscape) return;
      var handler = function(e) {
        if (e.key === 'Escape') onEscape();
      };
      window.addEventListener('keydown', handler);
      return function() { window.removeEventListener('keydown', handler); };
    }, [onEscape]);

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
      function onBlur() { setSpaceHeld(false); }
      function onVisChange() { if (document.hidden) setSpaceHeld(false); }
      window.addEventListener('keydown', onDown);
      window.addEventListener('keyup', onUp);
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVisChange);
      return function() {
        window.removeEventListener('keydown', onDown);
        window.removeEventListener('keyup', onUp);
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onVisChange);
      };
    }, []);

    var onWheel = useCallback(function(e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        if (!svgRef.current) return;
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

    var onBgMouseDown = useCallback(function(e) {
      setPanning(true);
      panStart.current = {x: e.clientX, y: e.clientY, px: pan.x, py: pan.y};
    }, [pan]);

    var onMouseMove = useCallback(function(e) {
      if (!panning) return false;
      setPan({
        x: panStart.current.px - (e.clientX - panStart.current.x) / zoom,
        y: panStart.current.py - (e.clientY - panStart.current.y) / zoom
      });
      return true;
    }, [panning, zoom]);

    var onMouseUpOrLeave = useCallback(function() {
      setPanning(false);
    }, []);

    return {
      svgRef: svgRef, zoom: zoom, setZoom: setZoom, pan: pan, setPan: setPan,
      panning: panning, spaceHeld: spaceHeld, onWheel: onWheel, onBgMouseDown: onBgMouseDown,
      onMouseMove: onMouseMove, onMouseUpOrLeave: onMouseUpOrLeave
    };
  }

  // ズームボタン群コンポーネント
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

  // バリアント サブタブバー
  // props: { variants, onSwitch, onDuplicate, onDelete, onRename, onSplit, onKeep, isSplit }
  function VariantBar(props) {
    var variants = props.variants, onSwitch = props.onSwitch, onDuplicate = props.onDuplicate;
    var onDelete = props.onDelete, onRename = props.onRename, onSplit = props.onSplit, onKeep = props.onKeep;
    var isSplit = props.isSplit;
    var editingState = useState(null), editing = editingState[0], setEditing = editingState[1];
    var editValueState = useState(''), editValue = editValueState[0], setEditValue = editValueState[1];
    var menuState = useState(null), menuId = menuState[0], setMenuId = menuState[1];

    // メニューが開いているときにドキュメント全体のクリックで閉じる
    useEffect(function() {
      if (!menuId) return;
      function close() { setMenuId(null); }
      document.addEventListener('click', close);
      return function() { document.removeEventListener('click', close); };
    }, [menuId]);

    function startRename(v) { setEditing(v.id); setEditValue(v.name); setMenuId(null); }
    function commitRename() {
      if (editing && editValue.trim()) { onRename(editing, editValue.trim()); }
      setEditing(null);
    }

    if (!variants || variants.length === 0) return null;

    // Splitモード中: Split解除ボタンのみ
    if (isSplit) {
      return h("div", { className: "variant-bar" },
        h("button", { className: "variant-action-btn", onClick: onSplit, style: { color: "var(--md-sys-color-primary)", borderColor: "var(--md-sys-color-primary)" } }, "Exit Compare")
      );
    }

    var tabs = variants.map(function(v) {
      var isActive = v.active;
      if (editing === v.id) {
        return h("div", { key: v.id, className: "variant-tab active" },
          h("input", {
            value: editValue, autoFocus: true,
            onChange: function(e) { setEditValue(e.target.value); },
            onBlur: commitRename,
            onKeyDown: function(e) { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(null); },
            style: { border: "none", background: "transparent", outline: "none", width: 80, fontSize: 13, fontWeight: 500, fontFamily: "inherit", color: "inherit" }
          })
        );
      }
      return h("div", {
        key: v.id,
        className: "variant-tab" + (isActive ? " active" : ""),
        onClick: function() { onSwitch(v.id); setMenuId(null); },
        onDoubleClick: function() { startRename(v); }
      },
        h("span", null, v.name),
        isActive ? h("span", {
          className: "variant-more-btn",
          onClick: function(e) { e.stopPropagation(); setMenuId(menuId === v.id ? null : v.id); }
        }, "\u22EF") : null,
        menuId === v.id ? h("div", {
          className: "variant-menu",
          onClick: function(e) { e.stopPropagation(); }
        },
          h("div", { className: "variant-menu-item", onClick: function() { setMenuId(null); onDuplicate(); } }, "Duplicate"),
          h("div", { className: "variant-menu-item", onClick: function() { startRename(v); } }, "Rename"),
          h("div", { className: "variant-menu-divider" }),
          h("div", { className: "variant-menu-item variant-menu-primary", onClick: function() { setMenuId(null); onKeep(); } }, "Keep"),
          h("div", { className: "variant-menu-divider" }),
          variants.length > 1 ? h("div", { className: "variant-menu-item variant-menu-danger", onClick: function() { setMenuId(null); onDelete(v.id); } }, "Delete") : null
        ) : null
      );
    });

    return h("div", { className: "variant-bar", onClick: function() { setMenuId(null); } },
      variants.length >= 2 ? h("button", { className: "variant-action-btn", onClick: onSplit, style: { alignSelf: "center", marginRight: 4 } }, "Compare") : null,
      tabs
    );
  }

  exports.M3 = M3;
  exports.Input = Input;
  exports.Sel = Sel;
  exports.Btn = Btn;
  exports.SLabel = SLabel;
  exports.useInitialPan = useInitialPan;
  exports.useHistory = useHistory;
  exports.useCanvas = useCanvas;
  exports.ZoomControls = ZoomControls;
  exports.VariantBar = VariantBar;

})(window.__editorUI = window.__editorUI || {});

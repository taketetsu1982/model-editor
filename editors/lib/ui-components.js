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

  // バリアント サブタブバー
  // props: { variants, onSwitch, onDuplicate, onDelete, onRename, onSplit, onKeep, isSplit }
  function VariantBar(props) {
    var variants = props.variants, onSwitch = props.onSwitch, onDuplicate = props.onDuplicate;
    var onDelete = props.onDelete, onRename = props.onRename, onSplit = props.onSplit, onKeep = props.onKeep;
    var isSplit = props.isSplit;
    var editingState = useState(null), editing = editingState[0], setEditing = editingState[1];
    var editValueState = useState(''), editValue = editValueState[0], setEditValue = editValueState[1];
    var menuState = useState(null), menuId = menuState[0], setMenuId = menuState[1];

    function startRename(v) { setEditing(v.id); setEditValue(v.name); setMenuId(null); }
    function commitRename() {
      if (editing && editValue.trim()) { onRename(editing, editValue.trim()); }
      setEditing(null);
    }

    if (!variants || variants.length === 0) return null;

    // Splitモード中: Split解除ボタンのみ
    if (isSplit) {
      return h("div", { className: "variant-bar" },
        h("button", { className: "variant-action-btn", onClick: onSplit, style: { color: "var(--md-sys-color-primary)", borderColor: "var(--md-sys-color-primary)" } }, "Exit Split")
      );
    }

    var tabs = variants.map(function(v) {
      if (editing === v.id) {
        return h("div", { key: v.id, className: "variant-tab active", style: { position: "relative" } },
          h("input", {
            value: editValue, autoFocus: true,
            onChange: function(e) { setEditValue(e.target.value); },
            onBlur: commitRename,
            onKeyDown: function(e) { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(null); },
            style: { border: "none", background: "transparent", outline: "none", width: 80, fontSize: 13, fontWeight: 500, fontFamily: "inherit", color: "inherit" }
          })
        );
      }
      var isActive = v.active;
      return h("div", { key: v.id, style: { position: "relative", display: "flex", alignItems: "center" } },
        h("button", {
          className: "variant-tab" + (isActive ? " active" : ""),
          onClick: function() { onSwitch(v.id); setMenuId(null); },
          onDoubleClick: function() { startRename(v); }
        }, v.name),
        // アクティブタブに ⋯ ボタンを表示
        isActive ? h("button", {
          className: "variant-more-btn",
          onClick: function(e) { e.stopPropagation(); setMenuId(menuId === v.id ? null : v.id); }
        }, "\u22EF") : null,
        // ⋯ メニュー（ポップオーバー）
        menuId === v.id ? h("div", {
          className: "variant-menu",
          onClick: function(e) { e.stopPropagation(); }
        },
          h("button", { className: "variant-menu-item", onClick: function() { setMenuId(null); onDuplicate(); } }, "Duplicate"),
          h("button", { className: "variant-menu-item", onClick: function() { startRename(v); } }, "Rename"),
          h("div", { className: "variant-menu-divider" }),
          h("button", { className: "variant-menu-item variant-menu-primary", onClick: function() { setMenuId(null); onKeep(); } }, "Keep"),
          h("div", { className: "variant-menu-divider" }),
          variants.length > 1 ? h("button", { className: "variant-menu-item variant-menu-danger", onClick: function() { setMenuId(null); onDelete(v.id); } }, "Delete") : null
        ) : null
      );
    });

    return h("div", { className: "variant-bar", onClick: function() { setMenuId(null); } },
      variants.length >= 2 ? h("button", { className: "variant-action-btn", onClick: onSplit, style: { alignSelf: "center", marginRight: 4 } }, "Split") : null,
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
  exports.VariantBar = VariantBar;

})(window.__editorUI = window.__editorUI || {});

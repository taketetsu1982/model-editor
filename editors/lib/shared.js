// editors/lib/shared.js — 両エディタ共通の純粋関数・定数
(function(exports) {

  // --- 定数 ---
  exports.OBJ_PALETTE = [
    { bg: "#AECBFA", fg: "#174EA6" },
    { bg: "#FDD663", fg: "#7A6200" },
    { bg: "#A8DAB5", fg: "#137333" },
    { bg: "#F6AEA9", fg: "#A50E0E" },
    { bg: "#D7AEFB", fg: "#7627BB" },
    { bg: "#FDCFE8", fg: "#9C166B" },
    { bg: "#A1E4F2", fg: "#0D652D" },
    { bg: "#FBC8A4", fg: "#8B4513" },
  ];

  exports.ZOOM_MIN = 0.25;
  exports.ZOOM_MAX = 3;
  exports.MAX_HISTORY = 80;

  exports.LABEL_CHAR_W = 7;
  exports.LABEL_CHAR_W_WIDE = 11;
  exports.LABEL_MIN_W = 24;
  exports.LABEL_PAD = 16;

  // --- 関数 ---

  // ランダムID生成
  exports.uid = function() {
    return Math.random().toString(36).slice(2, 8);
  };

  // 重複回避の名前生成
  exports.uniqueName = function(base, existingNames) {
    if (!existingNames.includes(base)) return base;
    var m = base.match(/^(.+?)(\d+)$/);
    var stem = m ? m[1] : base;
    var n = m ? parseInt(m[2], 10) + 1 : 2;
    while (existingNames.includes(stem + n)) n++;
    return stem + n;
  };

  // ノード間の接続点計算（矩形の辺上の最寄り点）
  exports.edgePt = function(x, y, w, h, tx, ty) {
    var cx = x + w / 2, cy = y + h / 2, dx = tx - cx, dy = ty - cy;
    if (Math.abs(dx) * h > Math.abs(dy) * w)
      return dx > 0 ? { x: x + w, y: cy } : { x: x, y: cy };
    return dy > 0 ? { x: cx, y: y + h } : { x: cx, y: y };
  };

  // アイテム群の中心座標計算（キャンバス中央合わせ用）
  exports.calcCenterPan = function(items, w, h) {
    if (!items || items.length === 0) return { cx: 0, cy: 0 };
    var xs = items.map(function(i) { return i.x || 0; });
    var ys = items.map(function(i) { return i.y || 0; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs) + w;
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys) + h;
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  };

  // East Asian Width が Wide/Fullwidth の主要範囲を判定
  exports.isWideChar = function(ch) {
    var code = ch.charCodeAt(0);
    return (code >= 0x1100 && code <= 0x115F) ||  // ハングル Jamo
           (code >= 0x2E80 && code <= 0x9FFF) ||  // CJK部首〜CJK統合漢字
           (code >= 0xAC00 && code <= 0xD7AF) ||  // ハングル音節
           (code >= 0xF900 && code <= 0xFAFF) ||  // CJK互換漢字
           (code >= 0xFE30 && code <= 0xFE6F) ||  // CJK互換形
           (code >= 0xFF01 && code <= 0xFF60) ||  // 全角英数
           (code >= 0xFFE0 && code <= 0xFFE6);    // 全角記号
  };

  // ラベル幅の計算（半角・全角を考慮）
  exports.labelWidth = function(text) {
    var s = text || "";
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      w += exports.isWideChar(s[i]) ? exports.LABEL_CHAR_W_WIDE : exports.LABEL_CHAR_W;
    }
    return Math.max(w, exports.LABEL_MIN_W) + exports.LABEL_PAD;
  };

  // オブジェクトのカラーパレット取得（objects配列とidを受け取る純粋関数）
  exports.objPalette = function(objects, id) {
    return exports.OBJ_PALETTE[Math.max(0, objects.findIndex(function(e) { return e.id === id; })) % exports.OBJ_PALETTE.length];
  };

  // オブジェクトの色取得
  exports.objColor = function(objects, id) {
    return exports.objPalette(objects, id).fg;
  };

  // オブジェクト名取得
  exports.objName = function(objects, id) {
    var ent = objects.find(function(e) { return e.id === id; });
    return ent ? ent.name : id;
  };

  // --- リレーション定数 ---
  exports.REL_TYPES = ["has-many", "has-one", "many-to-many"];
  exports.REL_TYPE_LABELS = { "has-many": "has many", "has-one": "has one", "many-to-many": "many to many" };

  // --- オブジェクトノードサイズ ---
  exports.EW = 200;
  exports.EH = 72;

  // --- 自己参照カーブ ---
  exports.SELF_REF_X = 6;
  exports.SELF_REF_Y = 14;
  exports.SELF_REF_CP = 38;

  // --- グリッドレイアウト（Object） ---
  exports.OBJ_GRID_COLS = 3;
  exports.OBJ_GRID_GAP_X = 360;
  exports.OBJ_GRID_GAP_Y = 240;
  exports.OBJ_GRID_PAD_X = 80;
  exports.OBJ_GRID_PAD_Y = 80;

  // --- グリッドレイアウト（View） ---
  exports.VW_GRID_COLS = 3;
  exports.VW_GRID_GAP_X = 120;
  exports.VW_GRID_GAP_Y = 80;
  exports.VW_GRID_PAD_X = 60;
  exports.VW_GRID_PAD_Y = 60;

  // --- ビューカードサイズ ---
  exports.SW = 240;
  exports.SH = 76;

  // --- ビューカード内部 ---
  exports.SC_HEADER_H = 36;
  exports.SC_OBJ_START_Y = 40;
  exports.SC_OBJ_ROW_H = 22;
  exports.SC_OBJ_PAD_X = 8;

  // --- ビュータイプ定数 ---
  exports.VIEW_TYPES = ["collection", "single"];
  exports.TYPE_LABEL = { collection: "Collection", single: "Single" };

  // --- 空モデル ---
  exports.EMPTY = { objects: [], views: [], paneGraph: [], screens: [], devices: ["mobile", "desktop"] };

  // --- デバイスアイコン ---
  exports.DEVICE_ICONS = { mobile: "smartphone", tablet: "tablet", desktop: "desktop_windows" };

  // --- Screenカード定数 ---
  exports.SCR_PAD = 12;
  exports.SCR_HEADER_H = 40;
  exports.SCR_PANE_H = 36;
  exports.SCR_PANE_GAP = 4;
  exports.SCR_PANE_PAD = 8;
  exports.SCR_MIN_W = 200;

  // --- ビューの表示名: "オブジェクト名 Collection" 等 ---
  exports.viewLabel = function(vw, objs) {
    var on = exports.objName(objs, vw.objectId);
    var tl = exports.TYPE_LABEL[vw.type] || vw.type;
    return on + " " + tl;
  };

  // --- Screenカードの幅・高さ計算 ---
  exports.scrCardSize = function(sc, views, objects) {
    var panes = (sc.paneIds || []).map(function(pid) {
      return views.find(function(v) { return v.id === pid; });
    }).filter(Boolean);
    var pw = panes.reduce(function(mx, vw) {
      var lbl = exports.viewLabel(vw, objects);
      return Math.max(mx, exports.labelWidth(lbl) + 40);
    }, 0);
    var w = Math.max(exports.SCR_MIN_W, pw + exports.SCR_PANE_PAD * 2 + exports.SCR_PAD * 2);
    var bodyH = panes.length > 0
      ? (panes.length * exports.SCR_PANE_H + (panes.length - 1) * exports.SCR_PANE_GAP + exports.SCR_PANE_PAD * 2)
      : 48;
    return { w: w, h: exports.SCR_HEADER_H + bodyH };
  };

  // --- データマイグレーション ---
  // モデルデータを最新スキーマに移行する純粋関数
  // onToast: マイグレーション通知用コールバック（省略可）
  exports.migrateModelData = function(raw, onToast) {
    var objs = raw.objects || [];
    var migrated = false;
    objs.forEach(function(e) {
      (e.relations || []).forEach(function(r) {
        if (r.type === 'belongs-to') { r.type = 'has-many'; migrated = true; }
      });
    });
    if (migrated && onToast) setTimeout(function() { onToast('belongs-toをhas-manyに自動変換しました'); }, 300);
    var vwMigrated = false;
    var vws = (raw.views || []).map(function(v) {
      if (v.objects && !v.objectId) {
        vwMigrated = true;
        var first = v.objects[0];
        var rest = {};
        Object.keys(v).forEach(function(k) { if (k !== 'objects') rest[k] = v[k]; });
        return Object.assign(rest, {
          objectId: first && first.objectId ? first.objectId : "",
          type: first && first.variant ? first.variant : v.type || "collection",
          fields: v.fields || [],
          verbs: v.verbs || []
        });
      }
      return Object.assign({}, v, { fields: v.fields || [], verbs: v.verbs || [] });
    });
    if (vwMigrated && onToast) setTimeout(function() { onToast('ビュースキーマを新形式に自動変換しました'); }, 600);
    var DEFAULT_DEVICES = ["mobile", "desktop"];
    return { objects: objs, views: vws, paneGraph: raw.paneGraph || [], screens: raw.screens || [], devices: raw.devices || DEFAULT_DEVICES };
  };

  // --- 矩形交差判定（AABB） ---
  // 2つの矩形が交差するか判定する
  exports.rectsIntersect = function(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  };

  // --- Mermaid記法生成 ---
  var REL_MERMAID = { "has-many": "||--o{", "has-one": "||--||", "many-to-many": "}o--o{" };

  // Object → erDiagram（リレーション図）
  function generateObjectMermaid(model) {
    var lines = ["erDiagram"];
    (model.objects || []).forEach(function(obj) {
      if (!obj.relations || obj.relations.length === 0) {
        lines.push("    " + obj.id + " { }");
        return;
      }
      obj.relations.forEach(function(r) {
        var sym = REL_MERMAID[r.type] || "||--o{";
        lines.push("    " + obj.id + " " + sym + " " + r.targetId + ' : "' + (r.type || "") + '"');
      });
    });
    return lines.join("\n");
  }

  // Pane → classDiagram（fields=属性、verbs=操作）
  function generatePaneMermaid(model) {
    var lines = ["classDiagram"];
    (model.views || []).forEach(function(vw) {
      var on = exports.objName(model.objects || [], vw.objectId);
      var tl = exports.TYPE_LABEL[vw.type] || vw.type;
      var id = "`" + vw.id + "`";
      lines.push("    class " + id + ' ["' + on + " " + tl + '"]');
      (vw.fields || []).forEach(function(f) { lines.push("    " + id + " : " + f); });
      (vw.verbs || []).forEach(function(v) { lines.push("    " + id + " : " + v + "()"); });
    });
    (model.paneGraph || []).forEach(function(e) {
      var from = "`" + e.from + "`";
      var to = "`" + e.to + "`";
      if (e.type === "drilldown") {
        lines.push("    " + from + " --> " + to + " : " + (e.param || "drilldown"));
      } else {
        lines.push("    " + from + " ..> " + to + " : embed");
      }
    });
    return lines.join("\n");
  }

  // Screen → flowchart TD（デバイス別subgraph）
  function generateScreenMermaid(model) {
    var lines = ["flowchart TD"];
    var devices = {};
    (model.screens || []).forEach(function(sc) {
      var d = sc.device || "unknown";
      if (!devices[d]) devices[d] = [];
      devices[d].push(sc);
    });
    Object.keys(devices).forEach(function(d) {
      lines.push("    subgraph " + d);
      devices[d].forEach(function(sc) {
        var paneLabels = (sc.paneIds || []).map(function(pid) {
          var vw = (model.views || []).find(function(v) { return v.id === pid; });
          if (!vw) return pid;
          return exports.objName(model.objects || [], vw.objectId) + " " + (exports.TYPE_LABEL[vw.type] || vw.type);
        });
        lines.push('        ' + sc.id + '["' + sc.name + '<br/>' + paneLabels.join(", ") + '"]');
      });
      lines.push("    end");
    });
    return lines.join("\n");
  }

  var MERMAID_GENERATORS = { object: generateObjectMermaid, pane: generatePaneMermaid, screen: generateScreenMermaid };
  exports.generateMermaid = function(tab, model) {
    var fn = MERMAID_GENERATORS[tab];
    return fn ? fn(model) : "";
  };

})(typeof module !== 'undefined' ? module.exports : (window.__editorLib = window.__editorLib || {}));

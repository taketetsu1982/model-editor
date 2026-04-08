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

})(typeof module !== 'undefined' ? module.exports : (window.__editorLib = window.__editorLib || {}));

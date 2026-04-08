// docs/reqs/lib/object-logic.js — Object Editor固有の純粋関数
(function(exports) {

  // オブジェクト初期位置設定
  exports.ensurePositions = function(data, config) {
    if (!data || !data.objects) return data;
    var cols = config.cols, gapX = config.gapX, gapY = config.gapY;
    var padX = config.padX, padY = config.padY;
    data.objects.forEach(function(obj, i) {
      if (obj.x === undefined || obj.y === undefined) {
        obj.x = padX + (i % cols) * gapX;
        obj.y = padY + Math.floor(i / cols) * gapY;
      }
    });
    return data;
  };

  // 丸囲み数字
  var CIRCLED = ["⓪","①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮","⑯","⑰","⑱","⑲","⑳"];
  exports.CIRCLED = CIRCLED;
  exports.circled = function(n) {
    return n < CIRCLED.length ? CIRCLED[n] : String(n);
  };

})(typeof module !== 'undefined' ? module.exports : (window.__editorLib = window.__editorLib || {}));

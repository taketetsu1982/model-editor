// docs/reqs/lib/view-logic.js — View Editor固有の純粋関数
(function(exports) {

  // ビュー自動配置（Actor別にグリッド配置）
  exports.ensureViewPositions = function(data, actors, config) {
    if (!data || !data.views || !actors) return data;
    var cols = config.cols, gapX = config.gapX, gapY = config.gapY;
    var padX = config.padX, padY = config.padY;
    var minSpanFactor = config.minSpanFactor, minSpanMin = config.minSpanMin;
    actors.forEach(function(actor) {
      var actorViews = data.views.filter(function(s) { return s.actorId === actor.id; });
      if (actorViews.length < 2) return;
      var xs = actorViews.map(function(s) { return s.x; });
      var ys = actorViews.map(function(s) { return s.y; });
      var rangeX = Math.max.apply(null, xs) - Math.min.apply(null, xs);
      var rangeY = Math.max.apply(null, ys) - Math.min.apply(null, ys);
      var minSpan = Math.max((actorViews.length - 1) * minSpanFactor, minSpanMin);
      if (rangeX + rangeY >= minSpan) return;
      actorViews.forEach(function(vw, i) {
        vw.x = padX + (i % cols) * gapX;
        vw.y = padY + Math.floor(i / cols) * gapY;
      });
    });
    return data;
  };

})(typeof module !== 'undefined' ? module.exports : (window.__editorLib = window.__editorLib || {}));

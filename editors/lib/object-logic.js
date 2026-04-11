// editors/lib/object-logic.js — Object Editor固有の純粋関数
(function(exports) {

  // オブジェクト初期位置設定（階層レイアウト）
  // リレーションの親→子方向に従い、層ごとにノードを配置する
  exports.ensurePositions = function(data, config) {
    if (!data || !data.objects) return data;
    var objects = data.objects;
    // 座標未設定のノードがなければスキップ
    var needsLayout = objects.some(function(obj) {
      return obj.x === undefined || obj.y === undefined;
    });
    if (!needsLayout) return data;

    var gapX = config.gapX, gapY = config.gapY;
    var padX = config.padX, padY = config.padY;

    // 子として参照されるIDを収集
    var childIds = {};
    objects.forEach(function(obj) {
      (obj.relations || []).forEach(function(rel) {
        if (rel.targetId && rel.targetId !== obj.id) {
          childIds[rel.targetId] = true;
        }
      });
    });

    // ルートノード（誰からも参照されない）を特定
    var roots = objects.filter(function(obj) { return !childIds[obj.id]; });
    // すべてのノードが子の場合はフォールバック（最初のノードをルートに）
    if (roots.length === 0) roots = [objects[0]];

    // BFSで各ノードの深さを計算
    var depth = {};
    var visited = {};
    var queue = [];
    roots.forEach(function(r) {
      depth[r.id] = 0;
      visited[r.id] = true;
      queue.push(r.id);
    });

    var idMap = {};
    objects.forEach(function(obj) { idMap[obj.id] = obj; });

    while (queue.length > 0) {
      var current = queue.shift();
      var obj = idMap[current];
      if (!obj) continue;
      (obj.relations || []).forEach(function(rel) {
        if (rel.targetId && !visited[rel.targetId] && idMap[rel.targetId]) {
          depth[rel.targetId] = depth[current] + 1;
          visited[rel.targetId] = true;
          queue.push(rel.targetId);
        }
      });
    }

    // 未到達のノードにもデフォルト深さを設定
    objects.forEach(function(obj) {
      if (depth[obj.id] === undefined) {
        depth[obj.id] = 0;
      }
    });

    // 深さごとにノードをグループ化
    var layers = {};
    objects.forEach(function(obj) {
      var d = depth[obj.id];
      if (!layers[d]) layers[d] = [];
      layers[d].push(obj);
    });

    // 各層のノードに座標を割り当て
    var depthKeys = Object.keys(layers).map(Number).sort(function(a, b) { return a - b; });
    depthKeys.forEach(function(d) {
      var layer = layers[d];
      // 層内のノードを中央揃えにするためのオフセット
      var totalWidth = (layer.length - 1) * gapX;
      var startX = padX - totalWidth / 2;
      layer.forEach(function(obj, i) {
        obj.x = startX + i * gapX;
        obj.y = padY + d * gapY;
      });
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

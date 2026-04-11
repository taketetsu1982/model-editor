// editors/lib/view-logic.js — View Editor固有の純粋関数
(function(exports) {

  var SORT_LAST = Infinity;
  var TYPE_ORDER_OTHER = 2;
  // Paneの高さ計算に使う定数
  var HEADER_H = 36;
  var ROW_H = 22;
  var CONTENT_PAD = 8;
  var EMPTY_PAD = 40;
  var BOTTOM_PAD = 8;
  var VERB_SEPARATOR = 8;
  // collection+singleペア間のギャップ比率（gapXに対する）
  var PAIR_GAP_RATIO = 0.3;

  // Paneの高さを計算（fields + verbsの数に基づく）
  function calcPaneHeight(vw) {
    var fields = (vw.fields || []).length;
    var verbs = (vw.verbs || []).length;
    var hasContent = fields > 0 || verbs > 0;
    return HEADER_H + (hasContent ? CONTENT_PAD : EMPTY_PAD)
      + fields * ROW_H
      + (verbs > 0 ? verbs * ROW_H + VERB_SEPARATOR : 0)
      + BOTTOM_PAD;
  }

  // objectsのリレーション階層深さを計算（BFS）
  function computeObjectDepths(objects) {
    var childIds = {};
    objects.forEach(function(obj) {
      (obj.relations || []).forEach(function(rel) {
        if (rel.targetId && rel.targetId !== obj.id) {
          childIds[rel.targetId] = true;
        }
      });
    });
    var roots = objects.filter(function(obj) { return !childIds[obj.id]; });
    // 循環グラフ等でルートが見つからない場合、先頭要素をフォールバック
    if (roots.length === 0 && objects.length > 0) roots = [objects[0]];

    var depth = {};
    var visited = {};
    var queue = [];
    roots.forEach(function(r) { depth[r.id] = 0; visited[r.id] = true; queue.push(r.id); });

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
    objects.forEach(function(obj) {
      if (depth[obj.id] === undefined) depth[obj.id] = 0;
    });
    return depth;
  }

  // Paneをメイン（最初のcollection + 最初のsingle）とサブに分離
  function splitMainSub(panes) {
    var main = [];
    var sub = [];
    var hasCollection = false;
    var hasSingle = false;
    panes.forEach(function(vw) {
      if (vw.type === 'collection' && !hasCollection) {
        hasCollection = true;
        main.push(vw);
      } else if (vw.type === 'single' && !hasSingle) {
        hasSingle = true;
        main.push(vw);
      } else {
        sub.push(vw);
      }
    });
    return { main: main, sub: sub };
  }

  // Paneをobjectの階層深さ順にグルーピング
  function groupPanesByObject(views, objects, depth) {
    var groups = {};
    var allOids = [];
    views.forEach(function(vw) {
      var oid = vw.objectId || "__none";
      if (!groups[oid]) {
        groups[oid] = [];
        allOids.push(oid);
      }
      groups[oid].push(vw);
    });

    // 各グループ内でcollection → single → その他の順にソート
    var typeOrder = { collection: 0, single: 1 };
    allOids.forEach(function(oid) {
      groups[oid].sort(function(a, b) {
        var oa = typeOrder[a.type] !== undefined ? typeOrder[a.type] : TYPE_ORDER_OTHER;
        var ob = typeOrder[b.type] !== undefined ? typeOrder[b.type] : TYPE_ORDER_OTHER;
        return oa - ob;
      });
    });

    // objectIdを階層深さ順 → objects配列の出現順でソート
    var objIndex = {};
    objects.forEach(function(obj, i) { objIndex[obj.id] = i; });
    allOids.sort(function(a, b) {
      var da = depth[a] !== undefined ? depth[a] : SORT_LAST;
      var db = depth[b] !== undefined ? depth[b] : SORT_LAST;
      if (da !== db) return da - db;
      var ia = objIndex[a] !== undefined ? objIndex[a] : SORT_LAST;
      var ib = objIndex[b] !== undefined ? objIndex[b] : SORT_LAST;
      return ia - ib;
    });

    return { groups: groups, sortedOids: allOids };
  }

  // 1つのObjectグループを配置し、使用した高さを返す
  function layoutObjectGroup(panes, startX, startY, paneW, pairGap, gapY) {
    var split = splitMainSub(panes);

    // メインPaneを横並びに配置
    var mainMaxH = 0;
    split.main.forEach(function(vw, i) {
      vw.x = startX + i * (paneW + pairGap);
      vw.y = startY;
      var h = calcPaneHeight(vw);
      if (h > mainMaxH) mainMaxH = h;
    });

    var mainWidth = split.main.length > 0
      ? split.main.length * paneW + (split.main.length - 1) * pairGap
      : paneW;

    // サブPaneをメインの下に縦積み
    var subY = startY + mainMaxH + gapY;
    var totalH = mainMaxH;
    split.sub.forEach(function(vw) {
      vw.x = startX;
      vw.y = subY;
      var h = calcPaneHeight(vw);
      subY += h + gapY;
      totalH = subY - startY - gapY;
    });

    return { width: mainWidth, height: totalH };
  }

  // Pane自動配置（階層行 × collection+single横並び + 可変高さ対応）
  exports.ensureViewPositions = function(data, config) {
    if (!data || !data.views) return data;
    var views = data.views;
    if (views.length < 2) return data;

    var gapX = config.gapX, gapY = config.gapY;
    var padX = config.padX, padY = config.padY;
    var paneW = config.paneW || 240;

    // 座標未設定のPaneがあるか判定
    var needsLayout = views.some(function(vw) {
      return vw.x === undefined || vw.y === undefined;
    });
    if (!needsLayout) {
      var xs = views.map(function(s) { return s.x; });
      var ys = views.map(function(s) { return s.y; });
      var rangeX = Math.max.apply(null, xs) - Math.min.apply(null, xs);
      var rangeY = Math.max.apply(null, ys) - Math.min.apply(null, ys);
      var minSpan = Math.max((views.length - 1) * config.minSpanFactor, config.minSpanMin);
      if (rangeX + rangeY >= minSpan) return data;
    }

    var objects = data.objects || [];
    var depth = computeObjectDepths(objects);
    var result = groupPanesByObject(views, objects, depth);
    var pairGap = Math.round(gapX * PAIR_GAP_RATIO);

    // 階層深さごとにobjectIdをグルーピング
    var depthRows = {};
    result.sortedOids.forEach(function(oid) {
      var d = depth[oid] !== undefined ? depth[oid] : 0;
      if (!depthRows[d]) depthRows[d] = [];
      depthRows[d].push(oid);
    });
    var depthKeys = Object.keys(depthRows).map(Number).sort(function(a, b) { return a - b; });

    // 行ごとに配置
    var currentY = padY;
    depthKeys.forEach(function(d) {
      var oids = depthRows[d];
      var currentX = padX;
      var rowMaxH = 0;
      oids.forEach(function(oid) {
        var size = layoutObjectGroup(result.groups[oid], currentX, currentY, paneW, pairGap, gapY);
        if (size.height > rowMaxH) rowMaxH = size.height;
        currentX += size.width + gapX;
      });
      currentY += rowMaxH + gapY;
    });

    return data;
  };

  // テスト用にエクスポート
  exports._calcPaneHeight = calcPaneHeight;
  exports._splitMainSub = splitMainSub;

})(typeof module !== 'undefined' ? module.exports : (window.__editorLib = window.__editorLib || {}));

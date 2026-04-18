import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
  uid, uniqueName, edgePt, calcCenterPan, labelWidth,
  objPalette, objColor, objName,
  OBJ_PALETTE, LABEL_CHAR_W, LABEL_CHAR_W_WIDE, LABEL_MIN_W, LABEL_PAD,
  isWideChar,
  REL_TYPES, REL_TYPE_LABELS, EW, EH, SELF_REF_X, SELF_REF_Y, SELF_REF_CP,
  OBJ_GRID_COLS, OBJ_GRID_GAP_X, OBJ_GRID_GAP_Y, OBJ_GRID_PAD_X, OBJ_GRID_PAD_Y,
  VW_GRID_COLS, VW_GRID_GAP_X, VW_GRID_GAP_Y, VW_GRID_PAD_X, VW_GRID_PAD_Y,
  SW, SH, SC_HEADER_H, SC_OBJ_START_Y, SC_OBJ_ROW_H, SC_OBJ_PAD_X,
  VIEW_TYPES, TYPE_LABEL, viewLabel, EMPTY,
  DEVICE_ICONS, SCR_PAD, SCR_HEADER_H, SCR_PANE_H, SCR_PANE_GAP, SCR_PANE_PAD, SCR_MIN_W,
  scrCardSize,
  migrateModelData, rectsIntersect,
} = require('./shared.js');

describe('uid', () => {
  it('6文字の文字列を返す', () => {
    const id = uid();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(6);
  });

  it('呼び出しごとに異なる値を返す', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });
});

describe('uniqueName', () => {
  it('重複がなければそのまま返す', () => {
    expect(uniqueName('Screen', ['Task', 'Board'])).toBe('Screen');
  });

  it('重複があれば連番を付与する', () => {
    expect(uniqueName('Screen', ['Screen'])).toBe('Screen2');
  });

  it('既に番号付きの場合はインクリメント', () => {
    expect(uniqueName('Screen2', ['Screen2'])).toBe('Screen3');
  });

  it('連番が既に使われていればスキップ', () => {
    expect(uniqueName('Screen', ['Screen', 'Screen2', 'Screen3'])).toBe('Screen4');
  });

  it('空のリストなら重複なし', () => {
    expect(uniqueName('Test', [])).toBe('Test');
  });
});

describe('edgePt', () => {
  // 100x50の矩形 (0,0) から (200,25) への接続点 → 右辺
  it('ターゲットが右側の場合、右辺の中央を返す', () => {
    const pt = edgePt(0, 0, 100, 50, 200, 25);
    expect(pt).toEqual({ x: 100, y: 25 });
  });

  it('ターゲットが左側の場合、左辺の中央を返す', () => {
    const pt = edgePt(100, 0, 100, 50, 0, 25);
    expect(pt).toEqual({ x: 100, y: 25 });
  });

  it('ターゲットが下側の場合、下辺の中央を返す', () => {
    const pt = edgePt(0, 0, 100, 50, 50, 200);
    expect(pt).toEqual({ x: 50, y: 50 });
  });

  it('ターゲットが上側の場合、上辺の中央を返す', () => {
    const pt = edgePt(0, 100, 100, 50, 50, 0);
    expect(pt).toEqual({ x: 50, y: 100 });
  });
});

describe('calcCenterPan', () => {
  it('空配列ではデフォルト値を返す', () => {
    expect(calcCenterPan([], 100, 50)).toEqual({ cx: 0, cy: 0 });
  });

  it('nullではデフォルト値を返す', () => {
    expect(calcCenterPan(null, 100, 50)).toEqual({ cx: 0, cy: 0 });
  });

  it('1要素の場合、要素+サイズの中心を返す', () => {
    const result = calcCenterPan([{ x: 0, y: 0 }], 100, 50);
    expect(result).toEqual({ cx: 50, cy: 25 });
  });

  it('複数要素の場合、全体の中心を返す', () => {
    const result = calcCenterPan([{ x: 0, y: 0 }, { x: 200, y: 100 }], 100, 50);
    // minX=0, maxX=200+100=300, minY=0, maxY=100+50=150
    expect(result).toEqual({ cx: 150, cy: 75 });
  });
});

describe('labelWidth', () => {
  it('空文字列ではMIN_W+PADを返す', () => {
    expect(labelWidth('')).toBe(LABEL_MIN_W + LABEL_PAD);
  });

  it('nullではMIN_W+PADを返す', () => {
    expect(labelWidth(null)).toBe(LABEL_MIN_W + LABEL_PAD);
  });

  it('半角テキストではCHAR_W*length+PADを返す', () => {
    const text = 'Click here';
    expect(labelWidth(text)).toBe(text.length * LABEL_CHAR_W + LABEL_PAD);
  });

  it('短いテキストではMIN_Wが適用される', () => {
    expect(labelWidth('ab')).toBe(LABEL_MIN_W + LABEL_PAD);
  });

  it('日本語テキストではCHAR_W_WIDE*length+PADを返す', () => {
    const text = 'テナント内ユーザ';
    expect(labelWidth(text)).toBe(text.length * LABEL_CHAR_W_WIDE + LABEL_PAD);
  });

  it('半角・全角混在テキストでは文字種ごとの幅を合算する', () => {
    const text = 'has タスク';
    // 'h','a','s',' ' = 4 * LABEL_CHAR_W, 'タ','ス','ク' = 3 * LABEL_CHAR_W_WIDE
    expect(labelWidth(text)).toBe(4 * LABEL_CHAR_W + 3 * LABEL_CHAR_W_WIDE + LABEL_PAD);
  });
});

describe('isWideChar', () => {
  it('半角英字はfalse', () => {
    expect(isWideChar('a')).toBe(false);
  });

  it('数字・記号はfalse', () => {
    expect(isWideChar('0')).toBe(false);
    expect(isWideChar(':')).toBe(false);
    expect(isWideChar('-')).toBe(false);
  });

  it('ギリシャ文字(U+03B1)はfalse', () => {
    expect(isWideChar('\u03B1')).toBe(false);
  });

  it('キリル文字(U+0411)はfalse', () => {
    expect(isWideChar('\u0411')).toBe(false);
  });

  it('CJK統合漢字の先頭(U+4E00)はtrue', () => {
    expect(isWideChar('\u4E00')).toBe(true);
  });

  it('ひらがな(U+3042)はtrue', () => {
    expect(isWideChar('あ')).toBe(true);
  });

  it('カタカナ(U+30A2)はtrue', () => {
    expect(isWideChar('ア')).toBe(true);
  });

  it('全角英数(U+FF21)はtrue', () => {
    expect(isWideChar('\uFF21')).toBe(true);
  });

  it('ハングル音節(U+AC00)はtrue', () => {
    expect(isWideChar('\uAC00')).toBe(true);
  });
});

describe('objPalette', () => {
  const objects = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ];

  it('インデックスに対応するパレット色を返す', () => {
    expect(objPalette(objects, 'a')).toEqual(OBJ_PALETTE[0]);
    expect(objPalette(objects, 'b')).toEqual(OBJ_PALETTE[1]);
    expect(objPalette(objects, 'c')).toEqual(OBJ_PALETTE[2]);
  });

  it('存在しないIDではインデックス0のパレットを返す', () => {
    expect(objPalette(objects, 'unknown')).toEqual(OBJ_PALETTE[0]);
  });

  it('パレット数を超えるとラップアラウンドする', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `e${i}`, name: `E${i}` }));
    expect(objPalette(many, 'e8')).toEqual(OBJ_PALETTE[0]);
    expect(objPalette(many, 'e9')).toEqual(OBJ_PALETTE[1]);
  });
});

describe('objColor', () => {
  it('オブジェクトの前景色を返す', () => {
    const objects = [{ id: 'x', name: 'X' }];
    expect(objColor(objects, 'x')).toBe(OBJ_PALETTE[0].fg);
  });
});

describe('objName', () => {
  const objects = [{ id: 'task', name: 'タスク' }];

  it('オブジェクト名を返す', () => {
    expect(objName(objects, 'task')).toBe('タスク');
  });

  it('存在しないIDではIDそのものを返す', () => {
    expect(objName(objects, 'unknown')).toBe('unknown');
  });
});

// --- 移動した定数のテスト ---

describe('REL_TYPES / REL_TYPE_LABELS', () => {
  it('3種類のリレーションタイプを持つ', () => {
    expect(REL_TYPES).toEqual(['has-many', 'has-one', 'many-to-many']);
  });

  it('各タイプのラベルが定義されている', () => {
    expect(REL_TYPE_LABELS['has-many']).toBe('has many');
    expect(REL_TYPE_LABELS['has-one']).toBe('has one');
    expect(REL_TYPE_LABELS['many-to-many']).toBe('many to many');
  });
});

describe('オブジェクトノード定数', () => {
  it('EW/EHが正しい値', () => {
    expect(EW).toBe(200);
    expect(EH).toBe(72);
  });

  it('自己参照カーブ定数が正しい値', () => {
    expect(SELF_REF_X).toBe(6);
    expect(SELF_REF_Y).toBe(14);
    expect(SELF_REF_CP).toBe(38);
  });
});

describe('グリッドレイアウト定数', () => {
  it('Objectグリッドが正しい値', () => {
    expect(OBJ_GRID_COLS).toBe(3);
    expect(OBJ_GRID_GAP_X).toBe(360);
    expect(OBJ_GRID_GAP_Y).toBe(240);
    expect(OBJ_GRID_PAD_X).toBe(80);
    expect(OBJ_GRID_PAD_Y).toBe(80);
  });

  it('Viewグリッドが正しい値', () => {
    expect(VW_GRID_COLS).toBe(3);
    expect(VW_GRID_GAP_X).toBe(120);
    expect(VW_GRID_GAP_Y).toBe(80);
    expect(VW_GRID_PAD_X).toBe(60);
    expect(VW_GRID_PAD_Y).toBe(60);
  });
});

describe('ビューカード定数', () => {
  it('SW/SHが正しい値', () => {
    expect(SW).toBe(240);
    expect(SH).toBe(76);
  });

  it('カード内部定数が正しい値', () => {
    expect(SC_HEADER_H).toBe(36);
    expect(SC_OBJ_START_Y).toBe(40);
    expect(SC_OBJ_ROW_H).toBe(22);
    expect(SC_OBJ_PAD_X).toBe(8);
  });
});

describe('VIEW_TYPES / TYPE_LABEL', () => {
  it('2種類のビュータイプを持つ', () => {
    expect(VIEW_TYPES).toEqual(['collection', 'single']);
  });

  it('各タイプのラベルが定義されている', () => {
    expect(TYPE_LABEL.collection).toBe('Collection');
    expect(TYPE_LABEL.single).toBe('Single');
  });
});

describe('EMPTY', () => {
  it('空モデルの構造が正しい', () => {
    expect(EMPTY).toEqual({
      objects: [], views: [], paneGraph: [], screens: [],
      devices: ['mobile', 'desktop'],
    });
  });
});

describe('DEVICE_ICONS', () => {
  it('3種類のデバイスアイコンが定義されている', () => {
    expect(DEVICE_ICONS.mobile).toBe('smartphone');
    expect(DEVICE_ICONS.tablet).toBe('tablet');
    expect(DEVICE_ICONS.desktop).toBe('desktop_windows');
  });
});

describe('Screenカード定数', () => {
  it('各定数が正しい値', () => {
    expect(SCR_PAD).toBe(12);
    expect(SCR_HEADER_H).toBe(40);
    expect(SCR_PANE_H).toBe(36);
    expect(SCR_PANE_GAP).toBe(4);
    expect(SCR_PANE_PAD).toBe(8);
    expect(SCR_MIN_W).toBe(200);
  });
});

describe('viewLabel', () => {
  const objs = [{ id: 'o1', name: 'タスク' }];

  it('オブジェクト名+タイプラベルを返す', () => {
    expect(viewLabel({ objectId: 'o1', type: 'collection' }, objs)).toBe('タスク Collection');
    expect(viewLabel({ objectId: 'o1', type: 'single' }, objs)).toBe('タスク Single');
  });

  it('未知のタイプではtype値をそのまま使う', () => {
    expect(viewLabel({ objectId: 'o1', type: 'custom' }, objs)).toBe('タスク custom');
  });
});

describe('scrCardSize', () => {
  const objects = [{ id: 'o1', name: 'Task' }];
  const views = [
    { id: 'v1', objectId: 'o1', type: 'collection' },
    { id: 'v2', objectId: 'o1', type: 'single' },
  ];

  it('Paneなしの場合、最小幅と固定ボディ高さを返す', () => {
    const sc = { paneIds: [] };
    const { w, h } = scrCardSize(sc, views, objects);
    expect(w).toBe(SCR_MIN_W);
    expect(h).toBe(SCR_HEADER_H + 48);
  });

  it('Pane1つの場合、高さにPaneの高さが含まれる', () => {
    const sc = { paneIds: ['v1'] };
    const { h } = scrCardSize(sc, views, objects);
    expect(h).toBe(SCR_HEADER_H + SCR_PANE_H + SCR_PANE_PAD * 2);
  });

  it('Pane2つの場合、ギャップが含まれる', () => {
    const sc = { paneIds: ['v1', 'v2'] };
    const { h } = scrCardSize(sc, views, objects);
    expect(h).toBe(SCR_HEADER_H + 2 * SCR_PANE_H + SCR_PANE_GAP + SCR_PANE_PAD * 2);
  });

  it('存在しないPaneIDは無視される', () => {
    const sc = { paneIds: ['v1', 'nonexistent'] };
    const { h } = scrCardSize(sc, views, objects);
    // nonexistentはfilterで除外されるため、Pane1つ分
    expect(h).toBe(SCR_HEADER_H + SCR_PANE_H + SCR_PANE_PAD * 2);
  });
});

describe('migrateModelData', () => {
  it('空データではデフォルト構造を返す', () => {
    const result = migrateModelData({});
    expect(result).toEqual({
      objects: [], views: [], paneGraph: [], screens: [],
      devices: ['mobile', 'desktop'],
    });
  });

  it('belongs-toをhas-manyに変換する', () => {
    const raw = {
      objects: [{ id: 'o1', name: 'Task', relations: [{ type: 'belongs-to', target: 'o2' }] }],
      views: [],
    };
    const toasts = [];
    const result = migrateModelData(raw, msg => toasts.push(msg));
    expect(result.objects[0].relations[0].type).toBe('has-many');
    // setTimeoutで通知されるため、即時にはtoastsは空
  });

  it('has-manyはそのまま維持される', () => {
    const raw = {
      objects: [{ id: 'o1', name: 'Task', relations: [{ type: 'has-many', target: 'o2' }] }],
      views: [],
    };
    const result = migrateModelData(raw);
    expect(result.objects[0].relations[0].type).toBe('has-many');
  });

  it('旧形式のviewをobjectId形式に変換する', () => {
    const raw = {
      objects: [],
      views: [{ id: 'v1', type: 'collection', objects: [{ objectId: 'o1', variant: 'single' }] }],
    };
    const result = migrateModelData(raw);
    expect(result.views[0].objectId).toBe('o1');
    expect(result.views[0].type).toBe('single');
    expect(result.views[0].objects).toBeUndefined();
    expect(result.views[0].fields).toEqual([]);
    expect(result.views[0].verbs).toEqual([]);
  });

  it('新形式のviewはそのまま維持しfields/verbsを補完する', () => {
    const raw = {
      objects: [],
      views: [{ id: 'v1', objectId: 'o1', type: 'collection' }],
    };
    const result = migrateModelData(raw);
    expect(result.views[0].objectId).toBe('o1');
    expect(result.views[0].fields).toEqual([]);
    expect(result.views[0].verbs).toEqual([]);
  });

  it('paneGraph/screens/devicesを引き継ぐ', () => {
    const raw = {
      objects: [], views: [],
      paneGraph: [{ from: 'v1', to: 'v2' }],
      screens: [{ id: 's1' }],
      devices: ['tablet'],
    };
    const result = migrateModelData(raw);
    expect(result.paneGraph).toEqual([{ from: 'v1', to: 'v2' }]);
    expect(result.screens).toEqual([{ id: 's1' }]);
    expect(result.devices).toEqual(['tablet']);
  });

  it('onToastがnullでもエラーにならない', () => {
    const raw = {
      objects: [{ id: 'o1', relations: [{ type: 'belongs-to', target: 'o2' }] }],
      views: [{ id: 'v1', objects: [{ objectId: 'o1', variant: 'single' }] }],
    };
    expect(() => migrateModelData(raw, null)).not.toThrow();
    expect(() => migrateModelData(raw)).not.toThrow();
  });
});

describe('rectsIntersect', () => {
  it('重なる矩形はtrueを返す', () => {
    expect(rectsIntersect(0, 0, 100, 100, 50, 50, 100, 100)).toBe(true);
  });

  it('完全に含まれる矩形はtrueを返す', () => {
    expect(rectsIntersect(0, 0, 200, 200, 50, 50, 50, 50)).toBe(true);
  });

  it('離れた矩形はfalseを返す', () => {
    expect(rectsIntersect(0, 0, 50, 50, 100, 100, 50, 50)).toBe(false);
  });

  it('右に離れた矩形はfalseを返す', () => {
    expect(rectsIntersect(0, 0, 50, 50, 60, 0, 50, 50)).toBe(false);
  });

  it('下に離れた矩形はfalseを返す', () => {
    expect(rectsIntersect(0, 0, 50, 50, 0, 60, 50, 50)).toBe(false);
  });

  it('辺が接する場合はfalseを返す（開区間）', () => {
    // ちょうど接する場合: ax+aw === bx なので ax+aw > bx は false
    expect(rectsIntersect(0, 0, 50, 50, 50, 0, 50, 50)).toBe(false);
  });

  it('1ピクセル重なる場合はtrueを返す', () => {
    expect(rectsIntersect(0, 0, 51, 51, 50, 50, 50, 50)).toBe(true);
  });
});

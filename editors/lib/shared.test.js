import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
  uid, uniqueName, edgePt, calcCenterPan, labelWidth,
  objPalette, objColor, objName,
  CRUD_OPS, OBJ_PALETTE, LABEL_CHAR_W, LABEL_CHAR_W_WIDE, LABEL_MIN_W, LABEL_PAD,
  isWideChar,
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

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ensureViewPositions, _calcPaneHeight, _splitMainSub } = require('./view-logic.js');

const DEFAULT_CONFIG = {
  gapX: 120, gapY: 80, padX: 60, padY: 60, paneW: 240,
  minSpanFactor: 160, minSpanMin: 200,
};

describe('calcPaneHeight', () => {
  it('fields+verbsのあるPaneの高さを計算する', () => {
    const h = _calcPaneHeight({ fields: ['a', 'b'], verbs: ['x'] });
    // 36 + 8 + 2*22 + (1*22+8) + 8 = 36+8+44+30+8 = 126
    expect(h).toBe(126);
  });

  it('空のPaneの高さを計算する', () => {
    const h = _calcPaneHeight({});
    // 36 + 40 + 0 + 0 + 8 = 84
    expect(h).toBe(84);
  });
});

describe('ensureViewPositions', () => {
  it('null/undefinedを安全に返す', () => {
    expect(ensureViewPositions(null, DEFAULT_CONFIG)).toBe(null);
    expect(ensureViewPositions(undefined, DEFAULT_CONFIG)).toBe(undefined);
  });

  it('viewsがない場合はそのまま返す', () => {
    const data = { transitions: [] };
    expect(ensureViewPositions(data, DEFAULT_CONFIG)).toBe(data);
  });

  it('1つのPaneでは再配置しない', () => {
    const data = { views: [{ id: 'v1', x: 10, y: 20 }] };
    ensureViewPositions(data, DEFAULT_CONFIG);
    expect(data.views[0]).toMatchObject({ x: 10, y: 20 });
  });

  it('十分に散らばっているPaneは再配置しない', () => {
    const data = {
      objects: [],
      views: [
        { id: 'v1', objectId: 'a', x: 0, y: 0 },
        { id: 'v2', objectId: 'b', x: 500, y: 500 },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    expect(data.views[0]).toMatchObject({ x: 0, y: 0 });
    expect(data.views[1]).toMatchObject({ x: 500, y: 500 });
  });

  it('同じobjectIdのcollection+singleが横並びになる', () => {
    const data = {
      objects: [{ id: 'task', name: 'Task', relations: [] }],
      views: [
        { id: 'v1', objectId: 'task', type: 'collection', fields: ['a'], verbs: [] },
        { id: 'v2', objectId: 'task', type: 'single', fields: ['a'], verbs: [] },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    // 同じY座標（横並び）
    expect(data.views[0].y).toBe(data.views[1].y);
    // collectionが左、singleが右
    expect(data.views[0].x).toBeLessThan(data.views[1].x);
  });

  it('子Objectは親Objectの下の行に配置される', () => {
    const data = {
      objects: [
        { id: 'parent', name: 'Parent', relations: [{ id: 'r1', targetId: 'child', type: 'has-many' }] },
        { id: 'child', name: 'Child', relations: [] },
      ],
      views: [
        { id: 'v1', objectId: 'parent', type: 'collection', fields: [], verbs: [] },
        { id: 'v2', objectId: 'child', type: 'collection', fields: [], verbs: [] },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    // childのY座標がparentより下
    expect(data.views[1].y).toBeGreaterThan(data.views[0].y);
  });

  it('サブPaneがメインの下に配置される', () => {
    const data = {
      objects: [{ id: 'a', name: 'A', relations: [] }],
      views: [
        { id: 'v1', objectId: 'a', type: 'collection', fields: ['x'], verbs: [] },
        { id: 'v2', objectId: 'a', type: 'single', fields: ['x'], verbs: [] },
        { id: 'v3', objectId: 'a', type: 'collection', fields: ['x'], verbs: [] },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    // v1,v2はメイン（横並び）、v3はサブ（下）
    expect(data.views[0].y).toBe(data.views[1].y);
    expect(data.views[2].y).toBeGreaterThan(data.views[0].y);
    // サブはメインの左端に揃う
    expect(data.views[2].x).toBe(data.views[0].x);
  });

  it('ノードの実際の高さに基づいて間隔が空く', () => {
    const data = {
      objects: [
        { id: 'a', name: 'A', relations: [{ id: 'r1', targetId: 'b', type: 'has-many' }] },
        { id: 'b', name: 'B', relations: [] },
      ],
      views: [
        { id: 'v1', objectId: 'a', type: 'collection', fields: ['f1','f2','f3','f4','f5'], verbs: ['v1','v2','v3'] },
        { id: 'v2', objectId: 'b', type: 'collection', fields: ['f1'], verbs: [] },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    const h1 = _calcPaneHeight(data.views[0]);
    // 子の行のY座標 = 親のY + 親の高さ + gapY
    expect(data.views[1].y).toBe(data.views[0].y + h1 + DEFAULT_CONFIG.gapY);
  });

  it('循環参照でも無限ループせず配置できる', () => {
    const data = {
      objects: [
        { id: 'a', name: 'A', relations: [{ id: 'r1', targetId: 'b', type: 'has-many' }] },
        { id: 'b', name: 'B', relations: [{ id: 'r2', targetId: 'a', type: 'has-many' }] },
      ],
      views: [
        { id: 'v1', objectId: 'a', type: 'collection', fields: [], verbs: [] },
        { id: 'v2', objectId: 'b', type: 'collection', fields: [], verbs: [] },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    expect(typeof data.views[0].x).toBe('number');
    expect(typeof data.views[1].x).toBe('number');
  });

  it('3階層以上で行が分かれる', () => {
    const data = {
      objects: [
        { id: 'gp', name: 'GP', relations: [{ id: 'r1', targetId: 'p', type: 'has-many' }] },
        { id: 'p', name: 'P', relations: [{ id: 'r2', targetId: 'c', type: 'has-many' }] },
        { id: 'c', name: 'C', relations: [] },
      ],
      views: [
        { id: 'v1', objectId: 'gp', type: 'collection', fields: [], verbs: [] },
        { id: 'v2', objectId: 'p', type: 'collection', fields: [], verbs: [] },
        { id: 'v3', objectId: 'c', type: 'collection', fields: [], verbs: [] },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    // Y座標で3行に分かれる
    expect(data.views[0].y).toBeLessThan(data.views[1].y);
    expect(data.views[1].y).toBeLessThan(data.views[2].y);
  });

  it('objectsがない場合でもPaneを配置できる', () => {
    const data = {
      views: [
        { id: 'v1', objectId: 'a', type: 'collection', fields: [], verbs: [] },
        { id: 'v2', objectId: 'b', type: 'single', fields: [], verbs: [] },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    // 同じ深さなので同じ行、横に並ぶ
    expect(data.views[0].y).toBe(data.views[1].y);
    expect(data.views[0].x).toBeLessThan(data.views[1].x);
  });
});

describe('splitMainSub', () => {
  it('最初のcollectionとsingleがメイン、残りがサブ', () => {
    const panes = [
      { id: 'v1', type: 'collection' },
      { id: 'v2', type: 'single' },
      { id: 'v3', type: 'collection' },
    ];
    const result = _splitMainSub(panes);
    expect(result.main.map(p => p.id)).toEqual(['v1', 'v2']);
    expect(result.sub.map(p => p.id)).toEqual(['v3']);
  });

  it('サブがない場合は空配列', () => {
    const panes = [
      { id: 'v1', type: 'collection' },
      { id: 'v2', type: 'single' },
    ];
    const result = _splitMainSub(panes);
    expect(result.main.map(p => p.id)).toEqual(['v1', 'v2']);
    expect(result.sub).toEqual([]);
  });
});

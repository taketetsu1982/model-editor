import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ensureViewPositions, _splitMainSub } = require('./view-logic.js');

const DEFAULT_CONFIG = {
  cols: 3, gapX: 280, gapY: 220, padX: 60, padY: 60,
  minSpanFactor: 160, minSpanMin: 200,
};

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
    expect(data.views[0].x).toBe(10);
    expect(data.views[0].y).toBe(20);
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

  it('同じobjectIdのメインPaneを縦に並べる', () => {
    const data = {
      objects: [{ id: 'task', name: 'Task', relations: [] }],
      views: [
        { id: 'v1', objectId: 'task', type: 'collection' },
        { id: 'v2', objectId: 'task', type: 'single' },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    expect(data.views[0].x).toBe(data.views[1].x);
    expect(data.views[0].y).toBeLessThan(data.views[1].y);
  });

  it('objectの階層順で列を配置する', () => {
    const data = {
      objects: [
        { id: 'parent', name: 'Parent', relations: [
          { id: 'r1', targetId: 'child', type: 'has-many' },
        ]},
        { id: 'child', name: 'Child', relations: [] },
      ],
      views: [
        { id: 'v1', objectId: 'parent', type: 'collection' },
        { id: 'v2', objectId: 'child', type: 'collection' },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    expect(data.views[0].x).toBeLessThan(data.views[1].x);
  });

  it('サブPaneがメインPaneより下にギャップ付きで配置される', () => {
    const data = {
      objects: [{ id: 'a', name: 'A', relations: [] }],
      views: [
        { id: 'v1', objectId: 'a', type: 'collection' },
        { id: 'v2', objectId: 'a', type: 'single' },
        { id: 'v3', objectId: 'a', type: 'collection' },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    // v1=メインcollection, v2=メインsingle, v3=サブ（2つ目のcollection）
    // メインとサブの間にギャップがある
    const mainBottomY = data.views[1].y;
    const subY = data.views[2].y;
    const normalGap = DEFAULT_CONFIG.gapY;
    expect(subY - mainBottomY).toBeGreaterThan(normalGap);
  });

  it('サブPaneの開始Y座標が全列で揃う', () => {
    const data = {
      objects: [
        { id: 'a', name: 'A', relations: [{ id: 'r1', targetId: 'b', type: 'has-many' }] },
        { id: 'b', name: 'B', relations: [] },
      ],
      views: [
        { id: 'v1', objectId: 'a', type: 'collection' },
        { id: 'v2', objectId: 'a', type: 'single' },
        { id: 'v3', objectId: 'a', type: 'collection' },
        { id: 'v4', objectId: 'b', type: 'collection' },
        { id: 'v5', objectId: 'b', type: 'collection' },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    // v3（aのサブ）とv5（bのサブ）のY座標が同じ
    expect(data.views[2].y).toBe(data.views[4].y);
  });

  it('座標未設定のPaneがあれば再配置する', () => {
    const data = {
      objects: [{ id: 'a', name: 'A', relations: [] }],
      views: [
        { id: 'v1', objectId: 'a', type: 'collection' },
        { id: 'v2', objectId: 'a', type: 'single' },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    expect(data.views[0].x).toBe(60);
    expect(data.views[0].y).toBe(60);
    expect(data.views[1].x).toBe(60);
    expect(data.views[1].y).toBe(280);
  });

  it('objectsがない場合でもPaneを配置できる', () => {
    const data = {
      views: [
        { id: 'v1', objectId: 'a', type: 'collection' },
        { id: 'v2', objectId: 'b', type: 'single' },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    expect(data.views[0].x).toBe(60);
    expect(data.views[0].y).toBe(60);
    expect(data.views[1].x).toBe(340);
    expect(data.views[1].y).toBe(60);
  });

  it('循環参照でも無限ループせず配置できる', () => {
    const data = {
      objects: [
        { id: 'a', name: 'A', relations: [{ id: 'r1', targetId: 'b', type: 'has-many' }] },
        { id: 'b', name: 'B', relations: [{ id: 'r2', targetId: 'a', type: 'has-many' }] },
      ],
      views: [
        { id: 'v1', objectId: 'a', type: 'collection' },
        { id: 'v2', objectId: 'b', type: 'collection' },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    expect(typeof data.views[0].x).toBe('number');
    expect(typeof data.views[1].x).toBe('number');
  });

  it('3階層以上のBFS伝播で列が分かれる', () => {
    const data = {
      objects: [
        { id: 'gp', name: 'GrandParent', relations: [{ id: 'r1', targetId: 'p', type: 'has-many' }] },
        { id: 'p', name: 'Parent', relations: [{ id: 'r2', targetId: 'c', type: 'has-many' }] },
        { id: 'c', name: 'Child', relations: [] },
      ],
      views: [
        { id: 'v1', objectId: 'gp', type: 'collection' },
        { id: 'v2', objectId: 'p', type: 'collection' },
        { id: 'v3', objectId: 'c', type: 'collection' },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    expect(data.views[0].x).toBeLessThan(data.views[1].x);
    expect(data.views[1].x).toBeLessThan(data.views[2].x);
  });

  it('objectId未設定のPaneが最右列に配置される', () => {
    const data = {
      objects: [{ id: 'a', name: 'A', relations: [] }],
      views: [
        { id: 'v1', objectId: 'a', type: 'collection' },
        { id: 'v2', type: 'collection' },
      ],
    };
    ensureViewPositions(data, DEFAULT_CONFIG);
    expect(data.views[0].x).toBeLessThan(data.views[1].x);
  });
});

describe('splitMainSub', () => {
  it('最初のcollectionとsingleがメイン、残りがサブ', () => {
    const panes = [
      { id: 'v1', type: 'collection' },
      { id: 'v2', type: 'single' },
      { id: 'v3', type: 'collection' },
      { id: 'v4', type: 'single' },
    ];
    const result = _splitMainSub(panes);
    expect(result.main.map(p => p.id)).toEqual(['v1', 'v2']);
    expect(result.sub.map(p => p.id)).toEqual(['v3', 'v4']);
  });

  it('collectionのみの場合、最初の1つだけメイン', () => {
    const panes = [
      { id: 'v1', type: 'collection' },
      { id: 'v2', type: 'collection' },
    ];
    const result = _splitMainSub(panes);
    expect(result.main.map(p => p.id)).toEqual(['v1']);
    expect(result.sub.map(p => p.id)).toEqual(['v2']);
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

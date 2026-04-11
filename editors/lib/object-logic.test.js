import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ensurePositions, circled, CIRCLED } = require('./object-logic.js');

const DEFAULT_CONFIG = {
  cols: 3, gapX: 360, gapY: 240, padX: 80, padY: 80,
};

describe('ensurePositions', () => {
  it('null/undefinedを安全に返す', () => {
    expect(ensurePositions(null, DEFAULT_CONFIG)).toBe(null);
    expect(ensurePositions(undefined, DEFAULT_CONFIG)).toBe(undefined);
  });

  it('objectsがない場合はそのまま返す', () => {
    const data = { actors: [] };
    expect(ensurePositions(data, DEFAULT_CONFIG)).toBe(data);
  });

  it('既にx/yがあるオブジェクトは上書きしない', () => {
    const data = {
      objects: [
        { id: 'a', name: 'A', x: 100, y: 200 },
      ],
    };
    ensurePositions(data, DEFAULT_CONFIG);
    expect(data.objects[0]).toMatchObject({ x: 100, y: 200 });
  });

  it('リレーションのないノードは同じ層に配置する', () => {
    const data = {
      objects: [
        { id: 'a', name: 'A', relations: [] },
        { id: 'b', name: 'B', relations: [] },
        { id: 'c', name: 'C', relations: [] },
      ],
    };
    ensurePositions(data, DEFAULT_CONFIG);
    // すべて深さ0 → 同じY座標
    expect(data.objects[0].y).toBe(80);
    expect(data.objects[1].y).toBe(80);
    expect(data.objects[2].y).toBe(80);
  });

  it('親→子のリレーションで階層配置する', () => {
    const data = {
      objects: [
        { id: 'parent', name: 'Parent', relations: [
          { id: 'r1', targetId: 'child1', type: 'has-many' },
          { id: 'r2', targetId: 'child2', type: 'has-many' },
        ]},
        { id: 'child1', name: 'Child1', relations: [] },
        { id: 'child2', name: 'Child2', relations: [
          { id: 'r3', targetId: 'grandchild', type: 'has-many' },
        ]},
        { id: 'grandchild', name: 'Grandchild', relations: [] },
      ],
    };
    ensurePositions(data, DEFAULT_CONFIG);
    // parentは深さ0
    expect(data.objects[0].y).toBe(80);
    // child1, child2は深さ1
    expect(data.objects[1].y).toBe(320);
    expect(data.objects[2].y).toBe(320);
    // grandchildは深さ2
    expect(data.objects[3].y).toBe(560);
  });

  it('自己参照はスキップする', () => {
    const data = {
      objects: [
        { id: 'a', name: 'A', relations: [
          { id: 'r1', targetId: 'a', type: 'has-many' },
          { id: 'r2', targetId: 'b', type: 'has-many' },
        ]},
        { id: 'b', name: 'B', relations: [] },
      ],
    };
    ensurePositions(data, DEFAULT_CONFIG);
    expect(data.objects[0].y).toBe(80);
    expect(data.objects[1].y).toBe(320);
  });
});

describe('circled', () => {
  it('0〜20の範囲で丸囲み数字を返す', () => {
    expect(circled(0)).toBe('⓪');
    expect(circled(1)).toBe('①');
    expect(circled(10)).toBe('⑩');
    expect(circled(20)).toBe('⑳');
  });

  it('範囲外では数字文字列を返す', () => {
    expect(circled(21)).toBe('21');
    expect(circled(100)).toBe('100');
  });
});

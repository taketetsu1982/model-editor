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

  it('x/yが未定義のオブジェクトにグリッド位置を設定する', () => {
    const data = {
      objects: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
        { id: 'd', name: 'D' },
      ],
    };
    ensurePositions(data, DEFAULT_CONFIG);
    expect(data.objects[0]).toMatchObject({ x: 80, y: 80 });
    expect(data.objects[1]).toMatchObject({ x: 440, y: 80 });
    expect(data.objects[2]).toMatchObject({ x: 800, y: 80 });
    expect(data.objects[3]).toMatchObject({ x: 80, y: 320 });
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

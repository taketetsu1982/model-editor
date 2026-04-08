import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ensureViewPositions } = require('./view-logic.js');

const DEFAULT_CONFIG = {
  cols: 3, gapX: 280, gapY: 220, padX: 60, padY: 60,
  minSpanFactor: 160, minSpanMin: 200,
};

describe('ensureViewPositions', () => {
  it('null/undefinedを安全に返す', () => {
    expect(ensureViewPositions(null, [], DEFAULT_CONFIG)).toBe(null);
    expect(ensureViewPositions(undefined, [], DEFAULT_CONFIG)).toBe(undefined);
  });

  it('viewsがない場合はそのまま返す', () => {
    const data = { transitions: [] };
    expect(ensureViewPositions(data, [], DEFAULT_CONFIG)).toBe(data);
  });

  it('actorsがnullの場合はそのまま返す', () => {
    const data = { views: [{ id: 's1', actorId: 'a1', x: 0, y: 0 }] };
    expect(ensureViewPositions(data, null, DEFAULT_CONFIG)).toBe(data);
  });

  it('1つのビューでは再配置しない', () => {
    const actors = [{ id: 'a1' }];
    const data = { views: [{ id: 's1', actorId: 'a1', x: 10, y: 20 }] };
    ensureViewPositions(data, actors, DEFAULT_CONFIG);
    expect(data.views[0].x).toBe(10);
    expect(data.views[0].y).toBe(20);
  });

  it('密集したビューを再配置する', () => {
    const actors = [{ id: 'a1' }];
    const data = {
      views: [
        { id: 's1', actorId: 'a1', x: 0, y: 0 },
        { id: 's2', actorId: 'a1', x: 1, y: 1 },
        { id: 's3', actorId: 'a1', x: 2, y: 2 },
      ],
    };
    ensureViewPositions(data, actors, DEFAULT_CONFIG);
    expect(data.views[0]).toMatchObject({ x: 60, y: 60 });
    expect(data.views[1]).toMatchObject({ x: 340, y: 60 });
    expect(data.views[2]).toMatchObject({ x: 620, y: 60 });
  });

  it('十分に散らばっているビューは再配置しない', () => {
    const actors = [{ id: 'a1' }];
    const data = {
      views: [
        { id: 's1', actorId: 'a1', x: 0, y: 0 },
        { id: 's2', actorId: 'a1', x: 500, y: 500 },
      ],
    };
    ensureViewPositions(data, actors, DEFAULT_CONFIG);
    expect(data.views[0]).toMatchObject({ x: 0, y: 0 });
    expect(data.views[1]).toMatchObject({ x: 500, y: 500 });
  });
});

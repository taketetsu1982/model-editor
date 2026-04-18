import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createFileIO, validateVariants } = require('./file-io.js');

const TEST_IDS = { toast:'t', dot:'d', label:'l', hint:'h', edited:'e', autoBtn:'a', overlay:'o' };
const TEST_KEYS = { undo:'__u', redo:'__r', copy:'__c', paste:'__p', cut:'__x', del:'__d' };

function makeConfig(overrides) {
  return {
    ids: TEST_IDS,
    getFullJson: () => null,
    loadDataKey: '__test',
    keys: TEST_KEYS,
    filePickerId: 'test',
    ...overrides,
  };
}

describe('createFileIO', () => {
  it('必要なメソッドを全て返す', () => {
    const io = createFileIO(makeConfig());
    expect(typeof io.showToast).toBe('function');
    expect(typeof io.markModified).toBe('function');
    expect(typeof io.writeFile).toBe('function');
    expect(typeof io.handleConnect).toBe('function');
    expect(typeof io.toggleAuto).toBe('function');
    expect(typeof io.setupDragDrop).toBe('function');
    expect(typeof io.setupKeyboard).toBe('function');
    expect(typeof io.getFileHandle).toBe('function');
    expect(typeof io.updateStatus).toBe('function');
  });

  it('初期状態ではfileHandleがnull', () => {
    const io = createFileIO(makeConfig());
    expect(io.getFileHandle()).toBe(null);
  });
});

describe('writeFile ガードロジック', () => {
  it('fileHandleがnullの場合はfalseを返す', async () => {
    const io = createFileIO(makeConfig());
    const result = await io.writeFile();
    expect(result).toBe(false);
  });

  it('getFullJsonがnullを返す場合はfalseを返す', async () => {
    const io = createFileIO(makeConfig({ getFullJson: () => null }));
    const result = await io.writeFile();
    expect(result).toBe(false);
  });
});

describe('validateVariants', () => {
  it('_variantsキーが存在しない場合はnullを返す（通常モード）', () => {
    expect(validateVariants({})).toBe(null);
    expect(validateVariants({ objects: {}, views: {} })).toBe(null);
  });

  it('_variantsが配列でない場合はエラー文字列を返す', () => {
    expect(validateVariants({ _variants: null })).toBeTruthy();
    expect(validateVariants({ _variants: {} })).toBeTruthy();
    expect(validateVariants({ _variants: 'not-array' })).toBeTruthy();
    expect(validateVariants({ _variants: 42 })).toBeTruthy();
  });

  it('_variantsが空配列の場合はエラー文字列を返す', () => {
    expect(validateVariants({ _variants: [] })).toBeTruthy();
  });

  it('variantにidが存在しない場合はエラー文字列を返す', () => {
    const data = {
      _variants: [
        { objects: {}, views: {} }, // id なし
      ],
    };
    expect(validateVariants(data)).toBeTruthy();
  });

  it('variantにobjectsもviewsも存在しない場合はエラー文字列を返す', () => {
    const data = {
      _variants: [
        { id: 'v1' }, // objectsもviewsもなし
      ],
    };
    expect(validateVariants(data)).toBeTruthy();
  });

  it('objectsのみ存在する場合はnullを返す', () => {
    const data = {
      _variants: [
        { id: 'v1', objects: {} },
      ],
    };
    expect(validateVariants(data)).toBe(null);
  });

  it('viewsのみ存在する場合はnullを返す', () => {
    const data = {
      _variants: [
        { id: 'v1', views: {} },
      ],
    };
    expect(validateVariants(data)).toBe(null);
  });

  it('objectsとviewsの両方が存在する場合はnullを返す', () => {
    const data = {
      _variants: [
        { id: 'v1', objects: {}, views: {} },
      ],
    };
    expect(validateVariants(data)).toBe(null);
  });

  it('複数のvariantがすべて有効な場合はnullを返す', () => {
    const data = {
      _variants: [
        { id: 'v1', objects: {} },
        { id: 'v2', views: {} },
        { id: 'v3', objects: {}, views: {} },
      ],
    };
    expect(validateVariants(data)).toBe(null);
  });

  it('複数のvariantのうち1つが無効な場合はエラー文字列を返す', () => {
    const data = {
      _variants: [
        { id: 'v1', objects: {} },
        { id: 'v2' }, // objectsもviewsもなし
      ],
    };
    expect(validateVariants(data)).toBeTruthy();
  });
});

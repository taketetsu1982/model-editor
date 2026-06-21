import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createFileIO, validateVariants, detectMode, loadModelFromServer, saveModelToServer } = require('./file-io.js');

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

describe('detectMode', () => {
  it('http/https はサーバモード', () => {
    expect(detectMode('http:')).toBe('server');
    expect(detectMode('https:')).toBe('server');
  });
  it('file はファイルモード', () => {
    expect(detectMode('file:')).toBe('file');
  });
});

describe('loadModelFromServer', () => {
  it('GET /model の本文をパースし name と共に返す', async () => {
    const fetchImpl = async (url) => {
      expect(url).toBe('/model');
      return {
        ok: true,
        headers: { get: (k) => (k === 'X-Model-Name' ? 'product-model.json' : null) },
        text: async () => '{"objects":{"a":{}},"views":{}}',
      };
    };
    const result = await loadModelFromServer(fetchImpl);
    expect(result.name).toBe('product-model.json');
    expect(result.data.objects.a).toEqual({});
  });
  it('レスポンスが ok でなければ例外', async () => {
    const fetchImpl = async () => ({ ok: false, status: 500 });
    await expect(loadModelFromServer(fetchImpl)).rejects.toThrow();
  });
});

describe('saveModelToServer', () => {
  it('PUT /model に整形JSONを送り ok を返す', async () => {
    let captured = null;
    const fetchImpl = async (url, opts) => {
      captured = { url, opts };
      return { ok: true };
    };
    const ok = await saveModelToServer({ objects: {}, views: {} }, fetchImpl);
    expect(ok).toBe(true);
    expect(captured.url).toBe('/model');
    expect(captured.opts.method).toBe('PUT');
    expect(captured.opts.body).toBe(JSON.stringify({ objects: {}, views: {} }, null, 2) + '\n');
  });
  it('ok でなければ false', async () => {
    const ok = await saveModelToServer({}, async () => ({ ok: false }));
    expect(ok).toBe(false);
  });
});

// 最小DOMスタブ: updateStatus等が参照する要素を用意する
function withDomStub(fn) {
  const store = {};
  const make = () => ({ className: '', textContent: '', style: {}, classList: { add(){}, remove(){}, toggle(){} } });
  global.document = { getElementById: (id) => (store[id] || (store[id] = make())) };
  global.window = global.window || {};
  return Promise.resolve(fn(store)).finally(() => { delete global.document; });
}

describe('createFileIO サーバモード', () => {
  it('initServerMode が /model を読み loadData を呼ぶ', async () => {
    await withDomStub(async () => {
      let loaded = null;
      global.window['__test'] = (d) => { loaded = d; };
      const io = createFileIO(makeConfig({
        loadDataKey: '__test',
        fetchImpl: async () => ({
          ok: true,
          headers: { get: () => 'product-model.json' },
          text: async () => '{"objects":{"x":{}},"views":{}}',
        }),
      }));
      await io.initServerMode();
      expect(loaded.objects.x).toEqual({});
      expect(io.isServerMode()).toBe(true);
    });
  });

  it('サーバモードの writeFile は PUT /model を呼ぶ', async () => {
    await withDomStub(async () => {
      let putCalled = false;
      const io = createFileIO(makeConfig({
        getFullJson: () => ({ objects: {}, views: {} }),
        fetchImpl: async (url, opts) => {
          if (opts && opts.method === 'PUT') { putCalled = true; return { ok: true }; }
          return { ok: true, headers: { get: () => 'm.json' }, text: async () => '{"objects":{},"views":{}}' };
        },
      }));
      await io.initServerMode();
      const ok = await io.writeFile();
      expect(ok).toBe(true);
      expect(putCalled).toBe(true);
    });
  });
});

describe('loadModelFromServer 追加', () => {
  it('不正なJSON本文は parse failed で例外', async () => {
    const fetchImpl = async () => ({
      ok: true,
      headers: { get: () => 'm.json' },
      text: async () => 'not json',
    });
    await expect(loadModelFromServer(fetchImpl)).rejects.toThrow(/parse/i);
  });
  it('X-Model-Name ヘッダが無ければ product-model.json にフォールバック', async () => {
    const fetchImpl = async () => ({
      ok: true,
      headers: { get: () => null },
      text: async () => '{"objects":{},"views":{}}',
    });
    const result = await loadModelFromServer(fetchImpl);
    expect(result.name).toBe('product-model.json');
  });
});

describe('initServerMode フォールバック', () => {
  it('fetchが!okならサーバモードに入らない', async () => {
    await withDomStub(async () => {
      const io = createFileIO(makeConfig({
        loadDataKey: '__test_noenter',
        fetchImpl: async () => ({ ok: false, status: 500 }),
      }));
      await io.initServerMode();
      expect(io.isServerMode()).toBe(false);
    });
  });
  it('fetch失敗時はファイルを開くフォールバックへ誘導する（ヒント表示）', async () => {
    await withDomStub(async (store) => {
      const io = createFileIO(makeConfig({
        loadDataKey: '__test_fb_hint',
        fetchImpl: async () => ({ ok: false, status: 500 }),
      }));
      await io.initServerMode();
      expect(io.isServerMode()).toBe(false);
      // Connectボタンのヒントがファイルを開く導線を示す
      expect(store[TEST_IDS.hint].textContent).toMatch(/ファイル/);
    });
  });
  it('loadDataコールバック未登録ならサーバモードに入らない（空モデル誤上書き防止）', async () => {
    await withDomStub(async () => {
      // window['__test_unreg'] は登録しない
      const io = createFileIO(makeConfig({
        loadDataKey: '__test_unreg',
        fetchImpl: async () => ({
          ok: true, headers: { get: () => 'm.json' }, text: async () => '{"objects":{},"views":{}}',
        }),
      }));
      await io.initServerMode();
      expect(io.isServerMode()).toBe(false);
    });
  });
});

describe('サーバモード autosave スケジューリング', () => {
  it('markModified から debounce 後に PUT が発火する', async () => {
    await withDomStub(async () => {
      let putCount = 0;
      const io = createFileIO(makeConfig({
        loadDataKey: '__test_sched',
        getFullJson: () => ({ objects: {}, views: {} }),
        fetchImpl: async (url, opts) => {
          if (opts && opts.method === 'PUT') { putCount++; return { ok: true }; }
          return { ok: true, headers: { get: () => 'm.json' }, text: async () => '{"objects":{},"views":{}}' };
        },
      }));
      global.window['__test_sched'] = () => {};
      await io.initServerMode();
      vi.useFakeTimers();
      io.markModified();
      await vi.advanceTimersByTimeAsync(600);
      vi.useRealTimers();
      expect(putCount).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('サーバモード writeFile 失敗', () => {
  it('PUTがrejectしてもwriteFileはfalseを返す（未処理rejectにしない）', async () => {
    await withDomStub(async () => {
      const io = createFileIO(makeConfig({
        loadDataKey: '__test_rej',
        getFullJson: () => ({ objects: {}, views: {} }),
        fetchImpl: async (url, opts) => {
          if (opts && opts.method === 'PUT') throw new Error('network down');
          return { ok: true, headers: { get: () => 'm.json' }, text: async () => '{"objects":{},"views":{}}' };
        },
      }));
      global.window['__test_rej'] = () => {};
      await io.initServerMode();
      const ok = await io.writeFile();
      expect(ok).toBe(false);
    });
  });
});

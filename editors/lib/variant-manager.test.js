import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
  isVariantMode,
  toVariantMode,
  getActiveVariant,
  switchVariant,
  keepVariant,
  deleteVariant,
  renameVariant,
  getVariantList,
  updateVariantData,
} = require('./variant-manager.js');

// テスト用のサンプルモデルデータ
const SAMPLE_MODEL = {
  devices: ['desktop', 'mobile'],
  objects: [{ id: 'obj1', name: 'ユーザー' }],
  views: [{ id: 'v1', name: 'View1' }],
  paneGraph: { nodes: [], edges: [] },
  screens: [{ id: 's1', name: 'Screen1' }],
};

describe('isVariantMode', () => {
  it('_variantsが空でない配列であればtrueを返す', () => {
    const data = { _variants: [{ id: 'a', name: 'Option A', active: true }] };
    expect(isVariantMode(data)).toBe(true);
  });

  it('_variantsが存在しなければfalseを返す', () => {
    expect(isVariantMode(SAMPLE_MODEL)).toBe(false);
  });

  it('_variantsが空配列であればfalseを返す', () => {
    expect(isVariantMode({ _variants: [] })).toBe(false);
  });

  it('_variantsがnullであればfalseを返す', () => {
    expect(isVariantMode({ _variants: null })).toBe(false);
  });

  it('_variantsが配列でなければfalseを返す', () => {
    expect(isVariantMode({ _variants: {} })).toBe(false);
  });
});

describe('toVariantMode — 通常モードからの変換', () => {
  it('_variantsに2つのエントリが作られる', () => {
    const result = toVariantMode(SAMPLE_MODEL);
    expect(result._variants).toHaveLength(2);
  });

  it('1つ目のエントリはOption Aでactive: true', () => {
    const result = toVariantMode(SAMPLE_MODEL);
    const varA = result._variants[0];
    expect(varA.id).toBe('a');
    expect(varA.name).toBe('Option A');
    expect(varA.active).toBe(true);
  });

  it('2つ目のエントリはOption Bでactive: false', () => {
    const result = toVariantMode(SAMPLE_MODEL);
    const varB = result._variants[1];
    expect(varB.id).toBe('b');
    expect(varB.name).toBe('Option B');
    expect(varB.active).toBe(false);
  });

  it('各バリアントにモデルキーが含まれる', () => {
    const result = toVariantMode(SAMPLE_MODEL);
    for (const v of result._variants) {
      expect(v).toHaveProperty('objects');
      expect(v).toHaveProperty('views');
      expect(v).toHaveProperty('paneGraph');
      expect(v).toHaveProperty('screens');
    }
  });

  it('パススルーキー（devices）が_variantsの外に保持される', () => {
    const result = toVariantMode(SAMPLE_MODEL);
    expect(result.devices).toEqual(['desktop', 'mobile']);
  });

  it('トップレベルのモデルキーは_variantsの外に存在しない', () => {
    const result = toVariantMode(SAMPLE_MODEL);
    expect(result).not.toHaveProperty('objects');
    expect(result).not.toHaveProperty('views');
    expect(result).not.toHaveProperty('paneGraph');
    expect(result).not.toHaveProperty('screens');
  });

  it('モデルデータはディープコピーされる（参照共有なし）', () => {
    const result = toVariantMode(SAMPLE_MODEL);
    const varA = result._variants[0];
    const varB = result._variants[1];
    // 同じ内容だが別オブジェクト
    expect(varA.objects).not.toBe(varB.objects);
    expect(varA.objects).not.toBe(SAMPLE_MODEL.objects);
  });

  it('元のデータは変更されない', () => {
    const original = JSON.parse(JSON.stringify(SAMPLE_MODEL));
    toVariantMode(SAMPLE_MODEL);
    expect(SAMPLE_MODEL).toEqual(original);
  });
});

describe('toVariantMode — バリアントモードからの追加', () => {
  function makeVariantData() {
    return {
      devices: ['desktop'],
      _variants: [
        {
          id: 'a', name: 'Option A', active: true,
          objects: [{ id: 'o1', name: 'A-Object' }],
          views: [], paneGraph: { nodes: [], edges: [] }, screens: [],
        },
        {
          id: 'b', name: 'Option B', active: false,
          objects: [{ id: 'o2', name: 'B-Object' }],
          views: [], paneGraph: { nodes: [], edges: [] }, screens: [],
        },
      ],
    };
  }

  it('バリアントが1つ追加されて合計3つになる', () => {
    const data = makeVariantData();
    const result = toVariantMode(data);
    expect(result._variants).toHaveLength(3);
  });

  it('追加されたバリアントはOption Cでactive: false', () => {
    const data = makeVariantData();
    const result = toVariantMode(data);
    const varC = result._variants[2];
    expect(varC.id).toBe('c');
    expect(varC.name).toBe('Option C');
    expect(varC.active).toBe(false);
  });

  it('追加バリアントのデータはアクティブなバリアントのコピー', () => {
    const data = makeVariantData();
    const result = toVariantMode(data);
    const varC = result._variants[2];
    expect(varC.objects).toEqual([{ id: 'o1', name: 'A-Object' }]);
  });

  it('追加バリアントはディープコピーされる', () => {
    const data = makeVariantData();
    const result = toVariantMode(data);
    const varC = result._variants[2];
    // アクティブバリアントのオブジェクトとは別参照
    expect(varC.objects).not.toBe(result._variants[0].objects);
  });

  it('既存のバリアントは変更されない', () => {
    const data = makeVariantData();
    const result = toVariantMode(data);
    expect(result._variants[0].active).toBe(true);
    expect(result._variants[1].active).toBe(false);
  });

  it('パススルーキーは保持される', () => {
    const data = makeVariantData();
    const result = toVariantMode(data);
    expect(result.devices).toEqual(['desktop']);
  });
});

describe('getActiveVariant', () => {
  it('active: trueのバリアントを返す', () => {
    const data = {
      _variants: [
        { id: 'a', name: 'Option A', active: false },
        { id: 'b', name: 'Option B', active: true },
      ],
    };
    const active = getActiveVariant(data);
    expect(active.id).toBe('b');
  });

  it('active: trueがなければ最初のバリアントを返す', () => {
    const data = {
      _variants: [
        { id: 'a', name: 'Option A', active: false },
        { id: 'b', name: 'Option B', active: false },
      ],
    };
    const active = getActiveVariant(data);
    expect(active.id).toBe('a');
  });

  it('バリアントが1つのときはそれを返す', () => {
    const data = {
      _variants: [{ id: 'a', name: 'Option A', active: true }],
    };
    expect(getActiveVariant(data).id).toBe('a');
  });
});

describe('switchVariant', () => {
  function makeData() {
    return {
      _variants: [
        { id: 'a', name: 'Option A', active: true },
        { id: 'b', name: 'Option B', active: false },
        { id: 'c', name: 'Option C', active: false },
      ],
    };
  }

  it('指定したIDのバリアントをactiveにする', () => {
    const result = switchVariant(makeData(), 'b');
    expect(result._variants.find(v => v.id === 'b').active).toBe(true);
  });

  it('他のバリアントのactiveはfalseになる', () => {
    const result = switchVariant(makeData(), 'b');
    expect(result._variants.find(v => v.id === 'a').active).toBe(false);
    expect(result._variants.find(v => v.id === 'c').active).toBe(false);
  });

  it('元のデータは変更されない（イミュータブル）', () => {
    const data = makeData();
    switchVariant(data, 'b');
    // 元データのaはまだactiveのまま
    expect(data._variants[0].active).toBe(true);
  });

  it('存在しないIDを指定すると全バリアントがinactiveになる', () => {
    const result = switchVariant(makeData(), 'z');
    for (const v of result._variants) {
      expect(v.active).toBe(false);
    }
  });
});

// ─── テスト用ヘルパー ───────────────────────────────────────────────────
function makeVariantData() {
  return {
    devices: ['desktop', 'mobile'],
    _variants: [
      {
        id: 'a', name: 'Option A', active: true,
        objects: [{ id: 'obj1', name: 'A-Object' }],
        views: [{ id: 'v1', name: 'A-View' }],
        paneGraph: { nodes: ['n1'], edges: [] },
        screens: [{ id: 's1', name: 'A-Screen' }],
      },
      {
        id: 'b', name: 'Option B', active: false,
        objects: [{ id: 'obj2', name: 'B-Object' }],
        views: [{ id: 'v2', name: 'B-View' }],
        paneGraph: { nodes: ['n2'], edges: [] },
        screens: [{ id: 's2', name: 'B-Screen' }],
      },
      {
        id: 'c', name: 'Option C', active: false,
        objects: [{ id: 'obj3', name: 'C-Object' }],
        views: [],
        paneGraph: { nodes: [], edges: [] },
        screens: [],
      },
    ],
  };
}

describe('keepVariant', () => {
  it('指定バリアントのモデルデータがトップレベルに昇格する', () => {
    const data = makeVariantData();
    const result = keepVariant(data, 'b');
    expect(result.objects).toEqual([{ id: 'obj2', name: 'B-Object' }]);
    expect(result.views).toEqual([{ id: 'v2', name: 'B-View' }]);
    expect(result.screens).toEqual([{ id: 's2', name: 'B-Screen' }]);
  });

  it('_variants キーが除去される', () => {
    const result = keepVariant(makeVariantData(), 'a');
    expect(result).not.toHaveProperty('_variants');
  });

  it('パススルーキー（devices）が保持される', () => {
    const result = keepVariant(makeVariantData(), 'a');
    expect(result.devices).toEqual(['desktop', 'mobile']);
  });

  it('モデルデータはディープコピーされる（元データ参照なし）', () => {
    const data = makeVariantData();
    const result = keepVariant(data, 'a');
    expect(result.objects).not.toBe(data._variants[0].objects);
  });

  it('元のデータは変更されない（イミュータブル）', () => {
    const data = makeVariantData();
    const original = JSON.parse(JSON.stringify(data));
    keepVariant(data, 'a');
    expect(data).toEqual(original);
  });

  it('存在しないIDを指定するとアクティブバリアントが採用される', () => {
    const data = makeVariantData(); // 'a' がアクティブ
    const result = keepVariant(data, 'z');
    expect(result.objects).toEqual([{ id: 'obj1', name: 'A-Object' }]);
  });
});

describe('deleteVariant', () => {
  it('指定バリアントが削除される', () => {
    const data = makeVariantData();
    const result = deleteVariant(data, 'c');
    expect(result._variants).toHaveLength(2);
    expect(result._variants.find(v => v.id === 'c')).toBeUndefined();
  });

  it('削除後に2つ残る場合はバリアントモードのまま', () => {
    const data = makeVariantData();
    const result = deleteVariant(data, 'c');
    expect(isVariantMode(result)).toBe(true);
  });

  it('削除したバリアントがアクティブでなければアクティブ状態は変わらない', () => {
    const data = makeVariantData(); // 'a' がアクティブ
    const result = deleteVariant(data, 'b');
    expect(result._variants.find(v => v.id === 'a').active).toBe(true);
  });

  it('削除したバリアントがアクティブだった場合は先頭が新たにアクティブになる', () => {
    const data = makeVariantData(); // 'a' がアクティブ
    const result = deleteVariant(data, 'a');
    // 'a' が削除されて 'b' が先頭になりアクティブになる
    expect(result._variants[0].id).toBe('b');
    expect(result._variants[0].active).toBe(true);
  });

  it('削除後に1つだけ残った場合は通常モードに自動解決する', () => {
    // バリアントが2つのデータを作る
    const data = {
      devices: ['desktop'],
      _variants: [
        {
          id: 'a', name: 'Option A', active: true,
          objects: [{ id: 'obj1' }], views: [], paneGraph: {}, screens: [],
        },
        {
          id: 'b', name: 'Option B', active: false,
          objects: [{ id: 'obj2' }], views: [], paneGraph: {}, screens: [],
        },
      ],
    };
    const result = deleteVariant(data, 'b');
    // 通常モードになる
    expect(isVariantMode(result)).toBe(false);
    expect(result).not.toHaveProperty('_variants');
    // 残ったバリアント 'a' のデータが昇格する
    expect(result.objects).toEqual([{ id: 'obj1' }]);
    expect(result.devices).toEqual(['desktop']);
  });

  it('バリアントが1つしかない場合は削除できず元データを返す', () => {
    const data = {
      _variants: [
        { id: 'a', name: 'Option A', active: true, objects: [], views: [], paneGraph: {}, screens: [] },
      ],
    };
    const result = deleteVariant(data, 'a');
    expect(result).toBe(data); // 同一参照
  });

  it('元のデータは変更されない（イミュータブル）', () => {
    const data = makeVariantData();
    const original = JSON.parse(JSON.stringify(data));
    deleteVariant(data, 'c');
    expect(data).toEqual(original);
  });
});

describe('renameVariant', () => {
  it('指定バリアントの名前が変更される', () => {
    const data = makeVariantData();
    const result = renameVariant(data, 'b', 'カスタムB');
    expect(result._variants.find(v => v.id === 'b').name).toBe('カスタムB');
  });

  it('他のバリアントの名前は変わらない', () => {
    const data = makeVariantData();
    const result = renameVariant(data, 'b', 'カスタムB');
    expect(result._variants.find(v => v.id === 'a').name).toBe('Option A');
    expect(result._variants.find(v => v.id === 'c').name).toBe('Option C');
  });

  it('元のデータは変更されない（イミュータブル）', () => {
    const data = makeVariantData();
    renameVariant(data, 'b', 'カスタムB');
    expect(data._variants.find(v => v.id === 'b').name).toBe('Option B');
  });

  it('存在しないIDを指定してもエラーにならずデータが返る', () => {
    const data = makeVariantData();
    const result = renameVariant(data, 'z', '新名前');
    // 変更なし
    expect(result._variants).toHaveLength(data._variants.length);
  });
});

describe('getVariantList', () => {
  it('バリアントモードのとき {id, name, active} の配列を返す', () => {
    const data = makeVariantData();
    const list = getVariantList(data);
    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({ id: 'a', name: 'Option A', active: true });
    expect(list[1]).toEqual({ id: 'b', name: 'Option B', active: false });
    expect(list[2]).toEqual({ id: 'c', name: 'Option C', active: false });
  });

  it('active は常に boolean（undefined や null にならない）', () => {
    const data = {
      _variants: [
        { id: 'a', name: 'Option A' }, // active プロパティなし
        { id: 'b', name: 'Option B', active: false },
      ],
    };
    const list = getVariantList(data);
    expect(typeof list[0].active).toBe('boolean');
    expect(list[0].active).toBe(false);
  });

  it('通常モードのときは空配列を返す', () => {
    expect(getVariantList({ objects: [], views: [] })).toEqual([]);
  });

  it('_variants が空配列のときは空配列を返す', () => {
    expect(getVariantList({ _variants: [] })).toEqual([]);
  });

  it('返り値はモデルデータのその他キーを含まない（id/name/activeのみ）', () => {
    const data = makeVariantData();
    const list = getVariantList(data);
    for (const item of list) {
      expect(Object.keys(item).sort()).toEqual(['active', 'id', 'name']);
    }
  });
});

describe('updateVariantData', () => {
  it('指定バリアントのデータが更新される', () => {
    const data = makeVariantData();
    const newObjects = [{ id: 'obj99', name: '新Object' }];
    const result = updateVariantData(data, 'a', { objects: newObjects });
    expect(result._variants.find(v => v.id === 'a').objects).toEqual(newObjects);
  });

  it('他のバリアントは変更されない', () => {
    const data = makeVariantData();
    const result = updateVariantData(data, 'a', { objects: [] });
    const varB = result._variants.find(v => v.id === 'b');
    expect(varB.objects).toEqual([{ id: 'obj2', name: 'B-Object' }]);
  });

  it('既存キーを上書きできる', () => {
    const data = makeVariantData();
    const result = updateVariantData(data, 'b', { name: '上書きB' });
    expect(result._variants.find(v => v.id === 'b').name).toBe('上書きB');
  });

  it('新しいキーを追加できる', () => {
    const data = makeVariantData();
    const result = updateVariantData(data, 'c', { customField: 'hello' });
    expect(result._variants.find(v => v.id === 'c').customField).toBe('hello');
  });

  it('元のデータは変更されない（イミュータブル）', () => {
    const data = makeVariantData();
    const original = JSON.parse(JSON.stringify(data));
    updateVariantData(data, 'a', { objects: [] });
    expect(data).toEqual(original);
  });

  it('存在しないIDを指定してもエラーにならずデータが返る', () => {
    const data = makeVariantData();
    const result = updateVariantData(data, 'z', { objects: [] });
    expect(result._variants).toHaveLength(data._variants.length);
  });
});

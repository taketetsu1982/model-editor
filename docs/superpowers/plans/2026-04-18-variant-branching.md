# バリアント分岐機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** エディタ上でモデルの複数案（バリアント）を分岐・比較・採用できる機能を実装する

**Architecture:** `editors/lib/variant-manager.js` にバリアントの状態管理ロジック（Duplicate/Keep/Delete/Switch/Split）を集約し、`editors/lib/ui-components.js` にサブタブバーUIコンポーネントを追加。`editors/editor.html` の App コンポーネントでそれらを統合する。既存の `useHistory` フックはバリアント対応に拡張し、各履歴エントリにバリアントIDを記録する。

**Tech Stack:** React 18（CDN）、Babel（JSXトランスパイル）、Vitest（テスト）

**参照Spec:** `docs/superpowers/specs/2026-04-18-variant-branching-design.md`

---

## ファイル構成

| ファイル | 役割 | 変更種別 |
|----------|------|---------|
| `editors/lib/variant-manager.js` | バリアントの状態管理（純粋関数） | 新規作成 |
| `editors/lib/variant-manager.test.js` | variant-managerのテスト | 新規作成 |
| `editors/lib/ui-components.js` | サブタブバーUIコンポーネント追加、useHistory拡張 | 修正 |
| `editors/lib/ui-components.test.js` | UIコンポーネントのテスト | 新規作成 |
| `editors/lib/file-io.js` | `_variants` の読み書き対応 | 修正 |
| `editors/lib/file-io.test.js` | file-ioテスト追加 | 修正 |
| `editors/editor.html` | App統合（サブタブバー、Split View、データフロー） | 修正 |
| `editors/lib/editor-base.css` | サブタブバー・Split ViewのCSS | 修正 |

---

### Task 1: variant-manager — 基本データ操作（純粋関数）

**Files:**
- Create: `editors/lib/variant-manager.js`
- Create: `editors/lib/variant-manager.test.js`

- [ ] **Step 1: テストファイルのセットアップと最初のテスト（isVariantMode）を書く**

```js
// editors/lib/variant-manager.test.js
import { describe, it, expect } from 'vitest';
import { isVariantMode, toVariantMode, getActiveVariant, switchVariant } from './variant-manager.js';

describe('isVariantMode', () => {
  it('_variantsがなければfalse', () => {
    expect(isVariantMode({ objects: [], views: [], paneGraph: [], screens: [] })).toBe(false);
  });
  it('_variantsがあればtrue', () => {
    expect(isVariantMode({ _variants: [{ id: 'a', name: 'Option A', active: true, objects: [], views: [], paneGraph: [], screens: {} }] })).toBe(true);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run editors/lib/variant-manager.test.js`
Expected: FAIL — モジュールが存在しない

- [ ] **Step 3: variant-manager.js を作成して isVariantMode を実装**

```js
// editors/lib/variant-manager.js — バリアント管理の純粋関数
(function(exports) {

  // _variants配列が存在するか判定
  exports.isVariantMode = function(data) {
    return Array.isArray(data._variants) && data._variants.length > 0;
  };

})(typeof module !== 'undefined' ? module.exports : (window.__variantManager = window.__variantManager || {}));
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `npx vitest run editors/lib/variant-manager.test.js`
Expected: PASS

- [ ] **Step 5: toVariantMode のテストを追加**

```js
describe('toVariantMode', () => {
  it('通常データを_variants配列に変換', () => {
    const data = { objects: [{ id: 'o1' }], views: [{ id: 'v1' }], paneGraph: [{ id: 'pg1' }], screens: [{ id: 's1' }], devices: ['mobile'] };
    const result = toVariantMode(data);
    expect(result._variants).toHaveLength(2);
    expect(result._variants[0].id).toBe('a');
    expect(result._variants[0].name).toBe('Option A');
    expect(result._variants[0].active).toBe(true);
    expect(result._variants[0].objects).toEqual([{ id: 'o1' }]);
    expect(result._variants[1].id).toBe('b');
    expect(result._variants[1].name).toBe('Option B');
    expect(result._variants[1].active).toBeUndefined();
    expect(result._variants[1].objects).toEqual([{ id: 'o1' }]);
    // トップレベルのキーは消えている
    expect(result.objects).toBeUndefined();
    expect(result.views).toBeUndefined();
    // passthroughキーは保持される
    expect(result.devices).toEqual(['mobile']);
  });
  it('すでにvariantモードなら現在のアクティブをコピー', () => {
    const data = { _variants: [
      { id: 'a', name: 'Option A', active: true, objects: [{ id: 'o1' }], views: [], paneGraph: [], screens: [] },
    ] };
    const result = toVariantMode(data);
    expect(result._variants).toHaveLength(2);
    expect(result._variants[1].name).toBe('Option B');
    expect(result._variants[1].objects).toEqual([{ id: 'o1' }]);
  });
});
```

- [ ] **Step 6: toVariantMode を実装**

```js
  // 次のバリアントIDを生成（a, b, c, ...）
  function nextVariantId(variants) {
    var ids = variants.map(function(v) { return v.id; });
    for (var i = 0; i < 26; i++) {
      var id = String.fromCharCode(97 + i);
      if (ids.indexOf(id) === -1) return id;
    }
    return 'v' + Date.now();
  }

  // 次のバリアント名を生成（Option A, Option B, ...）
  function nextVariantName(variants) {
    var id = nextVariantId(variants);
    return 'Option ' + id.toUpperCase();
  }

  var MODEL_KEYS = ['objects', 'views', 'paneGraph', 'screens'];

  // モデルデータからバリアント用データを抽出
  function extractModelData(source) {
    var result = {};
    MODEL_KEYS.forEach(function(key) {
      result[key] = JSON.parse(JSON.stringify(source[key] || []));
    });
    return result;
  }

  // 通常モード → バリアントモード（Duplicate操作）
  exports.toVariantMode = function(data) {
    var variants, passthrough;
    if (exports.isVariantMode(data)) {
      // すでにバリアントモード: アクティブをコピーして追加
      var active = data._variants.find(function(v) { return v.active; }) || data._variants[0];
      var newId = nextVariantId(data._variants);
      var newVariant = Object.assign({ id: newId, name: 'Option ' + newId.toUpperCase() }, extractModelData(active));
      variants = data._variants.concat([newVariant]);
      passthrough = {};
      Object.keys(data).forEach(function(k) { if (k !== '_variants') passthrough[k] = data[k]; });
      return Object.assign({}, passthrough, { _variants: variants });
    }
    // 通常モード → バリアントモード
    var first = Object.assign({ id: 'a', name: 'Option A', active: true }, extractModelData(data));
    var second = Object.assign({ id: 'b', name: 'Option B' }, extractModelData(data));
    passthrough = {};
    Object.keys(data).forEach(function(k) { if (MODEL_KEYS.indexOf(k) === -1) passthrough[k] = data[k]; });
    return Object.assign({}, passthrough, { _variants: [first, second] });
  };
```

- [ ] **Step 7: テストを実行してパスを確認**

Run: `npx vitest run editors/lib/variant-manager.test.js`
Expected: PASS

- [ ] **Step 8: getActiveVariant, switchVariant のテストを追加**

```js
describe('getActiveVariant', () => {
  it('active: trueのバリアントを返す', () => {
    const data = { _variants: [
      { id: 'a', name: 'A', objects: [] },
      { id: 'b', name: 'B', active: true, objects: [{ id: 'o1' }] },
    ] };
    expect(getActiveVariant(data).id).toBe('b');
  });
  it('activeがなければ最初のバリアントを返す', () => {
    const data = { _variants: [{ id: 'a', name: 'A', objects: [] }] };
    expect(getActiveVariant(data).id).toBe('a');
  });
});

describe('switchVariant', () => {
  it('指定IDのバリアントをactiveにする', () => {
    const data = { _variants: [
      { id: 'a', name: 'A', active: true, objects: [] },
      { id: 'b', name: 'B', objects: [] },
    ] };
    const result = switchVariant(data, 'b');
    expect(result._variants[0].active).toBeUndefined();
    expect(result._variants[1].active).toBe(true);
  });
});
```

- [ ] **Step 9: getActiveVariant, switchVariant を実装**

```js
  // アクティブなバリアントを取得
  exports.getActiveVariant = function(data) {
    if (!exports.isVariantMode(data)) return null;
    return data._variants.find(function(v) { return v.active; }) || data._variants[0];
  };

  // バリアントを切り替え
  exports.switchVariant = function(data, variantId) {
    if (!exports.isVariantMode(data)) return data;
    var newVariants = data._variants.map(function(v) {
      var copy = Object.assign({}, v);
      if (v.id === variantId) { copy.active = true; }
      else { delete copy.active; }
      return copy;
    });
    return Object.assign({}, data, { _variants: newVariants });
  };
```

- [ ] **Step 10: テストを実行してパスを確認**

Run: `npx vitest run editors/lib/variant-manager.test.js`
Expected: PASS

- [ ] **Step 11: コミット**

```bash
git add editors/lib/variant-manager.js editors/lib/variant-manager.test.js
git commit -m "feat: variant-manager基本操作（isVariantMode/toVariantMode/getActive/switch）"
```

---

### Task 2: variant-manager — Keep / Delete / Rename / ヘルパー

**Files:**
- Modify: `editors/lib/variant-manager.js`
- Modify: `editors/lib/variant-manager.test.js`

- [ ] **Step 1: keepVariant のテストを追加**

```js
import { keepVariant, deleteVariant, renameVariant, getVariantList } from './variant-manager.js';

describe('keepVariant', () => {
  it('指定バリアントをトップレベルに展開し_variantsを削除', () => {
    const data = { _variants: [
      { id: 'a', name: 'A', active: true, objects: [{ id: 'o1' }], views: [{ id: 'v1' }], paneGraph: [], screens: [] },
      { id: 'b', name: 'B', objects: [{ id: 'o2' }], views: [], paneGraph: [], screens: [] },
    ], devices: ['mobile'] };
    const result = keepVariant(data, 'a');
    expect(result._variants).toBeUndefined();
    expect(result.objects).toEqual([{ id: 'o1' }]);
    expect(result.views).toEqual([{ id: 'v1' }]);
    expect(result.devices).toEqual(['mobile']);
  });
});
```

- [ ] **Step 2: テスト実行 → FAIL確認**

Run: `npx vitest run editors/lib/variant-manager.test.js`
Expected: FAIL — keepVariant未定義

- [ ] **Step 3: keepVariant を実装**

```js
  // バリアントを採用（トップレベルに展開、_variants削除）
  exports.keepVariant = function(data, variantId) {
    if (!exports.isVariantMode(data)) return data;
    var variant = data._variants.find(function(v) { return v.id === variantId; });
    if (!variant) return data;
    var result = {};
    Object.keys(data).forEach(function(k) { if (k !== '_variants') result[k] = data[k]; });
    MODEL_KEYS.forEach(function(key) { result[key] = JSON.parse(JSON.stringify(variant[key] || [])); });
    return result;
  };
```

- [ ] **Step 4: テスト実行 → PASS確認**

Run: `npx vitest run editors/lib/variant-manager.test.js`
Expected: PASS

- [ ] **Step 5: deleteVariant のテストを追加**

```js
describe('deleteVariant', () => {
  it('指定バリアントを削除', () => {
    const data = { _variants: [
      { id: 'a', name: 'A', active: true, objects: [], views: [], paneGraph: [], screens: [] },
      { id: 'b', name: 'B', objects: [], views: [], paneGraph: [], screens: [] },
      { id: 'c', name: 'C', objects: [], views: [], paneGraph: [], screens: [] },
    ] };
    const result = deleteVariant(data, 'b');
    expect(result._variants).toHaveLength(2);
    expect(result._variants.map(v => v.id)).toEqual(['a', 'c']);
  });
  it('アクティブを削除すると次のバリアントがアクティブになる', () => {
    const data = { _variants: [
      { id: 'a', name: 'A', active: true, objects: [], views: [], paneGraph: [], screens: [] },
      { id: 'b', name: 'B', objects: [], views: [], paneGraph: [], screens: [] },
    ] };
    const result = deleteVariant(data, 'a');
    expect(result._variants[0].active).toBe(true);
  });
  it('最後の1つを削除すると通常モードに戻る', () => {
    const data = { _variants: [
      { id: 'a', name: 'A', active: true, objects: [{ id: 'o1' }], views: [], paneGraph: [], screens: [] },
      { id: 'b', name: 'B', objects: [], views: [], paneGraph: [], screens: [] },
    ] };
    const result = deleteVariant(data, 'b');
    expect(result._variants).toBeUndefined();
    expect(result.objects).toEqual([{ id: 'o1' }]);
  });
});
```

- [ ] **Step 6: deleteVariant を実装**

```js
  // バリアントを削除
  exports.deleteVariant = function(data, variantId) {
    if (!exports.isVariantMode(data)) return data;
    var remaining = data._variants.filter(function(v) { return v.id !== variantId; });
    // 最後の1つになったら通常モードに戻す
    if (remaining.length <= 1) {
      var survivor = remaining[0] || data._variants[0];
      return exports.keepVariant(data, survivor.id);
    }
    // 削除対象がアクティブだった場合、次のバリアントをアクティブに
    var wasActive = data._variants.find(function(v) { return v.id === variantId && v.active; });
    if (wasActive) {
      remaining[0] = Object.assign({}, remaining[0], { active: true });
    }
    var result = {};
    Object.keys(data).forEach(function(k) { if (k !== '_variants') result[k] = data[k]; });
    result._variants = remaining;
    return result;
  };
```

- [ ] **Step 7: テスト実行 → PASS確認**

Run: `npx vitest run editors/lib/variant-manager.test.js`
Expected: PASS

- [ ] **Step 8: renameVariant, getVariantList のテストを追加**

```js
describe('renameVariant', () => {
  it('指定バリアントの名前を変更', () => {
    const data = { _variants: [
      { id: 'a', name: 'Option A', active: true, objects: [], views: [], paneGraph: [], screens: [] },
    ] };
    const result = renameVariant(data, 'a', 'リッチUI案');
    expect(result._variants[0].name).toBe('リッチUI案');
  });
});

describe('getVariantList', () => {
  it('バリアントのid/name/activeのリストを返す', () => {
    const data = { _variants: [
      { id: 'a', name: 'A', active: true, objects: [], views: [], paneGraph: [], screens: [] },
      { id: 'b', name: 'B', objects: [], views: [], paneGraph: [], screens: [] },
    ] };
    const list = getVariantList(data);
    expect(list).toEqual([
      { id: 'a', name: 'A', active: true },
      { id: 'b', name: 'B', active: false },
    ]);
  });
  it('通常モードでは空配列', () => {
    expect(getVariantList({ objects: [] })).toEqual([]);
  });
});
```

- [ ] **Step 9: renameVariant, getVariantList を実装**

```js
  // バリアント名を変更
  exports.renameVariant = function(data, variantId, newName) {
    if (!exports.isVariantMode(data)) return data;
    var newVariants = data._variants.map(function(v) {
      if (v.id === variantId) return Object.assign({}, v, { name: newName });
      return v;
    });
    return Object.assign({}, data, { _variants: newVariants });
  };

  // バリアント一覧を取得（UIリスト用）
  exports.getVariantList = function(data) {
    if (!exports.isVariantMode(data)) return [];
    return data._variants.map(function(v) {
      return { id: v.id, name: v.name, active: !!v.active };
    });
  };
```

- [ ] **Step 10: テスト実行 → PASS確認**

Run: `npx vitest run editors/lib/variant-manager.test.js`
Expected: PASS

- [ ] **Step 11: updateVariantData のテストを追加して実装**

アクティブバリアントのモデルデータを更新する関数。editor.htmlからsetModel相当の操作で使う。

```js
import { updateVariantData } from './variant-manager.js';

describe('updateVariantData', () => {
  it('アクティブバリアントのデータを更新', () => {
    const data = { _variants: [
      { id: 'a', name: 'A', active: true, objects: [{ id: 'o1' }], views: [], paneGraph: [], screens: [] },
      { id: 'b', name: 'B', objects: [], views: [], paneGraph: [], screens: [] },
    ] };
    const result = updateVariantData(data, 'a', { objects: [{ id: 'o1' }, { id: 'o2' }] });
    expect(result._variants[0].objects).toHaveLength(2);
    expect(result._variants[1].objects).toHaveLength(0);
  });
});
```

実装:

```js
  // 特定バリアントのモデルデータを部分更新
  exports.updateVariantData = function(data, variantId, updates) {
    if (!exports.isVariantMode(data)) return data;
    var newVariants = data._variants.map(function(v) {
      if (v.id === variantId) return Object.assign({}, v, updates);
      return v;
    });
    return Object.assign({}, data, { _variants: newVariants });
  };
```

- [ ] **Step 12: テスト実行 → 全テストPASS確認**

Run: `npx vitest run editors/lib/variant-manager.test.js`
Expected: PASS

- [ ] **Step 13: コミット**

```bash
git add editors/lib/variant-manager.js editors/lib/variant-manager.test.js
git commit -m "feat: variant-manager Keep/Delete/Rename/List/Update操作を追加"
```

---

### Task 3: file-io — `_variants` の読み書き対応

**Files:**
- Modify: `editors/lib/file-io.js`
- Modify: `editors/lib/file-io.test.js`

- [ ] **Step 1: file-io.test.js にバリアント検出テストを追加**

```js
// file-io.test.jsの既存テストの後に追加
describe('loadJson バリアント検出', () => {
  it('_variantsが配列ならバリアントモードとして読み込む', () => {
    const text = JSON.stringify({
      _variants: [
        { id: 'a', name: 'Option A', active: true, objects: [], views: [], paneGraph: [], screens: [] }
      ]
    });
    // loadJsonは内部関数なのでcreateFileIOのhandleConnect経由でテストが難しい
    // 代わりにvalidateVariantsをエクスポートしてテストする
  });
});
```

注意: file-io.jsの`loadJson`は内部関数のため、バリアントバリデーション用の関数 `validateVariants` を新たにexportsに追加してテストする。

- [ ] **Step 2: validateVariants のテストを書く**

```js
import { validateVariants } from './file-io.js';

describe('validateVariants', () => {
  it('正常なバリアントデータはnullを返す', () => {
    const data = { _variants: [
      { id: 'a', name: 'A', active: true, objects: [], views: [], paneGraph: [], screens: [] }
    ] };
    expect(validateVariants(data)).toBeNull();
  });
  it('_variantsが配列でなければエラー文字列を返す', () => {
    expect(validateVariants({ _variants: 'bad' })).toBeTruthy();
  });
  it('バリアントにidがなければエラー', () => {
    expect(validateVariants({ _variants: [{ name: 'A', objects: [] }] })).toBeTruthy();
  });
  it('_variantsがなければnull（通常モード）', () => {
    expect(validateVariants({ objects: [] })).toBeNull();
  });
});
```

- [ ] **Step 3: file-io.js に validateVariants を実装・エクスポート**

```js
  // バリアントデータのバリデーション（nullなら正常、文字列ならエラーメッセージ）
  exports.validateVariants = function(data) {
    if (!data._variants) return null;
    if (!Array.isArray(data._variants)) return '_variants must be an array';
    for (var i = 0; i < data._variants.length; i++) {
      var v = data._variants[i];
      if (!v.id) return '_variants[' + i + '] missing id';
      if (!Array.isArray(v.objects) && !Array.isArray(v.views)) {
        return '_variants[' + i + '] missing model data';
      }
    }
    return null;
  };
```

- [ ] **Step 4: テスト実行 → PASS確認**

Run: `npx vitest run editors/lib/file-io.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add editors/lib/file-io.js editors/lib/file-io.test.js
git commit -m "feat: file-ioに_variantsバリデーション関数を追加"
```

---

### Task 4: editor.html — splitData と getFullJson のバリアント対応

**Files:**
- Modify: `editors/editor.html` (line 42-68付近の `splitData` と `getFullJson`)

- [ ] **Step 1: splitData をバリアント対応に修正**

`editors/editor.html` の `splitData` 関数（L42）を修正。`_variants` がある場合はバリアントモードとしてそのまま返す。

修正前:
```js
function splitData(data){
  const{objects,views,paneGraph,transitions:_tr,screens:_sc,actors:_a,...rest}=data;
  passthrough=rest;
  // ... 既存のマイグレーション処理 ...
  return{objects:objs,views:vws,paneGraph:paneGraph||data.transitions||[],screens:data.screens||[],devices:data.devices||DEFAULT_DEVICES};
}
```

修正後:
```js
function splitData(data){
  // バリアントモードの場合: _variantsのバリデーション後にそのまま返す
  if(Array.isArray(data._variants)){
    const err=window.__editorIO.validateVariants(data);
    if(err){io.showToast('バリアントデータが不正です: '+err);return null;}
    // パススルーキーを保存（_variants, MODEL_KEYSを除く全キー）
    const{_variants,...rest}=data;
    passthrough=rest;
    // 各バリアント内のデータにマイグレーションを適用
    const migrated=_variants.map(v=>{
      const sub=migrateModelData(v);
      return{...v,...sub};
    });
    return{_variants:migrated};
  }
  // 通常モード（既存処理）
  const{objects,views,paneGraph,transitions:_tr,screens:_sc,actors:_a,...rest}=data;
  passthrough=rest;
  return migrateModelData({objects,views,paneGraph:paneGraph||data.transitions||[],screens:data.screens||[],devices:data.devices||DEFAULT_DEVICES});
}
```

- [ ] **Step 2: 既存のマイグレーション処理をmigrateModelData関数に抽出**

```js
function migrateModelData(raw){
  const objs=raw.objects||[];
  let migrated=false;
  objs.forEach(e=>{(e.relations||[]).forEach(r=>{if(r.type==='belongs-to'){r.type='has-many';migrated=true;}});});
  if(migrated)setTimeout(()=>io.showToast('belongs-toをhas-manyに自動変換しました'),300);
  let vwMigrated=false;
  const vws=(raw.views||[]).map(v=>{
    if(v.objects&&!v.objectId){
      vwMigrated=true;
      const first=v.objects[0];
      const{objects:_,...rest2}=v;
      return{...rest2,objectId:first?.objectId||"",type:first?.variant||v.type||"collection",fields:v.fields||[],verbs:v.verbs||[]};
    }
    return{...v,fields:v.fields||[],verbs:v.verbs||[]};
  });
  if(vwMigrated)setTimeout(()=>io.showToast('ビュースキーマを新形式に自動変換しました'),600);
  const DEFAULT_DEVICES=["mobile","desktop"];
  return{objects:objs,views:vws,paneGraph:raw.paneGraph||[],screens:raw.screens||[],devices:raw.devices||DEFAULT_DEVICES};
}
```

- [ ] **Step 3: getFullJson をバリアント対応に修正**

L68付近の`getFullJson`を修正:

修正前:
```js
getFullJson(){if(!dataRef)return null;return{...passthrough,objects:dataRef.objects,views:dataRef.views,paneGraph:dataRef.paneGraph,screens:dataRef.screens,devices:dataRef.devices};},
```

修正後:
```js
getFullJson(){
  if(!dataRef)return null;
  if(dataRef._variants){
    return{...passthrough,_variants:dataRef._variants};
  }
  return{...passthrough,objects:dataRef.objects,views:dataRef.views,paneGraph:dataRef.paneGraph,screens:dataRef.screens,devices:dataRef.devices};
},
```

- [ ] **Step 4: 手動テスト — エディタでバリアントなしのJSONを読み込めることを確認**

ブラウザで `editors/editor.html` を開き、`sample/product-model.json` を読み込んで既存動作が壊れていないことを確認。

- [ ] **Step 5: コミット**

```bash
git add editors/editor.html
git commit -m "feat: splitData/getFullJsonを_variants対応に拡張"
```

---

### Task 5: editor.html — Appにバリアント状態管理を統合

**Files:**
- Modify: `editors/editor.html` (L435付近のApp関数、L80のscriptタグ)

- [ ] **Step 1: variant-manager.js のscriptタグを追加**

L36（`<script src="./lib/ui-components.js"></script>`の前）に追加:
```html
<script src="./lib/variant-manager.js"></script>
```

- [ ] **Step 2: App関数内でvariant-managerの関数を参照**

L82付近に追加:
```js
const{isVariantMode,toVariantMode,getActiveVariant,switchVariant,keepVariant,deleteVariant,renameVariant,getVariantList,updateVariantData}=window.__variantManager;
```

- [ ] **Step 3: App内にバリアント操作ハンドラを追加**

App関数内（L437のuseHistoryの後）に以下を追加:

```js
  // バリアント操作
  const variantList=isVariantMode(model)?getVariantList(model):[];
  const activeVariant=isVariantMode(model)?getActiveVariant(model):null;
  // バリアントモードでのモデルデータ取得（アクティブバリアントのデータを返す）
  const activeModel=activeVariant||model;

  const handleDuplicate=useCallback(()=>{
    setModel(m=>toVariantMode(m));
    showToast('Duplicated');
  },[setModel]);

  const handleKeep=useCallback(()=>{
    if(!activeVariant)return;
    setModel(m=>keepVariant(m,activeVariant.id));
    showToast('Kept: '+activeVariant.name);
  },[setModel,activeVariant]);

  const handleDeleteVariant=useCallback((variantId)=>{
    setModel(m=>deleteVariant(m,variantId));
    showToast('Deleted variant');
  },[setModel]);

  const handleSwitchVariant=useCallback((variantId)=>{
    setModel(m=>switchVariant(m,variantId));
  },[setModel]);

  const handleRenameVariant=useCallback((variantId,newName)=>{
    setModel(m=>renameVariant(m,variantId,newName));
  },[setModel]);
```

- [ ] **Step 4: 子コンポーネントに渡すモデルをactiveModelに変更**

L643-646の子コンポーネント呼び出しで、`model` を `activeModel` に変更し、`setModel` をバリアント対応のラッパーに変更:

```js
  // バリアントモード時のsetModel: アクティブバリアントのデータだけ更新
  const setActiveModel=useCallback((updater)=>{
    setModel(m=>{
      if(!isVariantMode(m))return typeof updater==='function'?updater(m):updater;
      const active=getActiveVariant(m);
      const updated=typeof updater==='function'?updater(active):updater;
      return updateVariantData(m,active.id,updated);
    });
  },[setModel]);

  const effectiveSetModel=isVariantMode(model)?setActiveModel:setModel;
```

子コンポーネントには `model={activeModel}` と `setModel={effectiveSetModel}` を渡す。

- [ ] **Step 5: 手動テスト — Duplicate操作でバリアントモードに入れることをconsoleで確認**

ブラウザのコンソールで `window.__editorApp.handleDuplicate()` 等を呼んで状態遷移を確認する。（App内でrefとしてexposeが必要であれば追加）

- [ ] **Step 6: コミット**

```bash
git add editors/editor.html
git commit -m "feat: Appにバリアント状態管理を統合"
```

---

### Task 6: UIコンポーネント — サブタブバー

**Files:**
- Modify: `editors/lib/ui-components.js`
- Modify: `editors/lib/editor-base.css`

- [ ] **Step 1: editor-base.css にサブタブバーのスタイルを追加**

```css
/* --- バリアント サブタブバー --- */
.variant-bar{display:flex;align-items:center;gap:4px;padding:4px 16px;background:var(--md-sys-color-surface-container-low);border-bottom:1px solid var(--md-sys-color-outline-variant);min-height:36px}
.variant-tab{display:flex;align-items:center;gap:4px;padding:4px 12px;border-radius:var(--md-sys-shape-full);border:1px solid transparent;background:transparent;cursor:pointer;font-size:13px;font-weight:500;color:var(--md-sys-color-on-surface-variant);font-family:inherit;transition:background .15s}
.variant-tab:hover{background:var(--md-sys-color-surface-container)}
.variant-tab.active{background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);border-color:var(--md-sys-color-outline-variant)}
.variant-tab .variant-close{display:none;margin-left:4px;font-size:14px;opacity:.5;cursor:pointer;line-height:1}
.variant-tab:hover .variant-close{display:inline}
.variant-tab .variant-close:hover{opacity:1}
.variant-bar-actions{margin-left:auto;display:flex;gap:4px;align-items:center}
.variant-action-btn{padding:4px 12px;border-radius:var(--md-sys-shape-full);border:1px solid var(--md-sys-color-outline-variant);background:transparent;cursor:pointer;font-size:12px;font-weight:500;color:var(--md-sys-color-on-surface-variant);font-family:inherit;transition:background .15s}
.variant-action-btn:hover{background:var(--md-sys-color-surface-container)}
.variant-action-btn.keep{color:var(--md-sys-color-primary);border-color:var(--md-sys-color-primary)}
```

- [ ] **Step 2: ui-components.js に VariantBar コンポーネントを追加**

```js
  // バリアント サブタブバー
  // props: { variants, onSwitch, onDuplicate, onDelete, onRename, onSplit, onKeep }
  function VariantBar(props) {
    var variants = props.variants, onSwitch = props.onSwitch, onDuplicate = props.onDuplicate;
    var onDelete = props.onDelete, onRename = props.onRename, onSplit = props.onSplit, onKeep = props.onKeep;
    var editingState = useState(null), editing = editingState[0], setEditing = editingState[1];
    var editValueState = useState(''), editValue = editValueState[0], setEditValue = editValueState[1];

    function startRename(v) { setEditing(v.id); setEditValue(v.name); }
    function commitRename() {
      if (editing && editValue.trim()) { onRename(editing, editValue.trim()); }
      setEditing(null);
    }

    if (!variants || variants.length === 0) return null;

    var tabs = variants.map(function(v) {
      if (editing === v.id) {
        return h("div", { key: v.id, className: "variant-tab active" },
          h("input", {
            value: editValue, autoFocus: true,
            onChange: function(e) { setEditValue(e.target.value); },
            onBlur: commitRename,
            onKeyDown: function(e) { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(null); },
            style: { border: "none", background: "transparent", outline: "none", width: 80, fontSize: 13, fontWeight: 500, fontFamily: "inherit", color: "inherit" }
          })
        );
      }
      return h("button", {
        key: v.id,
        className: "variant-tab" + (v.active ? " active" : ""),
        onClick: function() { onSwitch(v.id); },
        onDoubleClick: function() { startRename(v); }
      },
        v.name,
        variants.length > 1 ? h("span", { className: "variant-close", onClick: function(e) { e.stopPropagation(); onDelete(v.id); } }, "×") : null
      );
    });

    return h("div", { className: "variant-bar" },
      tabs,
      h("button", { className: "variant-action-btn", onClick: onDuplicate }, "+ Duplicate"),
      h("div", { className: "variant-bar-actions" },
        variants.length >= 2 ? h("button", { className: "variant-action-btn", onClick: onSplit }, "Split") : null,
        h("button", { className: "variant-action-btn keep", onClick: onKeep }, "Keep")
      )
    );
  }
```

- [ ] **Step 3: VariantBar をエクスポートに追加**

```js
  exports.VariantBar = VariantBar;
```

- [ ] **Step 4: 手動テスト — VariantBarの表示確認**

ブラウザでエディタを開き、Duplicateして2つのバリアントが表示されることを確認。

- [ ] **Step 5: コミット**

```bash
git add editors/lib/ui-components.js editors/lib/editor-base.css
git commit -m "feat: VariantBarコンポーネントとCSS追加"
```

---

### Task 7: editor.html — VariantBarをAppに配置

**Files:**
- Modify: `editors/editor.html`

- [ ] **Step 1: VariantBarのインポートを追加**

L83付近に追加:
```js
const{M3,Input,Sel,Btn,SLabel,useInitialPan,useHistory,VariantBar}=window.__editorUI;
```

- [ ] **Step 2: App のreturn文にVariantBarを挿入**

L641（メインタブバーの`</div>`）の直後、L642（`<div style={{flex:1,...`）の直前に追加:

```jsx
      {variantList.length>0&&<VariantBar
        variants={variantList}
        onSwitch={handleSwitchVariant}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteVariant}
        onRename={handleRenameVariant}
        onSplit={()=>{/* TODO: Task 8で実装 */}}
        onKeep={handleKeep}
      />}
```

- [ ] **Step 3: ツールバーまたは右クリックメニューにDuplicateを追加**

初回Duplicate用（バリアントバーが非表示の時）のトリガーとして、メインタブバーの右端にDuplicateボタンを追加:

```jsx
{variantList.length===0&&<button onClick={handleDuplicate} style={{padding:"4px 12px",border:"1px solid "+M3.outlineVar,borderRadius:M3.shapeFull,background:"transparent",cursor:"pointer",fontSize:12,fontWeight:500,color:M3.onSurfaceVar,fontFamily:"inherit",marginRight:8}}>+ Duplicate</button>}
```

これをL640のbarRefの前に配置する。

- [ ] **Step 4: 手動テスト — 完全なDuplicate→切替→Keep→通常モード復帰を確認**

1. エディタでJSONを読み込む
2. Duplicateをクリック → サブタブバーが出現、Option A/B
3. Option Bをクリック → 切り替わる
4. Keepをクリック → 確認後、サブタブバーが消える

- [ ] **Step 5: コミット**

```bash
git add editors/editor.html
git commit -m "feat: VariantBarをエディタに統合、Duplicate/Switch/Keepの動線を実装"
```

---

### Task 8: Split View 実装

**Files:**
- Modify: `editors/editor.html`
- Modify: `editors/lib/editor-base.css`

- [ ] **Step 1: Split View の状態管理をAppに追加**

App関数内に追加:
```js
  const[splitMode,setSplitMode]=useState(null); // null | { left: variantId, right: variantId }
  // Split選択UI
  const[splitPicking,setSplitPicking]=useState(null); // null | { selected: [id] }
```

- [ ] **Step 2: Split選択ポップオーバーをAppに追加**

Splitボタンが押されたときに表示するバリアント選択UI。2つ選んだらSplitモードに入る:

```jsx
{splitPicking&&<div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.3)"}} onClick={()=>setSplitPicking(null)}>
  <div style={{background:"#fff",borderRadius:12,padding:24,minWidth:240,boxShadow:"var(--md-sys-elevation-3)"}} onClick={e=>e.stopPropagation()}>
    <div style={{fontSize:14,fontWeight:500,marginBottom:16,color:M3.onSurface}}>比較する2つを選択</div>
    {variantList.map(v=>{
      const sel=splitPicking.selected.includes(v.id);
      return<button key={v.id} onClick={()=>{
        const next=sel?splitPicking.selected.filter(id=>id!==v.id):[...splitPicking.selected,v.id];
        if(next.length===2){setSplitMode({left:next[0],right:next[1]});setSplitPicking(null);}
        else setSplitPicking({selected:next});
      }} style={{display:"block",width:"100%",padding:"8px 12px",marginBottom:4,border:sel?"2px solid #1A73E8":"1px solid "+M3.outlineVar,borderRadius:8,background:sel?"#E8F0FE":"transparent",cursor:"pointer",fontSize:13,fontFamily:"inherit",textAlign:"left",color:M3.onSurface}}>{v.name}</button>;
    })}
  </div>
</div>}
```

- [ ] **Step 3: Split View のキャンバス分割レイアウト**

`<div style={{flex:1,overflow:"hidden"}}>` をSplit対応に修正:

```jsx
<div style={{flex:1,overflow:"hidden",display:splitMode?"flex":"block"}}>
  {splitMode?<>
    {/* 左パネル */}
    <div style={{flex:1,overflow:"hidden",borderRight:"2px solid "+M3.outlineVar,position:"relative"}}>
      <div style={{position:"absolute",top:8,left:8,zIndex:10,fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:4,background:M3.primaryContainer,color:M3.onPrimaryContainer}}>
        {variantList.find(v=>v.id===splitMode.left)?.name}
        <select onChange={e=>{setSplitMode(s=>({...s,left:e.target.value}));}} value={splitMode.left} style={{marginLeft:4,fontSize:11,border:"none",background:"transparent"}}>
          {variantList.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      {/* TODO: 左パネルのキャンバス描画 — activeModelをsplitMode.leftのバリアントデータに切り替えて描画 */}
    </div>
    {/* 右パネル */}
    <div style={{flex:1,overflow:"hidden",position:"relative"}}>
      <div style={{position:"absolute",top:8,left:8,zIndex:10,fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:4,background:M3.surfaceCont,color:M3.onSurface}}>
        {variantList.find(v=>v.id===splitMode.right)?.name}
        <select onChange={e=>{setSplitMode(s=>({...s,right:e.target.value}));}} value={splitMode.right} style={{marginLeft:4,fontSize:11,border:"none",background:"transparent"}}>
          {variantList.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      {/* TODO: 右パネルのキャンバス描画 */}
    </div>
  </>:<>
    {/* 通常の単一パネル表示（既存コード） */}
    {tab==="object"&&<ObjectView model={activeModel} setModel={effectiveSetModel} ...既存props />}
    {tab==="pane"&&<MapView model={activeModel} setModel={effectiveSetModel} ...既存props />}
    {tab==="screen"&&<ScreenView model={activeModel} setModel={effectiveSetModel} ...既存props />}
  </>}
</div>
```

- [ ] **Step 4: Split用のモデルデータ取得ヘルパーを追加**

```js
  // 指定バリアントIDのモデルデータを取得
  const getVariantModel=useCallback((variantId)=>{
    if(!isVariantMode(model))return model;
    const v=model._variants.find(v=>v.id===variantId);
    return v||model;
  },[model]);

  // Split用のsetModel: 指定バリアントを更新
  const setVariantModel=useCallback((variantId,updater)=>{
    setModel(m=>{
      if(!isVariantMode(m))return typeof updater==='function'?updater(m):updater;
      const v=m._variants.find(v=>v.id===variantId);
      if(!v)return m;
      const updated=typeof updater==='function'?updater(v):updater;
      return updateVariantData(m,variantId,updated);
    });
  },[setModel]);
```

- [ ] **Step 5: Split Viewの左右パネルにキャンバスコンポーネントを描画**

左右それぞれに `ObjectView` / `MapView` / `ScreenView` を配置。`model` には `getVariantModel(splitMode.left)` / `getVariantModel(splitMode.right)` を渡し、`setModel` には `(updater)=>setVariantModel(splitMode.left, updater)` を渡す。

- [ ] **Step 6: VariantBarのonSplitコールバックを接続**

```js
onSplit={()=>{
  if(splitMode){setSplitMode(null);}
  else if(variantList.length===2){setSplitMode({left:variantList[0].id,right:variantList[1].id});}
  else{setSplitPicking({selected:[]});}
}}
```

バリアントが2つならそのまま分割、3つ以上なら選択UIを表示。

- [ ] **Step 7: Split閉じるとき・Keepの時にsplitModeをリセット**

```js
  const handleKeep=useCallback(()=>{
    if(!activeVariant)return;
    setModel(m=>keepVariant(m,activeVariant.id));
    setSplitMode(null);
    showToast('Kept: '+activeVariant.name);
  },[setModel,activeVariant]);
```

- [ ] **Step 8: 手動テスト — Split Viewの動作確認**

1. 2つのバリアントでSplitを押す → 左右分割
2. 左右でそれぞれ編集できることを確認
3. パネル内のドロップダウンでバリアント差し替え
4. もう一度Splitで閉じる

- [ ] **Step 9: コミット**

```bash
git add editors/editor.html editors/lib/editor-base.css
git commit -m "feat: Split View実装（左右分割・バリアント差し替え・編集対応）"
```

---

### Task 9: Undo/Redo のバリアント対応

**Files:**
- Modify: `editors/lib/ui-components.js` (useHistory フック)

- [ ] **Step 1: useHistory の履歴エントリにvariantIdを記録する仕組みを追加**

`useHistory` のインタフェースを拡張。`setData` 呼び出し時にオプショナルな `variantId` を受け取れるようにする。

修正前:
```js
  function useHistory(initial, showToast) {
    var histRef = useRef({stack:[initial], idx:0});
    // ...
    var setData = useCallback(function(updater) {
      // ...
      hist.stack.push(JSON.parse(JSON.stringify(next)));
```

修正後:
```js
  function useHistory(initial, showToast) {
    var histRef = useRef({stack:[{data:initial,variantId:null}], idx:0});
    // ...
    var setData = useCallback(function(updater, variantId) {
      // ...
      hist.stack.push({data:JSON.parse(JSON.stringify(next)),variantId:variantId||null});
```

- [ ] **Step 2: undo/redo でvariantIdを返す仕組みを追加**

undoが呼ばれたとき、戻り先のエントリの`variantId`を返す。呼び出し元でバリアント切り替え処理を行う。

```js
    var undo = useCallback(function() {
      var hist = histRef.current;
      if (hist.idx <= 0) return null;
      hist.idx--;
      var entry = hist.stack[hist.idx];
      dirtyRef.current = true;
      setDataRaw(JSON.parse(JSON.stringify(entry.data)));
      showToast('Undo');
      return entry.variantId;
    }, [showToast]);

    var redo = useCallback(function() {
      var hist = histRef.current;
      if (hist.idx >= hist.stack.length - 1) return null;
      hist.idx++;
      var entry = hist.stack[hist.idx];
      dirtyRef.current = true;
      setDataRaw(JSON.parse(JSON.stringify(entry.data)));
      showToast('Redo');
      return entry.variantId;
    }, [showToast]);
```

- [ ] **Step 3: reset もエントリ形式に合わせる**

```js
    var reset = useCallback(function(newData) {
      setDataRaw(newData);
      histRef.current = {stack:[{data:JSON.parse(JSON.stringify(newData)),variantId:null}], idx:0};
    }, []);
```

- [ ] **Step 4: editor.html側でundo/redoのvariantId返り値を処理**

App関数内のundo/redo呼び出しを修正。戻り値のvariantIdが現在と異なればSplitを閉じてバリアントを切り替える:

```js
  const handleUndo=useCallback(()=>{
    const targetVid=undo();
    if(targetVid && isVariantMode(model)){
      const current=getActiveVariant(model);
      if(current && current.id!==targetVid){
        setSplitMode(null);
        // undo内でsetDataRawは既に呼ばれている。switchVariantは次回のmodelに反映
        // → undo後のデータに対してswitchが必要
        // undo返り値でactiveを切り替える
        setModel(m=>switchVariant(m,targetVid));
      }
    }
  },[undo,model,setModel]);

  const handleRedo=useCallback(()=>{
    const targetVid=redo();
    if(targetVid && isVariantMode(model)){
      const current=getActiveVariant(model);
      if(current && current.id!==targetVid){
        setSplitMode(null);
        setModel(m=>switchVariant(m,targetVid));
      }
    }
  },[redo,model,setModel]);
```

グローバル関数登録も更新:
```js
  window.__edUndo=handleUndo;window.__edRedo=handleRedo;
```

- [ ] **Step 5: effectiveSetModel でvariantIdを渡す**

```js
  const effectiveSetModel=isVariantMode(model)?
    (updater)=>setModel(m=>{
      const active=getActiveVariant(m);
      const updated=typeof updater==='function'?updater(active):updater;
      return updateVariantData(m,active.id,updated);
    }, activeVariant?.id)  // ← variantIdを履歴に記録
    :setModel;
```

- [ ] **Step 6: 手動テスト — Undo/Redoでバリアント切り替えを確認**

1. Option A で編集
2. Option B に切り替えて編集
3. Cmd+Z → Option B の編集が戻る
4. さらに Cmd+Z → Option A に自動切り替えされ、Option A の編集が戻る
5. Split中にCmd+Z → 表示外バリアントならSplitが閉じてそのバリアントに切り替わる

- [ ] **Step 7: コミット**

```bash
git add editors/lib/ui-components.js editors/editor.html
git commit -m "feat: Undo/Redoにバリアント切り替えを統合"
```

---

### Task 10: 右クリックメニューへのDuplicate追加・最終統合テスト

**Files:**
- Modify: `editors/editor.html` (右クリックメニュー部分)

- [ ] **Step 1: 各ビューの右クリックメニューにDuplicate項目を追加**

ObjectView, MapView, ScreenView それぞれの右クリックメニュー（contextmenu）に「Duplicate」メニュー項目を追加。キャンバス背景の右クリックメニューとして表示する。

既存の右クリックメニューを検索して、各ビューに以下を追加:
```jsx
<div onClick={()=>{handleDuplicate();setCtxMenu(null);}} style={menuItemStyle}>Duplicate</div>
```

- [ ] **Step 2: Keepボタンに確認ダイアログを追加**

```js
  const handleKeep=useCallback(()=>{
    if(!activeVariant)return;
    if(!window.confirm('「'+activeVariant.name+'」を採用し、他のバリアントを削除します。よろしいですか？'))return;
    setModel(m=>keepVariant(m,activeVariant.id));
    setSplitMode(null);
    showToast('Kept: '+activeVariant.name);
  },[setModel,activeVariant]);
```

- [ ] **Step 3: deleteVariantに確認ダイアログを追加**

```js
  const handleDeleteVariant=useCallback((variantId)=>{
    const v=variantList.find(v=>v.id===variantId);
    if(!window.confirm('「'+(v?.name||variantId)+'」を削除しますか？'))return;
    setModel(m=>deleteVariant(m,variantId));
    if(splitMode&&(splitMode.left===variantId||splitMode.right===variantId))setSplitMode(null);
    showToast('Deleted variant');
  },[setModel,variantList,splitMode]);
```

- [ ] **Step 4: 総合手動テスト**

以下のシナリオを通して動作確認:

1. JSONを読み込む → 通常モード（サブタブなし）
2. Duplicate → Option A, Option B のサブタブ出現
3. Option B に切り替え → キャンバスが切り替わる
4. Option B でオブジェクトを編集
5. もう一度 Duplicate → Option C 追加
6. Option A をダブルクリック → リネーム
7. Split → 2つ選択 → 左右分割表示
8. Split中に左側で編集
9. Split中にパネル内でバリアント差し替え
10. Splitを閉じる
11. Cmd+Z で Undo → 別バリアントの操作ならバリアント切り替え
12. Option Cの × → 削除確認 → Option C消滅
13. Keep → 確認ダイアログ → 通常モードに戻る
14. ファイルを保存 → JSON内容確認（_variantsなし）
15. バリアントモード中にファイル保存 → JSON内容確認（_variantsあり）
16. ブラウザリロード → バリアントモードが復元される

- [ ] **Step 5: コミット**

```bash
git add editors/editor.html
git commit -m "feat: 右クリックメニューDuplicate・確認ダイアログ・最終統合"
```

---

### Task 11: generateスキルの `_variants` 対応

**Files:**
- Modify: `skills/generate/SKILL.md`

- [ ] **Step 1: SKILL.md の Step 1（既存JSON確認）にバリアント検出を追加**

Step 1の記述に以下を追加:

```markdown
`_variants` キーが存在する場合（バリアント分岐中）:
- ユーザーに以下を確認する: 「バリアントが存在しますが、generateを実行するとすべてのバリアントが上書きされます。よろしいですか？」
- OKならそのまま上書き（`_variants` は削除され通常形式で出力される）
- キャンセルなら処理を中断
```

- [ ] **Step 2: コミット**

```bash
git add skills/generate/SKILL.md
git commit -m "docs: generateスキルに_variantsバリアント検出の注意事項を追加"
```

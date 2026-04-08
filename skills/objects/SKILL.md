---
name: objects
description: Generate and edit object model JSON with HTML editor
---

# /objects

Object ModelのJSONを生成し、ブラウザで操作できるHTMLエディタを起動する。
objects / actors を編集する（views / transitions は /views で編集する）。

## Input

PRD・MRDの内容、またはユーザーの説明からオブジェクトを抽出してJSONを生成する。

## Output

- `{EDITOR_DIR}/product-model.json` — 統合JSON（HTMLで編集・保存）
- `{EDITOR_DIR}/object-editor.html` — HTMLエディタ（ブラウザで開く）

> **注:** `{EDITOR_DIR}` はプロジェクトごとに異なる。導入時に実際のパスに置換すること。

## JSON Schema（統合）

ObjectエディタとViewエディタが同じJSONファイルを共有する。
各エディタは自分の担当フィールドのみ編集し、それ以外はパススルーで保持する。

```json
{
  "objects": [],
  "actors": [],
  "views": [],
  "transitions": []
}
```

| フィールド | 編集するエディタ | 説明 |
|---|---|---|
| objects | Object | オブジェクト定義 |
| actors | Object | ロール（操作者）定義 |
| views | View | ビュー定義（type: "view" / "composite"） |
| transitions | View | ビュー遷移定義 |

### objects

```json
{
  "id": "kebab-case識別子",
  "name": "表示名",
  "relations": [
    { "id": "一意ID", "targetId": "対象オブジェクトid", "type": "has-many | has-one | many-to-many", "label": "関係の短い説明" }
  ]
}
```

### actors

```json
{
  "id": "kebab-case識別子",
  "name": "ロール名",
  "touches": [
    {
      "objectId": "オブジェクトid",
      "crud": [
        { "op": "C", "scope": "all" },
        { "op": "R", "scope": "all" },
        { "op": "U", "scope": "own" },
        { "op": "D", "scope": "own" }
      ]
    }
  ]
}
```

### views（Viewエディタの担当。スキーマ詳細は /views の SKILL.md を参照）

```json
{
  "id": "kebab-case識別子",
  "name": "ビュー名",
  "actorId": "アクターid",
  "x": 60, "y": 60,
  "prompt": "実装補足指示",
  "objects": [
    { "id": "一意ID", "objectId": "オブジェクトid", "variant": "collection | single", "crud": ["C", "R"] }
  ]
}
```

### transitions（Viewエディタの担当）

```json
{ "id": "一意ID", "from": "view id", "to": "view id", "trigger": "遷移トリガー" }
```

### スキーマルール

- オブジェクトはフラットな配列。グルーピングはしない
- relationsの `type` は `has-many` / `has-one` / `many-to-many`
- actorsはPRDのロール定義から導出する
- **パススルールール**: Objectエディタはviews/transitionsフィールドを読み込み時に保持し、保存時にそのまま書き戻す。views/transitionsが存在しなくてもエラーにしない

## Execution Steps

### Step 1: JSONを生成

PRD・MRD・object-model等の入力ドキュメントを読み、
objects・actorsをJSONとして生成する。
既存の product-model.json がある場合はそれを読み込み、views/transitionsはそのまま保持する。

### Step 2: JSONファイルを書き出す

`{EDITOR_DIR}/product-model.json` にJSONを書き出す。

### Step 3: ブラウザで開く

```bash
open {EDITOR_DIR}/object-editor.html
```

### Step 4: ブラウザで編集

```
Object Model generated:
- JSON: {EDITOR_DIR}/product-model.json
- Editor: {EDITOR_DIR}/object-editor.html (opened in browser)

HTMLエディタで product-model.json をドラッグ&ドロップ、
または「Connect」ボタンから読み込んでください。

1. Object タブでオブジェクト・関係を確認・編集
2. Actor タブでロール別CRUD権限を確認・編集
3. 編集が完了したら教えてください
4. 確定後、/views を実行してビュー定義を作成
```

### Step 5: 変更確認（エディタ保存後）

ユーザーがエディタで編集・保存した後、`product-model.json` を読み込んで変更内容を確認する。

> **プロジェクト拡張ポイント**: ここで object-model.md への同期や Specs 影響チェックなど、
> プロジェクト固有の後処理を追加できる。

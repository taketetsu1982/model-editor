---
name: objects
description: Generate and edit object model JSON with HTML editor
---

# /objects

Object ModelのJSONを生成し、ブラウザで操作できるHTMLエディタを起動する。
objects を編集する（views / transitions は /views で編集する）。

## Input

PRD・MRDの内容、またはユーザーの説明からオブジェクトを抽出してJSONを生成する。

## Output

- `{EDITOR_DIR}/product-model.json` — 統合JSON（HTMLで編集・保存）
- `{EDITOR_DIR}/editor.html` — 統合HTMLエディタ（ブラウザで開く）

> **注:** `{EDITOR_DIR}` はプロジェクトごとに異なる。導入時に実際のパスに置換すること。

## JSON Schema

```json
{
  "objects": [],
  "views": [],
  "transitions": []
}
```

| フィールド | タブ | 説明 |
|---|---|---|
| objects | Object | オブジェクト定義 |
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

### views（Viewタブの担当。スキーマ詳細は /views の SKILL.md を参照）

```json
{
  "id": "kebab-case識別子",
  "name": "ビュー名",
  "type": "view | composite",
  "prompt": "実装補足指示",
  "objects": [
    { "id": "一意ID", "objectId": "オブジェクトid", "variant": "collection | single" }
  ]
}
```

### transitions（Viewタブの担当）

```json
{ "id": "一意ID", "from": "view id", "to": "view id", "trigger": "遷移トリガー" }
```

### スキーマルール

- オブジェクトはフラットな配列。グルーピングはしない
- relationsの `type` は `has-many` / `has-one` / `many-to-many`

## Execution Steps

### Step 1: JSONを生成

PRD・MRD等の入力ドキュメントを読み、objectsをJSONとして生成する。
既存の product-model.json がある場合はそれを読み込み、views/transitionsはそのまま保持する。

### Step 2: JSONファイルを書き出す

`{EDITOR_DIR}/product-model.json` にJSONを書き出す。

### Step 3: ブラウザで開く

```bash
open {EDITOR_DIR}/editor.html
```

### Step 4: ブラウザで編集

```
Object Model generated:
- JSON: {EDITOR_DIR}/product-model.json
- Editor: {EDITOR_DIR}/editor.html (opened in browser)

HTMLエディタで product-model.json をドラッグ&ドロップ、
または「Connect」ボタンから読み込んでください。

1. Object タブでオブジェクト・関係を確認・編集
2. 編集が完了したら教えてください
3. 確定後、/views を実行してビュー定義を作成
```

### Step 5: 変更確認（エディタ保存後）

ユーザーがエディタで編集・保存した後、`product-model.json` を読み込んで変更内容を確認する。

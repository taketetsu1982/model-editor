---
name: generate-model
description: PRD・MRD等からプロダクトモデルJSON（objects, views, transitions）を一括生成する
---

# /generate-model

PRD・MRD等の入力からプロダクトモデルJSON（objects, views, transitions）を一括生成する。

## Input

PRD・MRDの内容、またはユーザーの説明からオブジェクトとビューを抽出してJSONを生成する。

## Output

- `{EDITOR_DIR}/product-model.json` — 統合JSON

> **注:** `{EDITOR_DIR}` はプロジェクトごとに異なる。導入時に実際のパスに置換すること。

## JSON Schema

```json
{
  "objects": [],
  "views": [],
  "transitions": []
}
```

| フィールド | 説明 |
|---|---|
| objects | オブジェクト定義 |
| views | ビュー定義（type: "view" / "composite"） |
| transitions | ビュー遷移定義 |

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

- オブジェクトはフラットな配列。グルーピングはしない
- relationsの `type` は `has-many` / `has-one` / `many-to-many`

### views

```json
{
  "id": "kebab-case識別子",
  "name": "ビュー名",
  "type": "view | composite",
  "x": 60, "y": 60,
  "prompt": "このビューの実装についての補足指示（自然言語）",
  "objects": [
    { "id": "一意ID", "objectId": "object id", "variant": "collection | single" }
  ]
}
```

- `type`: `view` = 通常ビュー、`composite` = 複合ビュー（ダッシュボード等）
- `variant`: `collection` = 一覧表示、`single` = 単体表示
- 1つのオブジェクトを複数のビューから参照できる

### transitions

```json
{ "id": "一意ID", "from": "view id", "to": "view id", "trigger": "遷移トリガー" }
```

## Execution Steps

### Step 1: 既存JSONを確認

`{EDITOR_DIR}/product-model.json` が存在する場合は読み込み、現状を把握する。

### Step 2: JSONを生成

PRD・MRD等の入力を読み、以下を生成する:

1. **objects** — エンティティとリレーションを抽出
2. **views** — 各オブジェクトに対して一覧（collection）と詳細（single）を検討。ダッシュボード等の複合ビューは type: composite で追加
3. **transitions** — ビュー間の遷移を定義

既存JSONがある場合は、既存の内容をベースに差分更新する。

### Step 3: JSONファイルを書き出す

`{EDITOR_DIR}/product-model.json` にJSONを書き出す。

### Step 4: 完了メッセージ

```
Product Model generated:
- JSON: {EDITOR_DIR}/product-model.json

エディタで確認・編集する場合は /open-editor を実行してください。
```

---
name: views
description: Generate views and transitions in product-model JSON with HTML editor
---

# /views

product-model.json の views / transitions を生成し、HTMLエディタでビュー遷移図を編集する。
objects は /objects で編集する（同じJSONファイルを共有）。

## Input

1. **Conversation**: product-model.json の objects から views/transitions を生成
2. **既存JSON**: `{EDITOR_DIR}/product-model.json` の views/transitions 部分を編集

> **注:** `{EDITOR_DIR}` はプロジェクトごとに異なる。導入時に実際のパスに置換すること。

## Output

- `{EDITOR_DIR}/product-model.json` — 統合JSON（views/transitions 部分を更新）
- `{EDITOR_DIR}/editor.html` — 統合HTMLエディタ（ブラウザで開く）

## JSON Schema

`{EDITOR_DIR}/product-model.json` の統合スキーマ（全体定義は /objects の SKILL.md を参照）。
このスキルは **views** と **transitions** フィールドのみ編集する。

### views

```json
{
  "id": "kebab-case識別子",
  "name": "ビュー名",
  "type": "view | composite",
  "x": 60, "y": 60,
  "prompt": "このビューの実装についての補足指示（自然言語）",
  "objects": [
    {
      "id": "一意ID",
      "objectId": "object id",
      "variant": "collection | single"
    }
  ]
}
```

- `type`: `view` = 通常ビュー、`composite` = 複合ビュー（ダッシュボード等）
- `x`, `y`: HTMLエディタの Map View 上での配置座標
- `prompt`: ビューレイアウトや振る舞いの補足指示
- `variant`: `collection` = 一覧表示、`single` = 単体表示

### transitions

```json
{ "id": "一意ID", "from": "view id", "to": "view id", "trigger": "遷移トリガー" }
```

### スキーマルール

- 1つのオブジェクトを複数のビューから参照できる（collection/singleで区別）
- transitions はビュー間の遷移を定義する

## Execution Steps

### Step 1: Object Model を読み込む

`{EDITOR_DIR}/product-model.json` を読み込む。
objects を把握した上で views/transitions を生成する。

### Step 2: ビューを設計する

objects から必要なビューを洗い出す。

1. 各オブジェクトに対して一覧（collection）と詳細（single）を検討
2. ダッシュボード等の複合ビューを type: composite で追加
3. ビュー間の transitions を定義

### Step 3: JSON ファイルを更新する

`{EDITOR_DIR}/product-model.json` の views/transitions を更新する。
既存の objects はそのまま保持する。

### Step 4: ブラウザで開く

```bash
open {EDITOR_DIR}/editor.html
```

### Step 5: ブラウザで編集

```
Views generated:
- JSON:   {EDITOR_DIR}/product-model.json (views/transitions updated)
- Editor: {EDITOR_DIR}/editor.html (opened)

product-model.json をHTMLにドロップして接続してください。

- View タブでビュー遷移図を確認・編集
- ビューカードをダブルクリックでビュー詳細（objects + prompt）を編集
- 編集が完了したら教えてください
```

### Step 6: 変更確認（エディタ保存後）

ユーザーがエディタで編集・保存した後、`product-model.json` を読み込んで変更内容を確認する。

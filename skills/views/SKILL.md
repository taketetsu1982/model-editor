---
name: views
description: Generate views and transitions in product-model JSON with HTML editor
---

# /views

product-model.json の views / transitions を生成し、HTMLエディタでビュー遷移図を編集する。
objects / actors は /objects で編集する（同じJSONファイルを共有）。

## Input

1. **Conversation**: product-model.json の objects/actors から views/transitions を生成
2. **既存JSON**: `{EDITOR_DIR}/product-model.json` の views/transitions 部分を編集

> **注:** `{EDITOR_DIR}` はプロジェクトごとに異なる。導入時に実際のパスに置換すること。

## Output

- `{EDITOR_DIR}/product-model.json` — 統合JSON（views/transitions 部分を更新）
- `{EDITOR_DIR}/view-editor.html` — HTMLエディタ（ブラウザで開く）

## JSON Schema

`{EDITOR_DIR}/product-model.json` の統合スキーマ（全体定義は /objects の SKILL.md を参照）。
このスキルは **views** と **transitions** フィールドのみ編集する。

### views

```json
{
  "id": "kebab-case識別子",
  "name": "ビュー名",
  "actorId": "product-model.jsonのactor id",
  "x": 60, "y": 60,
  "prompt": "このビューの実装についての補足指示（自然言語）",
  "objects": [
    {
      "id": "一意ID",
      "objectId": "object id",
      "variant": "collection | single",
      "crud": ["C", "R", "U", "D"]
    }
  ]
}
```

- `actorId`: このビューを使うアクター
- `x`, `y`: HTMLエディタの Map View 上での配置座標
- `prompt`: ビューレイアウトや振る舞いの補足指示
- `variant`: `collection` = 一覧表示、`single` = 単体表示
- `crud`: このビューで実行可能な操作（actor の touches 権限の範囲内）

### transitions

```json
{ "id": "一意ID", "from": "view id", "to": "view id", "trigger": "遷移トリガー" }
```

### スキーマルール

- 各 view は1つの actorId を持つ
- objects の crud は actor の touches.crud に含まれる op の範囲内で設定する
- transitions は同一 actor 内の遷移のみ定義する
- **パススルールール**: View エディタは objects/actors フィールドを読み込み時に保持し、保存時にそのまま書き戻す。これらが空でもエラーにしない

## Execution Steps

### Step 1: Object Model を読み込む

`{EDITOR_DIR}/product-model.json` を読み込む。
objects・actors を把握した上で views/transitions を生成する。

### Step 2: ビューを設計する

actor ごとに必要なビューを洗い出す。

1. 各 actor の touches から CRUD 権限を確認
2. R 権限 → 一覧（collection）+ 詳細（single）
3. C 権限 → 作成ビュー
4. ダッシュボード等の複合ビューを type: composite で追加
5. ビュー間の transitions を定義

### Step 3: JSON ファイルを更新する

`{EDITOR_DIR}/product-model.json` の views/transitions を更新する。
既存の objects/actors はそのまま保持する。

### Step 4: ブラウザで開く

```bash
open {EDITOR_DIR}/view-editor.html
```

### Step 5: ブラウザで編集

```
Views generated:
- JSON:   {EDITOR_DIR}/product-model.json (views/transitions updated)
- Editor: {EDITOR_DIR}/view-editor.html (opened)

product-model.json をHTMLにドロップして接続してください。
同じJSONファイルに objects/actors/views 全てが含まれています。

- Actor タブ: アクターごとのビュー遷移図を確認・編集
- ビューカードの ↗ ボタン: ビュー詳細（objects + prompt）を編集
- 編集が完了したら教えてください
```

### Step 6: 変更確認（エディタ保存後）

ユーザーがエディタで編集・保存した後、`product-model.json` を読み込んで変更内容を確認する。

> **プロジェクト拡張ポイント**: ここで object-model.md のビュー定義セクション同期や
> ui-spec.md への影響チェックなど、プロジェクト固有の後処理を追加できる。

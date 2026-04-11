---
name: edit
description: HTMLエディタをブラウザで開き、product-model.jsonを視覚的に編集する
---

# /edit

HTMLエディタをブラウザで開く。エディタ上でオブジェクト・ビュー・遷移を視覚的に編集できる。

## Output

- `{EDITOR_DIR}/editor.html` をブラウザで開く

> **注:** `{EDITOR_DIR}` はプロジェクトごとに異なる。導入時に実際のパスに置換すること。

## Execution Steps

### Step 1: ブラウザで開く

```bash
open {EDITOR_DIR}/editor.html
```

### Step 2: 案内メッセージ

```
Editor opened:
- Editor: {EDITOR_DIR}/editor.html
- JSON:   {EDITOR_DIR}/product-model.json

product-model.json をエディタにドラッグ&ドロップ、
または「Connect」ボタンから読み込んでください。

- Object タブ: オブジェクト・リレーションを編集
- View タブ: ビュー・遷移を編集
- 編集が完了したら教えてください
```

### Step 3: 変更確認（エディタ保存後）

ユーザーがエディタで編集・保存した後、`{EDITOR_DIR}/product-model.json` を読み込んで変更内容を確認する。

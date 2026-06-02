---
name: edit
description: HTMLエディタをブラウザで開き、product-model.jsonを視覚的に編集する
---

# /edit

HTMLエディタをブラウザで開く。エディタ上でオブジェクト・ペイン・Pane Graph・スクリーンを視覚的に編集できる。

## Output

- ローカルサーバを起動し、`http://localhost:<port>/` でHTMLエディタをブラウザに開く

> **注:** `{EDITOR_DIR}` はプロジェクトごとに異なる。導入時に実際のパスに置換すること。

## Execution Steps

### Step 1: 対象JSONのパスを決める

- 引数でパスが渡された場合（例: `/edit sample/product-model.json`）はそれを使う
- 省略時はリポジトリ内の `product-model.json` を1件検出して使う
  - 0件: パス指定を促して中断する
  - 複数件: 候補を提示してどれを編集するか確認する

### Step 2: ローカルサーバを起動する

`{EDITOR_DIR}/server.js` をバックグラウンドで起動し、標準出力に出る URL（`http://localhost:<port>/`）を取得する。

```bash
node {EDITOR_DIR}/server.js <対象JSONの絶対パス>
```

> サーバは `127.0.0.1` のみにバインドする。ポート8765が使用中なら自動で空きポートを探す。

### Step 3: ブラウザで開く

取得した URL を開く。

```bash
open http://localhost:<port>/
```

### Step 4: 案内メッセージ

```
Editor opened (localhost):
- URL:  http://localhost:<port>/
- JSON: <対象JSONのパス>

ファイル選択は不要です。モデルが自動で読み込まれ、編集内容は自動保存されます。

- Object タブ: オブジェクト・リレーションを編集
- Pane タブ: ペイン・Pane Graph（drilldown/embed）を編集
- Screen タブ: デバイスごとのペイン構成を編集
- 編集が完了したら教えてください
```

### Step 5: 完了処理（編集終了後）

1. 起動したサーバプロセスを停止する
2. 対象JSONを読み込んで変更内容を確認する

> 保存はファイルに直書きされるため、完了前でも対象JSONをいつでも読み戻せる。

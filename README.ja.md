# Model Editor

*[English](README.md)*

OOUIに基づいてAIとヒトがプロダクトのオブジェクトを設計するエディタです。AIがドキュメントからオブジェクト（データモデル）・ペイン（画面を構成する部品）・スクリーン（デバイスごとのペイン構成）の3層に分解・生成します。1つのJSONで統合管理し、エディタとなるブラウザ上で視覚的に編集できます。

## 概要

```
例: メールアプリの場合

オブジェクト層（Object タブ）
  メールボックス ──*── 受信メール
       :                    :
- - - - - - - - - - - - - - - - - -
       :              *     :
ペイン層（Pane タブ）
  コレクション ──→ コレクション ──→ シングル
 (一覧表示)      (一覧表示)      (詳細表示)
       :              :              :
- - - - - - - - - - - - - - - - - -
       :              :              :
スクリーン層（Screen タブ）
  mobile: [コレクション]
  desktop: [コレクション, シングル]
```

- **Object タブ** — オブジェクトとリレーションを定義
- **Pane タブ** — ペイン（collection / single）とPane Graph（遷移）を定義
- **Screen タブ** — デバイスごとにペインをグルーピングして画面を構成

## JSON構造

```json
{
  "devices": [],
  "objects": [],
  "views": [],
  "paneGraph": [],
  "screens": []
}
```

| フィールド | タブ | 説明 |
|---|---|---|
| `devices` | Screen | デバイス一覧（文字列配列） |
| `objects` | Object | オブジェクト定義（名前・リレーション） |
| `views` | Pane | ペイン定義（collection / single） |
| `paneGraph` | Pane | Pane Graph — ペイン間の辺定義（drilldown / embed） |
| `screens` | Screen | スクリーン定義（デバイス別ペイン構成） |

### バリアント

エディタ上でモデルを分岐すると、各層のキーが `_variants` 配列の中へ移ります。複数の設計案を1つのファイルに並べて持てます。

```json
{
  "_variants": [
    { "id": "a", "name": "Option A", "active": true, "objects": [], "views": [], "paneGraph": [], "screens": {} },
    { "id": "b", "name": "Option B", "objects": [], "views": [], "paneGraph": [], "screens": {} }
  ]
}
```

- `active: true` のバリアントが、キャンバスに表示されているもの
- 「Keep」を押すと、アクティブなバリアントがトップレベルへ展開され `_variants` は削除される
- バリアントが1つになった時点で `_variants` は解除され、通常の形に戻る

## 使い方

### 1. エディタを起動する

```bash
node editors/server.js path/to/product-model.json
```

サーバは `127.0.0.1` のみにバインドし、URL（`http://localhost:8765/`。8765 が使用中なら空きポートを探す）を出力します。その URL を開くとモデルが自動で読み込まれ、編集内容はファイルへ直接書き戻されます。ファイル選択も権限ダイアログも不要です。

ファイルとして直接開くこともできます。

```bash
open editors/editor.html
```

この場合は、JSONファイルをエディタにドラッグ&ドロップするか、「Connect」ボタンから選択して接続します。

### 2. 編集・保存

- Object / Pane / Screen タブで切り替えて編集
- Auto Save ON で編集内容が自動保存される
- `Cmd/Ctrl + S` で手動保存

## ファイル構成

```
.claude-plugin/
└── plugin.json              # Claude Codeプラグイン定義
editors/
├── editor.html              # 統合エディタ本体
├── server.js                # ローカルサーバ（エディタ配信・モデルの読み書き）
└── lib/
    ├── editor-base.css      # 共通CSSスタイル
    ├── shared.js            # 共通関数・定数
    ├── object-logic.js      # Object固有ロジック
    ├── view-logic.js        # Pane固有ロジック
    ├── variant-manager.js   # バリアント分岐
    ├── file-io.js           # ファイルI/O基盤
    ├── server-core.js       # サーバの純粋ヘルパ（I/Oなし）
    └── ui-components.js     # 共通UIコンポーネント
sample/
└── product-model.json       # サンプルデータ
skills/
├── generate/SKILL.md        # /generate スキル定義
└── edit/SKILL.md            # /edit スキル定義
```

> テストファイル（`*.test.js`）は各ロジックファイルに並置。

## テスト

```bash
npx vitest run
```

## Claude Code プラグイン

このリポジトリはClaude Codeプラグインとして利用できる。

### ローカルテスト

```bash
claude --plugin-dir /path/to/model-editor
```

### スキル

| スキル | 説明 |
|---|---|
| `/generate` | PRD等からプロダクトモデルJSON一括生成 |
| `/edit` | HTMLエディタをブラウザで開いて編集 |

## ライセンス

[MIT License](LICENSE)

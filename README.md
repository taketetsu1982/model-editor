# Product Model Editor

OOUIに基づくプロダクトモデルエディタ。オブジェクト（データモデル）とビュー（画面設計）を1つのJSONで統合管理し、ブラウザ上で視覚的に編集できる。

## 概要

```
例: メールアプリの場合

オブジェクト層（Object タブ）
  メールボックス ──*── 受信メール
       :                    :
- - - - - - - - - - - - - - - - - -
       :              *     :
ビュー層（View タブ）
  コレクション ──→ コレクション ──→ シングル
 (一覧表示)      (一覧表示)      (詳細表示)
```

- **Object タブ** — オブジェクトとリレーションを定義
- **View タブ** — ビュー（collection / single / composite）と遷移を定義

## JSON構造

```json
{
  "objects": [],
  "views": [],
  "transitions": []
}
```

| フィールド | タブ | 説明 |
|---|---|---|
| `objects` | Object | オブジェクト定義（名前・リレーション） |
| `views` | View | ビュー定義（collection / single / composite） |
| `transitions` | View | ビュー間の遷移定義 |

## 使い方

### 1. エディタを開く

```bash
open editors/editor.html
```

### 2. JSONを接続

- エディタにJSONファイルをドラッグ&ドロップ
- または「Connect」ボタンからファイルを選択

### 3. 編集・保存

- Object / View タブで切り替えて編集
- Auto Save ON で編集内容が自動保存される
- `Cmd/Ctrl + S` で手動保存

## ファイル構成

```
.claude-plugin/
└── plugin.json              # Claude Codeプラグイン定義
editors/
├── editor.html              # 統合エディタ本体
└── lib/
    ├── editor-base.css      # 共通CSSスタイル
    ├── shared.js            # 共通関数・定数
    ├── object-logic.js      # Object固有ロジック
    ├── view-logic.js        # View固有ロジック
    ├── file-io.js           # ファイルI/O基盤
    └── ui-components.js     # 共通UIコンポーネント
sample/
└── product-model.json       # サンプルデータ
skills/
├── objects/SKILL.md         # /objects スキル定義
└── views/SKILL.md           # /views スキル定義
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
claude --plugin-dir /path/to/product-model-editor
```

### スキル

| スキル | 説明 |
|---|---|
| `/product-model-editor:objects` | オブジェクトモデルのJSON生成・編集 |
| `/product-model-editor:views` | ビュー・遷移のJSON生成・編集 |

## ライセンス

[MIT License](LICENSE)

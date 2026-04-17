# Model Editor

OOUIに基づくプロダクトモデルエディタ。オブジェクト（データモデル）とビュー（ペイン）を1つのJSONで統合管理し、ブラウザ上で視覚的に編集できる。

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

## 使い方

### 1. エディタを開く

```bash
open editors/editor.html
```

### 2. JSONを接続

- エディタにJSONファイルをドラッグ&ドロップ
- または「Connect」ボタンからファイルを選択

### 3. 編集・保存

- Object / Pane / Screen タブで切り替えて編集
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
    ├── view-logic.js        # Pane固有ロジック
    ├── file-io.js           # ファイルI/O基盤
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

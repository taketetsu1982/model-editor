# Product Model Editor

OOUIに基づくプロダクトモデルエディタ。オブジェクト（データモデル）とビュー（画面設計）を1つのJSONで統合管理し、ブラウザ上で視覚的に編集できる。

## 概要

```
オブジェクト層（Object Editor）
  メールボックス ──*── 受信メール
       :                    :
- - - - - - - - - - - - - - - - - -
       :              *     :
ビュー層（View Editor）
  コレクション ──→ コレクション ──→ シングル
 (一覧表示)      (一覧表示)      (詳細表示)
```

- **Object Editor** — オブジェクトとリレーション、アクター別CRUD権限を定義
- **View Editor** — ビュー（collection / single / composite）と遷移を定義

## JSON構造

両エディタが同じJSONファイルを共有する。各エディタは自分の担当フィールドのみ編集し、それ以外はパススルーで保持する。

```json
{
  "objects": [],
  "actors": [],
  "views": [],
  "transitions": []
}
```

| フィールド | エディタ | 説明 |
|---|---|---|
| `objects` | Object Editor | オブジェクト定義（名前・リレーション） |
| `actors` | Object Editor | ロール定義（CRUD権限） |
| `views` | View Editor | ビュー定義（collection / single / composite） |
| `transitions` | View Editor | ビュー間の遷移定義 |

## 使い方

### 1. エディタを開く

```bash
open editors/object-editor.html   # オブジェクト編集
open editors/view-editor.html     # ビュー編集
```

### 2. JSONを接続

- エディタにJSONファイルをドラッグ&ドロップ
- または「Connect」ボタンからファイルを選択

### 3. 編集・保存

- Auto Save ON で編集内容が自動保存される
- `Cmd/Ctrl + S` で手動保存

## ファイル構成

```
editors/
├── object-editor.html      # Object Editor本体
├── view-editor.html        # View Editor本体
└── lib/
    ├── shared.js            # 共通関数・定数
    ├── object-logic.js      # Object Editor固有ロジック
    ├── view-logic.js        # View Editor固有ロジック
    ├── file-io.js           # ファイルI/O基盤
    └── ui-components.js     # React UIコンポーネント
sample/
└── product-model.json       # サンプルデータ
skills/
├── objects/SKILL.md         # /objects スキル定義
└── views/SKILL.md           # /views スキル定義
```

## テスト

```bash
npx vitest run
```

## ライセンス

[MIT License](LICENSE)

# キーボードショートカット追加 設計書

## 概要

エディタに4つのキーボードショートカットを追加する。すべてのタブ（Object/Pane/Screen）で共通動作。

## ショートカット一覧

| キー | 動作 | 配置先 |
|------|------|--------|
| Cmd/Ctrl + A | 全選択 | file-io.js + App |
| Cmd/Ctrl + D | 複製 | file-io.js + App |
| Space + ドラッグ | ハンドツール（パン） | useCanvas |
| 矢印キー | 選択アイテムの移動 | file-io.js + App |
| Shift + 矢印キー | 選択アイテムの移動（10px） | file-io.js + App |

## Cmd/Ctrl + A — 全選択

- `file-io.js` の `setupKeyboard` に追加（既存のCmd+C/V/Xと同じ層）
- `window[keys.selectAll]` コールバックを呼ぶ
- App側で各タブに応じたコールバックを登録:
  - Object: 全 `model.objects` のIDを `multiSel` に追加、`selId` をnullに
  - Pane: 全 `model.views` のIDを `multiSel` に追加、`selId` をnullに
  - Screen: 何もしない（ScreenViewに `multiSel` がないため）
- `e.preventDefault()` でブラウザのデフォルト全選択を抑止

## Cmd/Ctrl + D — 複製

- `file-io.js` の `setupKeyboard` に追加
- `window[keys.duplicate]` コールバックを呼ぶ
- App側で各タブに応じた複製処理:
  - Object: 選択中のオブジェクト（selIdまたはmultiSel）をディープコピーし、新しいIDで +20, +20 オフセットして追加。リレーションも新IDで複製。複製後は新アイテムを選択状態にする
  - Pane: 選択中のビュー（selIdまたはmultiSel）を同様に複製
  - Screen: 選択中のスクリーンを複製
- multiSel時は全選択アイテムを一括複製
- `e.preventDefault()` でブラウザのデフォルト動作を抑止

## Space + ドラッグ — ハンドツール

- `useCanvas` フックに追加（全タブ共通）
- `spaceHeld` stateを管理:
  - keydownイベントで `Space` キーを検知 → `spaceHeld = true`
  - keyupイベントで `Space` キーを検知 → `spaceHeld = false`
  - input/textarea/select/contenteditable 内では無視
- `spaceHeld === true` のとき:
  - `onBgMouseDown` の代わりに、マウスダウンでパン開始（Connectモード中でも）
  - mousemoveでパン処理
  - mouseupでパン終了
- `useCanvas` の返り値に `spaceHeld` を追加
- 各Viewでカーソルスタイルに使用:
  - `spaceHeld && !panning` → `cursor: grab`
  - `spaceHeld && panning` → `cursor: grabbing`
- Connectモード中もSpace+ドラッグでパンし、Space離したらConnectモードに戻る（Connectの状態は保持される）

## 矢印キー — 選択アイテムの移動

- `file-io.js` の `setupKeyboard` に追加
- `window[keys.moveSelection]` コールバックを呼ぶ（引数: `{ dx, dy }`）
- 移動量:
  - 通常: 1px
  - Shift押下時: 10px
- 方向:
  - ArrowUp: `{ dx: 0, dy: -step }`
  - ArrowDown: `{ dx: 0, dy: step }`
  - ArrowLeft: `{ dx: -step, dy: 0 }`
  - ArrowRight: `{ dx: step, dy: 0 }`
- App側で各タブに応じた移動処理:
  - Object: `selId` または `multiSel` の全オブジェクトの x/y を更新
  - Pane: `selId` または `multiSel` の全ビューの x/y を更新
  - Screen: `selId` のスクリーンの x/y を更新
- input/textarea/select内ではブラウザデフォルトを優先（既存の `inField` チェック）
- `e.preventDefault()` でブラウザのスクロールを抑止

## 配置先まとめ

| ファイル | 変更内容 |
|----------|---------|
| `editors/lib/file-io.js` | `setupKeyboard` に Cmd+A/D/矢印キーを追加。`keys` configに `selectAll`/`duplicate`/`moveSelection` を追加 |
| `editors/lib/ui-components.js` | `useCanvas` に Space+ドラッグのハンドツール機能を追加。`spaceHeld` を返り値に追加 |
| `editors/editor.html` | App: handleSelectAll/handleDuplicate/handleMoveSelection を追加しグローバル登録。各View: カーソルスタイルに `spaceHeld` を反映、Space中のmousedown処理を追加 |

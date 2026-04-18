# マーキー選択（矩形範囲選択）設計書

## 概要

キャンバス背景のドラッグで矩形の選択範囲を描き、範囲に触れたノードをまとめて選択する。背景ドラッグの役割をパンからマーキー選択に変更し、パンはSpace+ドラッグに完全移行する。

## 動作仕様

| 操作 | 動作 |
|------|------|
| 背景ドラッグ | マーキー選択（矩形を描いて範囲内のノードを選択） |
| Space+ドラッグ | パン（既存） |
| 背景クリック（ドラッグなし） | 選択解除（既存） |

## マーキー選択の挙動

1. キャンバス背景でmousedown → マーキー開始（キャンバス座標で開始点を記録）
2. mousemove → 開始点から現在位置まで半透明の青い矩形を描画
3. mouseup → 矩形と交差するノードをすべて `multiSel` に追加、矩形を消す
4. 交差判定: マーキー矩形とノード矩形がオーバーラップしていれば選択（完全包含ではなく触れていればOK）

## Shift修飾

- Shift なし: マーキー選択で新しいセットに置き換え
- Shift + マーキー: 既存の選択に追加

## Connect モードとの共存

Connect モード中は背景ドラッグでマーキー選択しない。

## カーソル変更

背景ドラッグがパンからマーキーに変わるため、デフォルトカーソルを `grab` → `default` に変更。パン中（Space+ドラッグ）のみ `grab` / `grabbing`。

## 配置先

### useCanvas（ui-components.js）

- `marquee` state（`null | {x1, y1, x2, y2}`）— キャンバス座標系
- 背景mousedown: パン開始の代わりにマーキー開始（`spaceHeld` 時のみパン）
- mousemove: マーキー中なら矩形を更新、`true` を返す
- mouseup: マーキー完了 → `onMarqueeEnd(rect, shiftKey)` コールバックを呼ぶ
- `onBgMouseDown` の動作変更: `spaceHeld` 時はパン、それ以外はマーキー開始
- 返り値に `marquee` を追加

### 各View（editor.html）

- SVG上にマーキー矩形を描画（半透明青、`rgba(26,115,232,0.1)` fill, `#1A73E8` stroke）
- `onMarqueeEnd` コールバックで交差判定 → `multiSel` 更新
- 交差判定関数:
  - Object: `rect` と `{x, y, EW, EH}` のオーバーラップ
  - Pane: `rect` と `{x, y, SW, cardH}` のオーバーラップ
  - Screen: `rect` と `{x, y, cardW, cardH}` のオーバーラップ
- カーソルスタイル: デフォルトを `default` に変更（`spaceHeld` 時のみ `grab`）

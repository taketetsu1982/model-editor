---
class: 使い捨て
owner: main-session
retire: Phase 1 の全 Task が merge された時点で docs/superpowers/plans/done/ へ移動する
---

# Phase 1: npm パッケージ化 — Implementation Plan

参照 spec: `docs/superpowers/specs/2026-08-21-mcp-server-design.md`
対象 Phase: 1（MCP サーバー化 Epic の 3 Phase のうち最初。Phase 2 の前提）

## Goal

`package.json` が存在しないために「依存を宣言する場所が無い」「テストが 1 本も実行できない」状態を解消し、
`npx github:taketetsu1982/model-editor serve <path>` で既存エディタサーバが起動する配布形態を成立させる。
Phase 2（MCP サーバー本体）が `@modelcontextprotocol/sdk` を依存に追加できる土台を作ることが本 Phase の存在理由。

## Scope

- `package.json` の新規作成（name / version / bin / scripts / devDependencies / private）
- `.gitignore` の新規作成
- `vitest` を devDependency として宣言し、`npm test` で `editors/lib/*.test.js` が実行される状態にする
- `bin/model-editor.js` の新規作成（サブコマンド分岐のうち `serve` のみ）
- `.claude-plugin/plugin.json` と `package.json` の version 手動一致（#54 の Phase 1 での扱い）

対応 US: US-04（一部）。実装 AC: AC-04-2 / AC-04-3 / AC-04-4 / AC-04-5。

## Out of Scope

- `src/mcp/` 配下と `mcp` サブコマンドの実装（Phase 2）。Phase 1 の `bin` は `mcp` を受けたら
  「未実装」である旨を stderr に出して非 0 終了する
- `skills/*/SKILL.md` の `{EDITOR_DIR}` 除去と手法論の single source 化（Phase 3）
- `editors/server.js` の内部実装・外部インターフェース（引数と stdout 出力）の変更。
  変更すると Claude Code plugin 経路の `/edit` が同時に壊れる（spec
  `docs/superpowers/specs/2026-08-21-mcp-server-design.md#b群-構造`）
- CI 設定の追加（#56）
- `editor.html` の CDN 依存・`open` の macOS 依存（#52 / #53。独立した個別 PR）
- npm publish（`private: true` で禁止する側。spec
  `docs/superpowers/specs/2026-08-21-mcp-server-design.md#d群-契約の精度`）

## Interface

本 Phase が確定させる契約は CLI の 1 本だけで、本文は spec
`docs/superpowers/specs/2026-08-21-mcp-server-design.md#d群-契約の精度` の CLI 表が正。
plan では再掲しない。Phase 1 が実装するのは同表のうち `model-editor serve <modelPath> [port]` のみ。

`editors/server.js` の起動インターフェースは**変更しないことが契約**である（本文は spec D群の契約 (3)
と B群 grounding 表が正）。`bin` はこれを再利用する側に立つ。

## UI 裁量範囲

N/A。本 Phase は配布形態の変更であり、エディタの画面・コンポーネントは一切変更しない
（spec `docs/superpowers/specs/2026-08-21-mcp-server-design.md#e群-ui-投影`）。

## 実装 AC

| Task | AC-ID |
|---|---|
| Task 1 | AC-04-3 / AC-04-4 / AC-04-5 |
| Task 2 | AC-04-2 |

## 依存 Task

Task 2 は Task 1 に依存する（`package.json` の `bin` フィールドを両者が触るため、直列化する）。
本 Phase 全体が Phase 2 / Phase 3 の前提であり、Phase 間も直列（spec B群）。

---

## Task 1: パッケージ基盤の作成とテストの実行可能化

変更ファイル: package.json, package-lock.json, .gitignore
依存: なし
予算: +40 行

**アウトカム**

- `npm install` 後に `npm test` で `editors/lib/*.test.js` の全テストが実行され、パスする（AC-04-3）
- `node_modules/` と `.DS_Store` が git の未追跡ファイルとして現れない（AC-04-4）
- `package.json` に `private: true` があり、実 publish が拒否される（AC-04-5。検証は下記の Why not）
- `package.json` の `version` が `.claude-plugin/plugin.json` の `version`（現在 `0.14.2`）と一致する

**制約**

- `"type": "module"` を設定しない。`editors/server.js` と `editors/lib/*.js` は `module.exports` の
  CJS であり、ESM 化すると Claude Code plugin 経路と `editor.html` の script 読み込みが同時に壊れる。
  テストファイル側の `import` 構文は vitest の transform が処理する
- 依存の追加は `vitest` のみ（spec F群）

**検証**

```bash
npm install
npm test
git status --porcelain
node -e "const p=require('./package.json'),g=require('./.claude-plugin/plugin.json');
if(p.private!==true)throw new Error('private:true が無い');
if(p.version!==g.version)throw new Error('version 不一致: '+p.version+' vs '+g.version);
console.log('ok')"
```

期待出力:

- `npm test` — 6 ファイル（file-io / object-logic / server-core / shared / variant-manager / view-logic）の
  テストが全て pass し、exit 0
- `git status --porcelain` — `node_modules/` と `.DS_Store` を含む行が 1 つも出ない
- `node -e` — `ok` を出力して exit 0。`private: true` と version 一致の両方をここで判定する

**Why not（`npm publish --dry-run` で AC-04-5 を検証する）**: npm 11 の `--dry-run` は
`private` を評価せず exit 0 を返す（実測: `private` の有無で挙動が変わらない）。
実 publish は拒否するが、それは検証のために踏める操作ではない。
フィールドの存在検査が、この AC に対して実行可能な唯一の証拠になる。

## Task 2: `bin/model-editor.js` の `serve` サブコマンド

変更ファイル: bin/model-editor.js, package.json
依存: Task 1
予算: +60 行

**アウトカム**

- `npx github:taketetsu1982/model-editor serve <path> [port]` 相当の経路で、既存
  `node editors/server.js <path> [port]` と同じ挙動になる（AC-04-2）。stdout へ出る URL 1 行の書式も同じ
- サブコマンド無し・未知のサブコマンドは、有効なサブコマンド名を含むメッセージを stderr に出して非 0 終了する
- `mcp` は Phase 2 で実装されるため、Phase 1 では未実装である旨を返して非 0 終了する（無言で成功しない）

**制約**

- `bin/` は引数解釈のみを持つ。ファイル I/O とサーバ配信のロジックを `bin/` に書かない（spec B群の責務境界）
- `editors/server.js` を変更しない。変更が必要に見えたら Scope 外としてエスカレーションする
- `bin/model-editor.js` に shebang を置き、実行権限を付けてコミットする（`npx` が直接起動するため）

**検証**

```bash
node bin/model-editor.js serve sample/product-model.json 8790 &
sleep 1; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8790/model; kill %1
npm exec model-editor -- serve sample/product-model.json 8791 &
sleep 1; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8791/model; kill %1
node bin/model-editor.js; echo "exit=$?"
node bin/model-editor.js bogus; echo "exit=$?"
node bin/model-editor.js mcp 2>&1 >/dev/null | grep -q 'Phase 2'; echo "mcp_msg=$?"
node bin/model-editor.js mcp; echo "exit=$?"
npm test
```

期待出力:

- 前 2 ブロック — 起動直後の stdout に `http://localhost:8790/` / `http://localhost:8791/` が 1 行ずつ出て、
  `curl` が `200` を返す
- 引数無し / `bogus` / `mcp` — いずれも stderr にメッセージが出て `exit=` が 0 以外
- `mcp_msg=0` — `mcp` の stderr が `Phase 2` を含む（「未知のサブコマンド」で片付けず、
  実装予定であることが読み取れる）
- `npm test` — Task 1 と同じく全て pass（回帰が無いこと）

## 検証

各 Task の検証コマンドを Task 単位で実行する。Phase 全体の合格判定は Task 2 完了時点で:

```bash
npm ci && npm test
node bin/model-editor.js serve sample/product-model.json 8792 & sleep 1; kill %1
bash ~/.claude/scripts/pr-size-check.sh main
```

## Test Plan

- **自動**: 既存 `editors/lib/*.test.js`（vitest）。Phase 1 は既存テストを**実行可能にする**ことが目的で、
  テストの新規追加は行わない。回帰検出はこの 6 ファイルが担う
- **手動**: `bin` の疎通は上記検証コマンドで手動確認する。子プロセス起動を自動テスト化する対象は
  Phase 2 の `src/mcp/editor-process.js` であり、Phase 1 では入れない（テストのためだけに
  `bin` へ抽象を足すと責務境界が崩れる）
- **未カバー**: `npx github:` 経由の実配布は main へ merge されるまで検証できない。
  merge 後に 1 度だけ `npx github:taketetsu1982/model-editor serve <path>` を実行して確認する

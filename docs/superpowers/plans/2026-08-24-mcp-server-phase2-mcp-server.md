---
class: 使い捨て
owner: main-session
retire: Phase 2 の全 Task が merge された時点で docs/superpowers/plans/done/ へ移動する
---

# Phase 2: MCP サーバー本体 — Implementation Plan

参照 spec: `docs/superpowers/specs/2026-08-21-mcp-server-design.md`
対象 Phase: 2（3 Phase のうち 2 番目。Phase 1 完了済み、Phase 3 の前提）

## Goal

`npx github:taketetsu1982/model-editor mcp` で起動する stdio MCP サーバーを実装し、任意の MCP
クライアントから **tool だけで**（prompts / resources 非対応クライアントでも）手法論の取得・モデル JSON の
読み書き・ローカルエディタ起動に到達できる状態にする。Phase 1 が作った配布の器に、中身を入れる Phase。

## Scope

- `src/mcp/server.js` — stdio サーバーの組み立てと tool モジュールの登録
- `src/mcp/tools/` — tool / resource / prompt の実装（手法論・モデル I/O・エディタ）
- `src/mcp/editor-process.js` — `editors/server.js` の子プロセス管理（起動・停止・アイドル停止）
- `src/mcp/test-client.js` — テストから MCP クライアントとして接続するための共有ハーネス
- `bin/model-editor.js` の `mcp` 分岐を「未実装エラー」から実装へ差し替える
- `@modelcontextprotocol/sdk` を runtime 依存として追加する
- README への MCP クライアント設定手順の追記

対応 US: US-01 / US-02 / US-03 / US-04（AC-04-1 のみ）。
実装 AC: AC-01-1〜5 / AC-02-1〜5 / AC-03-1〜5 / AC-04-1。

## Out of Scope

- 手法論 markdown の single source 化と `{EDITOR_DIR}` 除去（Phase 3。AC-05-1〜4）。
  本 Phase の MCP サーバーは `skills/` 配下を**読む側**に回るだけで、`skills/` を変更しない
- `editors/server.js` と `editors/lib/*` の変更。外部インターフェース（引数と stdout の URL 1 行）を
  変更しないことが契約である（spec `docs/superpowers/specs/2026-08-21-mcp-server-design.md#b群-構造`）
- モデル JSON のスキーマ検証（`validate_model`。#51）。`save_model` が弾くのは Task 3 に列挙した
  形式不正だけで、`schema.md` の制約は見ない
- CDN 依存（#52）・`open` の macOS 依存（#53）・version 二重管理（#54）・外部変更の検知（#55）・
  CI（#56）。いずれも spec G群でスコープ外と確定済み
- サーバー自身による LLM 呼び出し、クラウド／リモート実行対応
  （spec `docs/superpowers/specs/2026-08-21-mcp-server-design.md#a群-方向づけ` の非目標）
- npm publish（`private: true` を維持する）

## Interface

本 Phase が実装する外部契約の本文は spec
`docs/superpowers/specs/2026-08-21-mcp-server-design.md#d群-契約の精度` が正（MCP tools 表 / prompts・
resources 表 / CLI 表）。plan では再掲しない。エディタプロセスの状態遷移と失敗時の挙動は spec
`docs/superpowers/specs/2026-08-21-mcp-server-design.md#c群-振る舞いの全域` の状態遷移表・失敗表が正。
`src/mcp/` のファイル構成と、単一 `tools.js` にしない理由も spec
`docs/superpowers/specs/2026-08-21-mcp-server-design.md#b群-構造` が正（本 plan の退役後も参照されるため
spec 側に置いた）。

### Task 間で共有する内部契約（Task 1 が確定させる）

spec の外部契約ではなく、本 plan の Task を並列に流すために Task 1 が先に固定する実装内部の取り決め。

- `src/mcp/tools/` 直下の `*.js`（`*.test.js` を除く）は `register(ctx)` を export する。
  `src/mcp/server.js` は起動時にディレクトリを走査して全モジュールを登録する
- `ctx` は少なくとも `{ server, onToolCall(cb), onShutdown(cb) }` を持つ。
  `onToolCall` は任意の tool 呼び出しごとに発火し（AC-03-4 のアイドル起点）、`onShutdown` は
  クライアント切断・プロセス終了で発火する（子プロセスを道連れにするため）
- **capability の宣言は `src/mcp/server.js` が一括で持つ**（tools / resources / prompts の 3 つを
  常に宣言する）。各モジュールは `ctx.server` の登録 API を呼ぶだけで、capability に触らない——
  ここを各モジュールに委ねると、Task 2 / 5 が `server.js` を触ることになり並列性が壊れる
- テストから MCP クライアントとして接続するときは、各テストで spawn 手続きを書かず
  `src/mcp/test-client.js` を使う（起動 → stdio 接続 → `initialize` → teardown を提供する）。
  Task 1 が `server.test.js` のために必要とするものを、そのまま共有物として置く

## UI 裁量範囲

N/A。本 Phase はプロトコル境界の実装であり、エディタの画面・コンポーネントは一切変更しない
（spec `docs/superpowers/specs/2026-08-21-mcp-server-design.md#e群-ui-投影`）。

## 実装 AC

| Task | AC-ID |
|---|---|
| Task 1 | AC-04-1 |
| Task 2 | AC-01-1 / AC-01-2 / AC-01-3 / AC-01-4 / AC-01-5 |
| Task 3 | AC-02-1 / AC-02-2 / AC-02-3 / AC-02-4 / AC-02-5 |
| Task 4 | AC-03-4 |
| Task 5 | AC-03-1 / AC-03-2 / AC-03-3 / AC-03-5 |

## 依存 Task

- Task 1 は先行（共有契約と共有テストハーネス）。Task 2 / 3 / 4 は Task 1 にのみ依存し、
  互いに独立＝並列に流せる
- Task 5 は Task 4 に依存する（エディタ tool は子プロセス管理と、その失敗注入の口の上に載る）
- Phase 間は直列。Phase 3 は本 Phase の全 Task が merge されるまで着手しない（spec B群）

---

## Task 1: stdio MCP サーバーの起動基盤

変更ファイル: package.json, package-lock.json, bin/model-editor.js, src/mcp/server.js, src/mcp/test-client.js, src/mcp/server.test.js
依存: なし
予算: +230 行

**アウトカム**

- `node bin/model-editor.js mcp` が stdio で MCP サーバーとして起動し、MCP クライアントの
  `initialize` に応答する（AC-04-1）。`npm pack` した tarball 経由の `model-editor mcp` でも同じ
- `src/mcp/tools/` 配下に置かれた `register(ctx)` モジュールが起動時に自動登録される。
  この時点では配下が空でも正常に起動する（tool 0 件のサーバーとして成立する）
- capability として tools / resources / prompts の 3 つを宣言する。配下のモジュールが 0 件でも同じ
- 標準出力は MCP のプロトコル通信だけが流れる。ログ・診断はすべて stderr へ出す
- **stdin の EOF・クライアント切断・`SIGINT` / `SIGTERM` で `onShutdown` が発火し、`exit 0` で終了する**
- `src/mcp/test-client.js` が、起動 → stdio 接続 → `initialize` → teardown を 1 箇所で提供する

**制約**

- 既存 CJS を ESM 化しない（`package.json` に `"type": "module"` を足さない）。`editors/` は
  `module.exports` の CJS であり、ESM 化すると plugin 経路と `editor.html` が同時に壊れる。
  SDK の読み込み形式が CJS と合わない場合は `src/mcp/` 内で動的 `import()` を使って吸収する
- 依存の追加は `@modelcontextprotocol/sdk` のみ（spec F群）
- `editors/server.js` を変更しない
- **stdout への書き込みを `src/mcp/` と `bin/model-editor.js` の `mcp` 経路に書かない**。
  JSON-RPC のフレームを壊す
- README への設定手順の追記は Task 5 が持つ（tool が 0 件の状態で導入手順を出荷しないため）

**検証**

```bash
npm install && npm test
node -e "
const {spawn}=require('child_process');
const p=spawn(process.execPath,['bin/model-editor.js','mcp'],{stdio:['pipe','pipe','pipe']});
let out='';p.stdout.on('data',d=>out+=d);
const req={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'t',version:'0'}}};
p.stdin.write(JSON.stringify(req)+'\n');
setTimeout(()=>{p.kill();
  const ok=/\"id\":1/.test(out)&&/serverInfo/.test(out);
  console.log(ok?'initialize=ok':'initialize=NG: '+out);
  process.exit(ok?0:1);},3000);
"
PACKDIR=$(mktemp -d) && npm pack --pack-destination "$PACKDIR" \
  && npm --prefix "$PACKDIR" install "$PACKDIR"/model-editor-*.tgz \
  && "$PACKDIR"/node_modules/.bin/model-editor mcp < /dev/null > /dev/null 2>&1
echo "packed_exit=$?"
grep -rnE 'console\.(log|info|dir|table)|process\.stdout\.write' src/mcp/ bin/ | grep -v '\.test\.js'
echo "stdout_write_hits=$?"
git status --porcelain | grep -c 'model-editor-.*\.tgz'
```

期待出力:

- `npm test` — 既存 6 ファイル + 新規 `src/mcp/server.test.js` が全て pass し exit 0。
  `server.test.js` は `test-client.js` 経由で接続し、`initialize` 応答・tool 0 件での
  `tools/list` 成功・3 capability の宣言・teardown 後のプロセス消滅を判定する
- `initialize=ok` — stdio で JSON-RPC の応答が返る（AC-04-1）
- `packed_exit=0` — tarball 経由の `model-editor mcp` が起動し、stdin の EOF で `exit 0` する
  （0 以外はすべて NG。127 はコマンド不在）
- `stdout_write_hits=1` — `grep` が 1 件もヒットしない（exit 1）こと。ヒットしたら NG
- 最終行が `0` — `model-editor-*.tgz` が作業ツリーに残っていない
  （`--pack-destination` で一時ディレクトリへ出すため）

**Why not（`bin` から `src/mcp/server.js` を子プロセスで起動する）**: Phase 1 の `serve` は
`editors/server.js` の「引数と stdout」という既存契約を保つために子プロセスを選んだ。`mcp` は
stdio そのものがプロトコル面であり、間にプロセスを挟むと stdin/stdout の中継を自前で持つことになる。
`src/mcp/server.js` を `require` して同一プロセスで起動する。

**Why not（テストハーネスを各 Task に書かせる）**: spawn → stdio 接続 → `initialize` → teardown は
40〜60 行あり、3 本のテストで重複するか、先着 Task の実装に後続が依存する。後者は Task 2 / 3 / 4 の
「Task 1 にのみ依存」という宣言と食い違う未宣言の依存になる。Task 1 が自身のテストで同じものを
必要とするので、ここに置けば追加コストは実質ゼロで済む。

## Task 2: 手法論の取得（tool / resource / prompt）

変更ファイル: src/mcp/tools/guide.js, src/mcp/tools/guide.test.js
依存: Task 1
予算: +200 行

**アウトカム**

- `get_modeling_guide` を section 無しで呼ぶと glossary / schema / patterns / examples の全文が
  連結して返る（AC-01-1）。section 指定でその 1 本だけが返る（AC-01-2）
- 未知の section は、有効な section 名の一覧を含むエラーになる。**無言で全文を返さない**（AC-01-3）
- 同じ 4 本が resource として列挙され、`model-editor://guide/<section>` で読める（AC-01-4）
- `generate` prompt が登録される。prompt / resource に非対応のクライアントでも、
  `get_modeling_guide` だけで AC-01-1〜3 と等価の内容に到達できる（AC-01-5）

**制約**

- markdown の実体は `skills/generate/{glossary,schema,patterns,examples}.md` を読む。
  **内容を `src/mcp/` へ複製しない**（Phase 3 の single source 化の前提を壊す）
- `skills/` 配下のファイルを変更しない（Phase 3 のスコープ）
- パス解決はパッケージルート基準にする。`process.cwd()` に依存すると `npx` 起動で壊れる
- section の語は spec の MCP tools 表・resources 表と同一（`glossary` / `schema` / `patterns` /
  `examples`）。tool と resource で別の語を使わない
- capability の宣言に触らない（Task 1 の `server.js` が持つ）

**検証**

```bash
npm test -- src/mcp/tools/guide.test.js
npm test
```

期待出力:

- `guide.test.js` が全て pass。テストは `src/mcp/test-client.js` 経由でサーバーへ接続し、以下を判定する:
  - section 無し → 4 本の markdown それぞれの冒頭 1 文がすべて応答に含まれる（AC-01-1）
  - `section: "schema"` → `schema.md` の冒頭 1 文を含み、`patterns.md` の冒頭 1 文を含まない（AC-01-2）
  - `section: "bogus"` → エラー応答であり、本文に 4 つの有効な section 名がすべて含まれる（AC-01-3）
  - `resources/list` に `model-editor://guide/glossary` 他 3 本が並び、`resources/read` が
    対応 markdown を返す（AC-01-4）
  - `tools/list` と `tools/call` だけで上の 3 つが再現できる（AC-01-5）
- `npm test` — 全体が pass（回帰なし）

## Task 3: モデル JSON の読み書き

変更ファイル: src/mcp/tools/model-io.js, src/mcp/tools/model-io.test.js
依存: Task 1
予算: +230 行

**アウトカム**

- `read_model(path)` が対象 JSON をパースして返す。存在しないパスはパスを含むエラー（AC-02-1）
- `save_model(path, model)` は形式不正を**書き込まずに**弾く（AC-02-2）。弾く対象は次の 2 つ:
  (a) `model` が object でない、(b) `JSON.stringify` が失敗する（循環参照など）。
  **`schema.md` の制約は検証しない**——`validate_model`（#51）としてスコープ外
- 書き込みは一時ファイル → rename の原子的置換（AC-02-3）。既存 `editors/server.js` の PUT /model と同じ
- 存在しないパスへは新規作成する。ただし親ディレクトリが無い場合はディレクトリを作らずエラー（AC-02-5）
- **既存ファイルがある場合に限り**、それが `_variants` を持つなら `force: true` 無しでは書き込まず
  エラーになる。`force: true` なら書き込む（AC-02-4）
- tool description に「path はホスト側の権限機構が一次のゲートであり、サーバー側でパスを制限しない」旨が
  明記される（spec `docs/superpowers/specs/2026-08-21-mcp-server-design.md#f群-横断的関心事`）

**制約**

- パストラバーサルのガードを `read_model` / `save_model` に足さない。制限しないことが spec F群の判断で、
  ここで独自に絞ると MCP クライアントからの正当な絶対パス指定が壊れる
- rename 失敗時に一時ファイルを残さない
- `editors/lib/*` を変更しない。共通化したくなっても Scope 外としてエスカレーションする
- テストは一時ディレクトリ内で完結させる。`sample/product-model.json` を書き換えない
- capability の宣言に触らない（Task 1 の `server.js` が持つ）

**検証**

```bash
npm test -- src/mcp/tools/model-io.test.js
npm test
git status --porcelain sample/
```

期待出力:

- `model-io.test.js` が全て pass。判定内容:
  - 既存 JSON を `read_model` → 内容が一致。存在しないパス → エラー本文にそのパスを含む（AC-02-1）
  - `model` が object でない場合と循環参照の場合の `save_model` → いずれもエラーかつ
    **元ファイルが 1 バイトも変わらない**（AC-02-2）
  - `save_model` 成功後に `.tmp` が残っていない（AC-02-3）
  - 存在しないファイル → 新規作成される。存在しない親ディレクトリ → エラーかつ
    ディレクトリが作られていない（AC-02-5）
  - `_variants` を持つ既存ファイルへの `save_model` → エラーかつ内容不変。`force: true` → 成功。
    `_variants` を持たない既存ファイルは `force` 無しで成功（AC-02-4）
- `npm test` — 全体が pass
- `git status --porcelain sample/` — 出力が空（テストが実ファイルを汚していない）

## Task 4: エディタ子プロセスのライフサイクル管理

変更ファイル: src/mcp/editor-process.js, src/mcp/editor-process.test.js
依存: Task 1
予算: +220 行

**アウトカム**

spec `docs/superpowers/specs/2026-08-21-mcp-server-design.md#c群-振る舞いの全域` の状態遷移表どおりに
`editors/server.js` を子プロセスとして管理するモジュールが存在する。

- 起動すると子プロセスの stdout に出る `http://localhost:<port>/` を取得して URL を返す
- 同じ path での再起動要求は新規起動せず既存 URL を返す。別 path なら旧プロセスを停止して起動し直す
- 停止は冪等。未起動での停止呼び出しもエラーにしない
- **アイドル計測の reset 入口を本モジュールが持つ**。最後の reset から 30 分でアイドル停止し、
  reset がある限り停止しない（AC-03-4）。呼び出し側はこの入口へ `ctx.onToolCall` を繋ぐだけ。
  ブラウザからの HTTP アクセスは起点に数えない（子プロセスの出力を reset に数えない）
- 子プロセスの異常終了を検知して状態を「停止」へ戻し、次の起動要求で再起動できる
- 起動失敗（ポート全滅・bind 不可）を、汎用エラーではなく原因が読み取れる形で呼び出し側へ返す

**制約**

- `editors/server.js` を変更しない。stdout の URL 1 行という既存契約を読む側に立つ
- アイドル判定の時計とタイマーは注入可能にする。**テストが実時間で 30 分待たないこと**
- **子プロセスの spawn を注入可能にする**。bind 失敗・ポート全滅を実環境に依存せず注入できること
  （AC-03-5 の文言を Task 5 が検証するための口。実ポートを枯渇させるテストは不安定で採らない）
- 30 分という値をこのモジュールの外に散らさない（tool 側から渡す設計にしない）
- 孤児プロセスを残さない。親の終了・`onShutdown` で子を kill する

**検証**

```bash
npm test -- src/mcp/editor-process.test.js
npm test
```

期待出力:

- `editor-process.test.js` が全て pass。判定内容:
  - 起動 → 返る URL が `http://localhost:<port>/` 形式で、その URL の `/model` が HTTP 200 を返す
  - 同 path で再度起動要求 → 返る URL が同一で、子プロセスが増えていない
  - 別 path で起動要求 → 新しい URL が返り、旧プロセスが終了している
  - 停止 → 冪等（2 回呼んでもエラーにならない）。未起動での停止も正常終了
  - 注入した時計を 30 分進める → 子プロセスが終了している。29 分では終了していない（AC-03-4）
  - 29 分の時点で reset 入口を発火 → さらに 29 分進めても子プロセスは生存し、そこから 30 分で
    終了する（「使い続けている間は落ちない」側。AC-03-4）
  - spawn を注入して bind 失敗を起こす → 汎用エラーではなく原因が判別できる形で返る
  - 子プロセスを外から kill → 状態が「停止」に戻り、再起動できる
  - テスト終了時、**テスト自身が spawn した子 PID がすべて終了している**
    （`pgrep` で全体を見ると別セッションの `model-editor serve` を巻き込むので使わない）
- `npm test` — 全体が pass

## Task 5: `open_editor` / `close_editor` tool と導入手順

変更ファイル: src/mcp/tools/editor.js, src/mcp/tools/editor.test.js, README.md, README.ja.md
依存: Task 4
予算: +200 行

**アウトカム**

- `open_editor(path)` がローカルサーバを起動し、`{ url }` を返して**即座に return する**。
  編集完了を待たない（AC-03-1）
- 起動中に再度 `open_editor` を呼ぶと、新規起動せず既存の URL が返る（AC-03-2）
- `close_editor()` は起動中のサーバを停止する。起動していない場合もエラーにせず正常終了する（AC-03-3）
- `open_editor` の description に「ローカル実行環境専用」が明記され、bind 失敗時は汎用エラーではなく
  **この実行環境では起動できない**旨と、`read_model` / `save_model` での編集への案内を返す（AC-03-5）
- 存在しないモデルパスは、パスを含むエラーになる（spec C群の失敗表）
- `ctx.onToolCall` を Task 4 のアイドル reset 入口へ繋ぐ（タイマーのロジックは持たない）
- `edit` prompt が登録される
- README（英語）と README.ja.md に MCP クライアントの設定手順が載る。**ここで初めて導入手順が
  出荷される**——tool が揃うのが本 Task だから

**制約**

- ブラウザを開かない（`open` コマンドを呼ばない）。URL を返すところまでが tool の責務で、
  開くのはクライアント側。ここで開くと #53 の macOS 依存を MCP サーバーへ持ち込むことになる
- 子プロセス管理のロジックを本ファイルへ再実装しない。Task 4 のモジュールを使う
- `skills/edit/SKILL.md` の内容を `src/mcp/` へ複製せず、`skills/` 配下も変更しない
  （Task 2 と同じ理由。Phase 3 の single source 化の前提を壊す）
- `127.0.0.1` バインドを変更しない（spec F群）
- capability の宣言に触らない（Task 1 の `server.js` が持つ）
- ルート `README.md` は英語で書く（`.claude/rules/language.md`）。`README.ja.md` は日本語

**検証**

```bash
npm test -- src/mcp/tools/editor.test.js
npm test
```

期待出力:

- `editor.test.js` が全て pass。テストは `src/mcp/test-client.js` 経由で接続して判定する:
  - `open_editor` の応答が 5 秒以内に返り、`url` の `/model` が HTTP 200（AC-03-1）
  - 続けて `open_editor` → 同一 URL（AC-03-2）
  - `close_editor` → 成功。続けてもう 1 度 `close_editor` → やはり成功（AC-03-3）
  - `tools/list` の `open_editor` の description に「ローカル」「local」いずれかを含む文言があり、
    Task 4 の注入口で bind 失敗を起こしたときの応答に `read_model` / `save_model` への案内が
    含まれる（AC-03-5）
  - 存在しないパスでの `open_editor` → エラー本文にそのパスを含む
  - `open_editor` 後にクライアントを切断（teardown）→ テストが spawn したエディタ子プロセスが
    残っていない（spec C群の状態遷移表「起動中 + クライアント切断 → 道連れ」）
- `npm test` — 全体が pass

## 検証

Task ごとに上記の検証コマンドを実行する。Phase 全体の合格判定は Task 5 完了時点で:

```bash
npm ci && npm test
node bin/model-editor.js mcp < /dev/null; echo "exit=$?"
bash ~/.claude/scripts/pr-size-check.sh main; echo "size_exit=$?"
```

期待出力:

- `npm test` — 既存 6 ファイル + 新規 5 ファイルが全て pass し exit 0
- `exit=0` — stdin の EOF で正常終了する（Task 1 で決めた終了コード）
- `size_exit=0` — 粒度規定の上限内

加えて **実クライアント 2 系統での手動疎通を必須とする**（spec
`docs/superpowers/specs/2026-08-21-mcp-server-design.md#f群-横断的関心事`）。`npm pack` した tarball を
インストールし、Claude Code と Codex の双方に MCP サーバーとして登録して、各 1 回ずつ実行する:

1. `get_modeling_guide`（section 無し）が手法論を返す
2. `read_model` → `save_model` でモデルが更新される
3. `open_editor` で返った URL がブラウザで開き、`close_editor` で停止する

結果は Task 5 の PR 本文に記録する。**`npx github:` は開発環境の npm 設定で禁止されている**
（`EALLOWGIT`）ため、配布経路の検証は tarball で代替する（Phase 1 で実測・成功）。

## Test Plan

- **自動**: vitest。新規テストは 5 本（`src/mcp/server.test.js` / `tools/guide.test.js` /
  `tools/model-io.test.js` / `editor-process.test.js` / `tools/editor.test.js`）。tool 系は
  **`src/mcp/test-client.js` 経由で実際に stdio 接続して**判定する——SDK の登録 API を経由せず
  内部関数を直接呼ぶと、プロトコル面（tool 名・スキーマ・エラー形式）が検証されない。
  子プロセスの生存判定は、テスト自身が spawn した PID 集合に対して行う
- **手動**: 実クライアント 2 系統（Claude Code / Codex）の疎通。上記「検証」節の 3 項目。
  クライアント側の tool 自動選択の質は判定対象に含めない（spec A群でハーネス差は残ると確定済み）
- **未カバー**:
  - `npx github:` 経由の実配布（main へ merge されるまで検証できない。merge 後に 1 度実行して確認する）
  - サンドボックス環境での bind 失敗（AC-03-5）の実環境再現。テストでは Task 4 の注入口から
    bind 失敗を起こして応答文言だけを判定する
  - エディタ編集中の外部変更（#55。既知の制約であり本 Phase で扱わない）

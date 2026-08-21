# model-editor の MCP サーバー化 設計

作成日: 2026-08-21
ブランチ: `docs/mcp-server-spec`（実装は Phase ごとに別ブランチ）

## A群. 方向づけ

### 背景

model-editor は現在 **Claude Code プラグイン形式でしか配布されていない**（`.claude-plugin/plugin.json` + `skills/generate` `skills/edit`）。手順書の中身自体はハーネス中立な markdown だが、配布・発見・パス解決の3層が Claude Code 固有になっている。

OrcaRouter の built-with への掲載を機に、他のエージェント環境からも使えるようにしたい。ここで OrcaRouter は**エージェントハーネスではなく LLM ゲートウェイ／ルーター**であり、「プラグインをインストールする受け皿」は存在しない。OrcaRouter がクライアント側の入口として提供しているのは MCP サーバーである。

Claude Code / Codex / Cursor / Windsurf / Zed を横断する**共通分母は MCP だけ**であり、各ハーネス固有形式で個別対応すると配布物を永久に人手で保守することになる。

### 目的

model-editor を MCP サーバーとして配布し、任意の MCP クライアントから OOUI モデリング手法とモデル JSON の読み書き・視覚編集を利用できるようにする。

### 非目標（YAGNI で落としたもの）

| 落としたもの | 理由 |
|---|---|
| サーバー自身による LLM 呼び出し（`generate` を tool 化する） | PRD からのモデル抽出はホスト側 LLM の仕事。サーバーが LLM を呼ぶ設計にすると API キー管理・課金・プロバイダ選択が新規に発生し、「どのクライアントからでも使える」という目的と直交する |
| クラウド／リモート実行対応（ホスト版エディタ） | 人間承認済みの判断としてローカル限定。`open_editor` は localhost バインドとブラウザを前提とする |
| `validate_model`（`schema.md` の制約の機械検証） | 価値はあるが検証ロジックの新規実装が必要で Epic が肥大する。Open Issues に残し、別 spec とする |
| CDN 依存のベンダリング・`open` のクロスプラットフォーム対応 | 設計判断を伴わない独立した不具合修正。本 spec を通さず個別 PR で出す |

### 成功条件

Claude Code 以外の MCP クライアント（Codex / Cursor のいずれか）から、MCP 設定1つで、モデリング手法の取得・モデル JSON の読み書き・ローカルエディタ起動が行える。かつ Claude Code の既存 `/generate` `/edit` が従来通り動作する。

## B群. 構造

### 現状の実態（grounding: 2026-08-21 時点、`git ls-files` で確認）

| 事実 | 影響 |
|---|---|
| `package.json` が存在しない | `npx` 配布ができない。依存を宣言する場所が無い |
| `.gitignore` が存在しない | `node_modules/` を作った瞬間にリポジトリが汚れる。`.DS_Store` も現に未追跡で散在している |
| `editors/lib/*.test.js` は vitest 製（計 1,617 行）だが、vitest がどこにも宣言されておらず `node_modules/` は空 | **テストが1本も実行できない状態**。Phase 1 は機能追加ではなく欠落の修復 |
| CI 設定（`.github/`）が存在しない | 検証は手元実行のみ |
| `editors/server.js` は引数 `<modelPath> [port]` を取り、起動成功時に stdout へ `http://localhost:<port>/` を1行出力する | MCP サーバーから子プロセスとして再利用できる。URL の取得は stdout パースで足りる |
| `editors/lib/server-core.js` は `module.exports` 対応の IIFE で I/O を持たない純粋ヘルパ | Node 側から `require` して再利用できる |
| `skills/generate/{glossary,schema,patterns,examples}.md` が手法論の実体 | MCP からも Claude Code plugin からも、この単一実体を参照させる |
| `skills/*/SKILL.md` に `{EDITOR_DIR}` プレースホルダがあり「導入時に実際のパスに置換すること」と書かれている | 手作業置換が全ハーネスに伝播する。npm 化で解消する |

### 変更後の構成

```
model-editor/
├── package.json          ★新規 — name/bin/scripts/devDependencies
├── .gitignore            ★新規
├── bin/model-editor.js   ★新規 — サブコマンド分岐（serve / mcp）
├── src/mcp/              ★新規 — MCP サーバー本体
│   ├── server.js         ・  stdio サーバーの組み立て
│   ├── tools.js          ・  tool 定義と実装
│   └── editor-process.js ・  editors/server.js の起動・停止・アイドル監視
├── editors/              既存（server.js / editor.html / lib）
└── skills/generate/*.md  既存 — 手法論の単一実体。MCP と plugin の両方が参照する
```

責務境界: `bin/` は引数解釈のみ、`src/mcp/` はプロトコル境界のみ、実際のファイル I/O とサーバー配信は既存 `editors/` に委ねる。**既存 `editors/server.js` の外部インターフェース（引数と stdout 出力）は変更しない**——変更すると Claude Code plugin 側の `/edit` が同時に壊れる。

### Phase 分割（＝ PR 単位）

| Phase | 内容 | 対応 US |
|---|---|---|
| 1 | npm パッケージ化・`.gitignore`・vitest を devDependency 化してテストを実行可能にする | US-04（一部） |
| 2 | MCP サーバー本体の実装 | US-01 / US-02 / US-03 |
| 3 | 手法論の single source 化、`SKILL.md` から `{EDITOR_DIR}` を除去 | US-04（残り）/ US-05 |

Phase 1 は Phase 2 の前提（依存を宣言する場所が無いと SDK を入れられない）。Phase 3 は Phase 2 完了後でないと参照先が確定しない。**直列**である。

#### Phase 3 の置換後の姿（`{EDITOR_DIR}` は 2 用途に効いているので個別に決める）

| 用途 | 現状 | 置換後 |
|---|---|---|
| `skills/edit/SKILL.md:27-31` のサーバ起動 | `node {EDITOR_DIR}/server.js <path>` | `npx github:taketetsu1982/model-editor serve <path>` — 単純置換で等価 |
| `skills/generate/SKILL.md:18,160` の出力先 | `{EDITOR_DIR}/product-model.json`（エディタ設置ディレクトリ固定） | **ユーザープロジェクト側**へ変更する |

出力先の変更は**意図的な振る舞いの変更**である。npm 化後は「エディタ設置ディレクトリ」が npx のグローバルキャッシュを指すことになり、生成物の置き場所として成立しない。決め方は `skills/edit/SKILL.md:19-23` の既存の検出ロジックを踏襲する——引数でパスが渡ればそれ、省略時はプロジェクト内の `product-model.json` を 1 件検出。ただし **0 件時の挙動だけは edit と異なり**、edit が中断するのに対し generate はカレントディレクトリ直下に新規作成する（generate は新規モデルの書き出しが本来の用途であるため）。

## C群. 振る舞いの全域

### ユーザーストーリー

| ID | ストーリー | MoSCoW |
|---|---|---|
| US-01 | MCP クライアントの利用者として、OOUI モデリング手法（用語・スキーマ・パターン・具体例）を取得したい。プロダクトモデル JSON を正しい形で生成できるようにするため | Must |
| US-02 | MCP クライアントの利用者として、プロダクトモデル JSON を読み書きしたい。エディタを開かずに差分編集を完結させるため | Must |
| US-03 | ローカル環境の利用者として、MCP 経由でエディタを起動したい。モデルを視覚的に編集するため | Must |
| US-04 | 導入者として、パスの手作業置換なしに設定1つで導入したい。ハーネスごとの導入手順を覚えなくて済むように | Must |
| US-05 | メンテナとして、手法論の markdown を1箇所だけで保守したい。MCP と Claude Code plugin の記述が乖離しないように | Should |

### 受け入れ基準

| ID | 受け入れ基準 |
|---|---|
| AC-01-1 | `get_modeling_guide` を section 指定なしで呼ぶと、glossary / schema / patterns / examples の全文を連結して返す |
| AC-01-2 | section に `glossary` `schema` `patterns` `examples` のいずれかを指定すると、その1本だけを返す |
| AC-01-3 | 未知の section を指定すると、有効な section 名の一覧を含むエラーを返す（無言で全文を返さない） |
| AC-01-4 | 同じ内容が MCP resource としても列挙され、resource 対応クライアントから参照できる |
| AC-01-5 | prompts 非対応のクライアントでも、tool 呼び出しだけで AC-01-1〜3 と等価の結果が得られる |
| AC-02-1 | `read_model(path)` は対象 JSON をパースして返す。存在しないパスはその旨のエラーを返す |
| AC-02-2 | `save_model(path, model)` は JSON として妥当な入力のみ受け付け、不正な入力は書き込まずエラーを返す |
| AC-02-3 | `save_model` は一時ファイルへ書いてから rename する（既存 `editors/server.js` の PUT /model と同じ原子的置換） |
| AC-02-5 | `save_model` は存在しないパスに対して**新規ファイルを作成する**（generate 導線が新規モデルの書き出しを含むため）。ただし親ディレクトリが存在しない場合はディレクトリを作らずエラーを返す |
| AC-02-4 | **既存ファイルがある場合に限り**、それが `_variants` キーを持つなら、`save_model` は書き込まずエラーを返し、意図的な上書きには `force: true` を要求する（MCP tool は対話でユーザーに確認できないため、確認をパラメータへ外部化する） |
| AC-03-1 | `open_editor(path)` はローカルサーバを起動し、URL を返して即座に return する（編集完了を待たない） |
| AC-03-2 | 既にエディタが起動中の状態で `open_editor` を呼ぶと、新規起動せず既存の URL を返す |
| AC-03-3 | `close_editor()` は起動中のサーバを停止する。起動していない場合もエラーにせず正常終了する |
| AC-03-4 | **最後の MCP tool 呼び出しから 30 分**が経過したエディタサーバは自動停止する（`close_editor` の呼び忘れでプロセスが残らない）。ブラウザからのアクセスは起点に数えない |
| AC-03-5 | `open_editor` の description に「ローカル実行環境専用」と明記され、bind 失敗時は汎用エラーではなく非対応である旨を返す |
| AC-04-1 | `npx github:taketetsu1982/model-editor mcp` で MCP サーバーが stdio で起動する |
| AC-04-2 | `npx github:taketetsu1982/model-editor serve <path>` で従来の localhost エディタサーバが起動する（既存 `node editors/server.js` と同じ挙動） |
| AC-04-5 | `package.json` に `private: true` を置き、誤って npm publish されないようにする |
| AC-04-3 | `npm test` で `editors/lib/*.test.js` の全テストが実行され、パスする |
| AC-04-4 | `.gitignore` が `node_modules/` と `.DS_Store` を無視する |
| AC-05-1 | 手法論 markdown の実体は `skills/generate/` 配下の1箇所にのみ存在し、MCP サーバーと `skills/generate/SKILL.md` の双方がそれを参照する。**検証の痕跡を残す**——各 markdown の冒頭1文をリポジトリ全体に grep し、ヒットが1ファイルであることを確認して結果を PR 本文に書く（「複製が無い」は主張だけで通ってしまうため） |
| AC-05-2 | `skills/*/SKILL.md` に `{EDITOR_DIR}` プレースホルダが残っていない |
| AC-05-3 | Claude Code で `/generate` `/edit` が従来通り動作する（MCP サーバー未登録でも壊れない）。**ただし generate の出力先の変更（AC-05-4）はこの「従来通り」の対象から除外する** |
| AC-05-4 | `generate` の出力先は、引数指定 → プロジェクト内の `product-model.json` を 1 件検出 → 0 件ならカレント直下に新規作成、の順で決まる。エディタ設置ディレクトリには書かない |

### 状態遷移（エディタプロセス）

| 現状態 | イベント | 次状態 | 出力 |
|---|---|---|---|
| 停止 | `open_editor(path)` | 起動中(path) | URL |
| 起動中(p) | `open_editor(p)` | 起動中(p) | 既存 URL |
| 起動中(p) | `open_editor(q)`（p≠q） | 起動中(q) | 旧サーバを停止し新 URL |
| 起動中 | `close_editor()` | 停止 | ok |
| 停止 | `close_editor()` | 停止 | ok（冪等） |
| 起動中 | アイドルタイムアウト（最後の MCP tool 呼び出しから 30 分） | 停止 | —（次の tool 呼び出し時に停止済みと分かる） |
| 停止 | MCP クライアント切断 | 停止 | — |
| 起動中 | MCP クライアント切断 | 停止 | 子プロセスを道連れに終了する（孤児プロセスを残さない） |

### 失敗と回復

| 失敗点 | 検知 | 回復 | 観測 |
|---|---|---|---|
| モデルパスが存在しない | `read_model` / `open_editor` の入口 | パスを含むエラーを返す | tool のエラー応答 |
| 保存先の親ディレクトリが存在しない | `save_model` の入口 | ディレクトリを自動作成せずエラーを返す（意図しない場所への書き出しを防ぐ） | tool のエラー応答 |
| ポートが全滅（20回試行して空きなし） | `editors/server.js` の起動失敗 | エラーを返す。MCP サーバー自体は落とさない | stderr + tool のエラー応答 |
| localhost バインドがサンドボックスに阻まれる | 同上 | 「この実行環境ではエディタを起動できない」と明示し、`read_model`/`save_model` での編集を案内する | tool のエラー応答 |
| 保存対象が編集中に外部から変更された | 検知しない（**既知の制約**） | — | — |
| 子プロセスが異常終了 | 終了イベント | 状態を「停止」へ戻す。次の `open_editor` で再起動できる | stderr |

## D群. 契約の精度

本 spec が触れる境界は3つ: (1) MCP tool インターフェース、(2) `bin` の CLI インターフェース、(3) 既存 `editors/server.js` の起動インターフェース。(3) は**変更しない**ことが契約である。

契約の本文は以下の表を正とする。実装時に JSON Schema へ写すが、機械可読ファイルへの外出しは行わない（tool 数が少なく、SDK の定義がそのまま索引になるため）。

### MCP tools

| tool | 入力 | 出力 | 備考 |
|---|---|---|---|
| `get_modeling_guide` | `section?: "glossary" \| "schema" \| "patterns" \| "examples"` | markdown テキスト | 省略時は全文連結 |
| `read_model` | `path: string`（絶対パス推奨） | モデル JSON | パース失敗はエラー |
| `save_model` | `path: string`, `model: object`, `force?: boolean` | `{ ok: true }` | 原子的置換。新規作成可（親ディレクトリは作らない）。既存かつ `_variants` 保持なら `force: true` 無しでは拒否 |
| `open_editor` | `path: string` | `{ url: string }` | ローカル専用。編集完了を待たない |
| `close_editor` | なし | `{ ok: true }` | 冪等 |

### MCP prompts / resources

| 種別 | 名前 | 内容 |
|---|---|---|
| prompt | `generate` | `skills/generate/SKILL.md` 相当の手順（PRD → モデル JSON） |
| prompt | `edit` | `skills/edit/SKILL.md` 相当の手順（エディタ起動 → 編集 → 停止） |
| resource | `model-editor://guide/glossary` 他 3 本（`schema` / `patterns` / `examples`） | 対応する markdown。URI スキームは `model-editor://guide/<section>` で固定し、`<section>` は `get_modeling_guide` の section 値と同一の語を使う |

**prompts と resources は必須依存にしない。** クライアントごとに対応がまちまちであり、tool だけで全機能に到達できることを AC-01-5 で保証する。

### CLI

| コマンド | 挙動 |
|---|---|
| `model-editor mcp` | stdio で MCP サーバーを起動 |
| `model-editor serve <modelPath> [port]` | 既存 `editors/server.js` と同一の挙動 |

**配布経路は GitHub 直参照に確定する**（`npx github:taketetsu1982/model-editor <subcommand>`）。npm publish は行わない——パッケージ名 `model-editor` の可用性が未確認であることに加え、publish は取り消しの効かない外部公開であり、本 Epic の目的（任意の MCP クライアントから使える）は GitHub 直参照で達成できるため、その不可逆判断を負う理由がない。誤 publish を防ぐため `package.json` に `private: true` を置く（AC-04-5）。

Why not（npm publish）: コマンドが短くなり built-with 掲載の導線としても強いが、上記の通り目的に対して必須ではない。将来必要になった時点で `private` を外して publish すればよく、その判断を今する必要がない。

## E群. UI 投影

N/A。本 Epic は配布形態とプロトコル境界の変更であり、エディタの画面・コンポーネントの見た目や状態は一切変更しない。

## F群. 横断的関心事

| 関心事 | 方針 |
|---|---|
| セキュリティ（パストラバーサル） | 静的配信は既存 `resolveStaticPath` のガードをそのまま使う。`read_model` / `save_model` の path は MCP クライアント（＝ホスト LLM）が渡すため、**サーバー側では制限しない**——MCP サーバーはユーザーのローカル権限で動く道具であり、ホスト側の権限機構が一次のゲートである。この判断を tool description に明記する |
| ネットワーク露出 | 既存通り `127.0.0.1` のみにバインドする。変更しない |
| 依存 | `@modelcontextprotocol/sdk` を runtime 依存に、`vitest` を devDependency に入れる。それ以外は増やさない |
| 後方互換 | Claude Code plugin 経路（`skills/`）は Phase 3 完了後も動作し続ける。MCP 未登録でも壊れない（AC-05-3） |
| 検証 | 各 Phase で `npm test`。Phase 2 は加えて実クライアント（Claude Code と Codex の2系統）での手動疎通を必須とする |
| バージョニング | `.claude-plugin/plugin.json` と `package.json` の version を一致させる。乖離を検知する手段は現状無い（Open Issues） |
| 配布 | GitHub 直参照（`npx github:taketetsu1982/model-editor`）。npm publish しない。詳細と Why not は D 群の CLI 節 |

## G群. 執筆規律 / Open Issues

| # | 未解決事項 | 扱い |
|---|---|---|
| 1 | `validate_model`（`schema.md` の制約を機械検証する tool） | 本 Epic のスコープ外。別 spec を立てる |
| 2 | CDN 依存（`editor.html:29-31` の unpkg、`:7-8` の Google Fonts）— ネット制限環境で白画面になる | 独立した個別 PR。本 spec のスコープ外だが、クライアントが増えるほど踏まれるため優先度は高い |
| 3 | `open` コマンドの macOS 依存 | 同上。なお MCP 経由ではブラウザを開くのはクライアント側の判断になるため、影響範囲は plugin 経路に限られる |
| 4 | `plugin.json` と `package.json` の version 二重管理 | Phase 1 で人手同期とする。自動化は必要になってから |
| 5 | エディタ編集中の外部変更を検知しない（最終書き込み勝ち） | 既存の制約であり本 Epic で悪化しない。明示的に扱わない |
| 6 | CI が存在しない | 本 Epic では追加しない（`npm test` が通る状態を作るのが Phase 1 のスコープ）。CI 追加は別途 |

### 反証レビューで検討し、退けた前提

| 前提 | 反証 | 結論 |
|---|---|---|
| 「MCP にすれば全クライアントで同じ体験になる」 | prompts / resources の対応差、ツール自動選択の質の差が残る。同一にはならない | 前提を弱め、**tool だけで全機能に到達できる**ことを設計制約（AC-01-5）に格上げした |
| 「エディタ起動はどの環境でも動くべき」 | サンドボックス・クラウド実行では localhost バインドもブラウザ起動も不可能 | ローカル限定と明示し、失敗を「汎用エラー」ではなく「非対応の明示」として返す（AC-03-5） |
| 「Claude Code plugin は MCP に一本化すれば保守が減る」 | Claude Code 固有の description 駆動の自動起動とスラッシュコマンド表記が失われ、主要導線の使い心地が落ちる | 併存を採用。二重管理は手法論の single source 化（Phase 3）で回避する |

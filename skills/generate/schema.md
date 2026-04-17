# JSON Schema

```json
{
  "devices": [],
  "objects": [],
  "views": [],
  "paneGraph": [],
  "screens": []
}
```

| フィールド | 説明 |
|---|---|
| devices | Device一覧（文字列配列） |
| objects | Object定義 |
| views | Pane定義（type: "collection" / "single"） |
| paneGraph | Pane Graph — Pane間の辺定義（drilldown / embed） |
| screens | Screen定義（デバイス別Pane構成） |

## devices

```json
["mobile", "desktop"]
```

- プロダクトが対応するデバイス種別の一覧（文字列配列）
- Screen定義の `device` フィールドで参照される
- デフォルト: `["mobile", "desktop"]`

## objects

```json
{
  "id": "kebab-case識別子",
  "name": "表示名",
  "relations": [
    { "id": "一意ID", "targetId": "対象オブジェクトid", "type": "has-many | has-one | many-to-many" }
  ]
}
```

- Objectはフラットな配列。グルーピングはしない
- relationsの `type` は `has-many` / `has-one` / `many-to-many`
- **リレーションは一方向のみ定義する。** A→Bのhas-manyを定義したら、B→Aのhas-oneは定義しない。双方向に定義すると同じObject間に2本の線が描画されてしまう
- 方向の基準: 親（所有する側）→ 子（所有される側）の方向で定義する

## views（Pane）

各viewは「Pane」（表示の最小単位）を表す。Paneは画面そのものではなく、デバイスに応じて複数のPaneを組み合わせて1画面を構成する。

```json
{
  "id": "kebab-case識別子",
  "name": "Pane名",
  "type": "collection | single",
  "objectId": "object id",
  "fields": ["フィールド名"],
  "verbs": ["操作名"],
  "prompt": "このPaneが提供する情報と操作（自然言語）"
}
```

- `type`: `collection` = 一覧表示、`single` = 単体表示
- `objectId`: このPaneが表示するObjectのid
- 1つのObjectに対して複数のPaneを定義できる
- `prompt`: このPane自身の責務のみ記述する。他Paneとの画面構成（サイドパネル等）は書かない
- `x`, `y` は生成時に省略してよい（エディタが自動配置する）

## paneGraph

Pane間の関係をグラフの辺として定義する。PaneがどうScreenにまとめられるかとは独立している。

```json
{ "id": "一意ID", "from": "Pane id", "to": "Pane id", "type": "drilldown | embed", "param": "受け渡しパラメータ" }
```

- `from`, `to`: views配列内のPane IDのみ指定可（Screen IDは不可）
- `type`: 辺の種類
  - `drilldown`: 有向辺（矢印）。ユーザー操作で別Paneに遷移する。例: Collection → Single（同一Object）
  - `embed`: 無向辺（線）。上位ObjectのSingleが下位ObjectのCollectionを内包する親子関係を表す
- `param`: drilldownの場合に遷移先へ渡すパラメータを日本語で記述する（例: 「プロジェクトID」）。embedでは省略
- Pane間の遷移はPane Graphの辺に従う（独自遷移を作らない）
- drilldownは同一ObjectのCollection→Singleが基本。異なるObject間のdrilldownは原則定義しない

## screens

```json
{
  "id": "kebab-case識別子",
  "name": "画面名",
  "device": "devices配列内の値",
  "paneIds": ["Pane id"]
}
```

- `device`: devices配列で定義したデバイス名を指定する
- `paneIds`: views配列内のPane IDを指定する
- デバイスごとにPaneをグルーピングして1つの画面（Screen）を構成する
- 同じ名前のScreenを異なるdeviceで定義し、デバイスごとのPane構成の違いを表現する

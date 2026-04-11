# JSON Schema

```json
{
  "objects": [],
  "actors": [],
  "views": [],
  "transitions": []
}
```

| フィールド | 説明 |
|---|---|
| objects | Object定義 |
| actors | Actor定義（ロール別のアクセス可能Object） |
| views | Pane定義（type: "collection" / "single"） |
| transitions | Pane間の遷移定義 |

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

## actors

```json
{
  "id": "kebab-case識別子",
  "name": "アクター名",
  "objectIds": ["アクセス可能なobject id"]
}
```

- プロダクトを利用するロール（Owner, Member等）を定義
- `objectIds` でそのActorがアクセスできるObjectを指定

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

## transitions

```json
{ "id": "一意ID", "from": "Pane id", "to": "Pane id", "trigger": "遷移トリガー" }
```

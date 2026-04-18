# JSON Schema

## トップレベル構造

### 通常モード

```json
{
  "objects": [],
  "views": [],
  "paneGraph": [],
  "screens": []
}
```

| フィールド | 必須 | 説明 |
|---|---|---|
| objects | ✅ | Object定義の配列 |
| views | ✅ | Pane定義の配列（type: "collection" / "single"） |
| paneGraph | ✅ | Pane間の辺定義の配列（drilldown / embed） |
| screens | ✅ | Screen定義の配列（デバイス別Pane構成） |

> **`devices` について:** 旧スキーマではトップレベルに `"devices": ["mobile", "desktop"]` が存在したが、現在は省略可能。エディタが `["mobile", "desktop"]` をデフォルト値として補完する。generate時は出力しなくてよい。

### バリアントモード（`_variants`）

バリアント分岐中のJSONは以下の構造を取る。通常モードと排他的。

```json
{
  "_variants": [
    {
      "id": "a",
      "name": "Option A",
      "active": true,
      "objects": [],
      "views": [],
      "paneGraph": [],
      "screens": []
    },
    {
      "id": "b",
      "name": "Option B",
      "active": false,
      "objects": [],
      "views": [],
      "paneGraph": [],
      "screens": []
    }
  ]
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| _variants | array | バリアント配列。存在する場合、objects/views/paneGraph/screens はトップレベルではなく各バリアント内に格納される |
| _variants[].id | string | バリアントの一意ID（"a", "b", "c"...） |
| _variants[].name | string | 表示名（"Option A", "Option B"...） |
| _variants[].active | boolean | アクティブフラグ。1つだけ `true` |
| _variants[].objects | array | そのバリアントのObject定義 |
| _variants[].views | array | そのバリアントのPane定義 |
| _variants[].paneGraph | array | そのバリアントのPane Graph定義 |
| _variants[].screens | array | そのバリアントのScreen定義 |

> **generate時:** `_variants` は生成しない。通常モードで出力する。既存JSONに `_variants` がある場合はSKILL.md Step 1の手順に従う。

## objects

```json
{
  "id": "kebab-case識別子",
  "name": "表示名",
  "relations": [
    { "id": "一意ID", "targetId": "対象オブジェクトid", "type": "has-many" }
  ]
}
```

| フィールド | 必須 | 説明 |
|---|---|---|
| id | ✅ | kebab-case の一意識別子 |
| name | ✅ | 日本語の表示名 |
| relations | ✅ | リレーション配列（空配列可） |
| x, y | — | エディタ上の座標。generate時は省略（エディタが自動配置） |

### relations

| フィールド | 必須 | 説明 |
|---|---|---|
| id | ✅ | リレーションの一意ID |
| targetId | ✅ | 対象オブジェクトのid |
| type | ✅ | `"has-many"` / `"has-one"` / `"many-to-many"` |

**ルール:**
- Objectはフラットな配列。グルーピングはしない
- **リレーションは一方向のみ定義する。** A→Bを定義したらB→Aは定義しない。双方向に定義すると同じObject間に2本の線が描画される
- 方向の基準: 親（所有する側）→ 子（所有される側）の方向で定義する

## views（Pane）

各viewは「Pane」（表示の最小単位）を表す。Paneは画面そのものではなく、デバイスに応じて複数のPaneを組み合わせて1画面を構成する。

```json
{
  "id": "kebab-case識別子",
  "type": "collection",
  "objectId": "object id",
  "fields": ["フィールド名"],
  "verbs": ["操作名"],
  "prompt": "このPaneが提供する情報と操作（自然言語）"
}
```

| フィールド | 必須 | 説明 |
|---|---|---|
| id | ✅ | kebab-case の一意識別子 |
| type | ✅ | `"collection"` = 一覧表示、`"single"` = 単体表示 |
| objectId | ✅ | このPaneが表示するObjectのid |
| fields | ✅ | 表示するフィールド名の配列 |
| verbs | ✅ | このPane上で実行可能な操作名の配列 |
| prompt | ✅ | このPaneの表現意図を自然言語で記述 |
| x, y | — | エディタ上の座標。generate時は省略（エディタが自動配置） |

> **`name` フィールドはない。** Paneの表示ラベルはエディタが `objectId` の表示名 + `type`（例: "プロジェクト Collection"）から自動生成する。

**ルール:**
- 1つのObjectに対して複数のPaneを定義できる
- `prompt` はこのPane自身の責務のみ記述する。他Paneとの画面構成（「サイドパネルに○○を表示」等）は書かない

## paneGraph

Pane間の関係をグラフの辺として定義する。PaneがどうScreenにまとめられるかとは独立している。

### drilldown（有向辺・矢印）

```json
{ "id": "d1", "from": "Pane id", "to": "Pane id", "type": "drilldown", "param": "受け渡しパラメータ" }
```

- 同一ObjectのCollection → Singleへのユーザー遷移
- `param`: 遷移先へ渡すパラメータを日本語で記述（例: 「プロジェクトID」）
- 異なるObject間のdrilldownは原則定義しない

### embed（無向辺・線）

```json
{ "id": "e1", "from": "Pane id", "to": "Pane id", "type": "embed" }
```

- 上位ObjectのSingleが下位ObjectのCollectionを内包する親子関係
- Object間の has-many / has-one リレーションに対応する
- `param` は不要（省略する）

| フィールド | 必須 | 説明 |
|---|---|---|
| id | ✅ | 辺の一意ID |
| from | ✅ | 起点Pane ID（views配列内のID。Screen IDは不可） |
| to | ✅ | 終点Pane ID（views配列内のID。Screen IDは不可） |
| type | ✅ | `"drilldown"` または `"embed"` |
| param | drilldownのみ | 遷移先へ渡すパラメータ（日本語）。embedでは省略 |

## screens

```json
{
  "id": "kebab-case識別子",
  "name": "画面名",
  "device": "mobile | desktop",
  "paneIds": ["Pane id"]
}
```

| フィールド | 必須 | 説明 |
|---|---|---|
| id | ✅ | kebab-case の一意識別子 |
| name | ✅ | 画面名（日本語） |
| device | ✅ | `"mobile"` または `"desktop"` |
| paneIds | ✅ | このScreenに含まれるPane IDの配列（views配列内のID） |
| x, y | — | エディタ上の座標。generate時は省略（エディタが自動配置） |

**ルール:**
- デバイスごとにPaneをグルーピングして1つの画面（Screen）を構成する
- 同じ `name` のScreenを異なる `device` で定義し、デバイスごとのPane構成の違いを表現する
- mobile: 原則1 Pane / Screen。desktop: 複数 Pane / Screen

## マイグレーション（自動変換）

エディタは読み込み時に以下の旧スキーマを自動変換する。generate時はこれらの旧形式を出力しないこと。

| 旧形式 | 新形式 | 説明 |
|--------|--------|------|
| `relations[].type: "belongs-to"` | `"has-many"` | 旧リレーションタイプ |
| `views[].objects` 配列 | `objectId` + `type` | 旧ビュースキーマ |
| `devices` 未定義 | `["mobile", "desktop"]` | デフォルト値で補完 |

# OOUIモデリング パターン集

generate スキルの精度を上げるための判定基準・パターン。具体例は [examples.md](examples.md) を参照。

## 1. よくある間違いパターン

| # | 間違い | 正しいアプローチ | 判定基準 |
|---|--------|------------------|----------|
| M1 | ナビゲーションに動詞を使う（「登録する」「検索する」「管理する」） | 名詞を使う（「案件」「顧客」「レポート」） | OOUIは名詞→動詞の順。動詞はオブジェクト選択後のアクション |
| M2 | 属性をオブジェクトにする（「ステータス」「カテゴリ」「フラグ」「優先度」） | オブジェクトの fields に入れる | 複数インスタンス性がない。別オブジェクトの属性に過ぎない |
| M3 | タスクの名詞化をオブジェクトにする（「受信」「承認」「集計」「送信」） | verbs に入れる | 動詞的概念。「承認する」の対象は「申請」であり「承認」自体ではない |
| M4 | UIコンポーネント名をオブジェクトにする（「ダッシュボード」「設定画面」「検索画面」） | Paneの表現やScreen構成として扱う | ドメインオブジェクトではなくUI表現 |
| M5 | アクションを独立メニュー項目にする（「新規登録」「一括削除」をトップに置く） | オブジェクトのPane上にverbsとして配置 | アクションはオブジェクトに従属。先にオブジェクトを選び、次にアクション |
| M6 | リレーションを双方向に定義する（A→BかつB→A） | 親→子の一方向のみ | 双方向定義すると同じオブジェクト間に2本の線が描画される |
| M7 | collection と single を機械的に全オブジェクトに作る | 必要性を問う | グルーピング用オブジェクト（フォルダ、カテゴリ等）は single 不要な場合がある |
| M8 | prompt に他Pane情報を書く（「右にタスク一覧を表示」） | 自Paneの責務のみ記述 | Pane構成はデバイスにより異なる。Paneは独立した表示単位 |
| M9 | mobile で複数Paneを1 Screenに詰める | 1 Screen = 1 Pane が基本 | 画面が小さいため、Pane単位で画面遷移させる |
| M10 | 異なるObject間に drilldown を定義する | embed を使う | drilldown は同一ObjectのCollection→Single。親子関係は embed |

## 2. Pane Graph 判定フローチャート

2つのPane間に辺が必要かを判定する手順:

```
Pane Aと Pane Bの関係を判定する
│
├─ 同じ objectId を持つか？
│   ├─ YES → A が collection、B が single か？
│   │   ├─ YES → drilldown（from: A, to: B）、param にオブジェクトIDを設定
│   │   └─ NO → 辺は不要（同一Objectの同種Paneは直接接続しない）
│   │
│   └─ NO → A の objectId と B の objectId に親子関係（relation）があるか？
│       ├─ YES → A が親ObjectのSingle、B が子ObjectのCollectionか？
│       │   ├─ YES → embed（from: A, to: B）
│       │   └─ NO → 辺は不要（逆方向や他の組み合わせは定義しない）
│       └─ NO → 辺は不要
```

### 判定ルールまとめ

| 条件 | 辺の種類 | from | to | 例 |
|------|----------|------|-----|-----|
| 同一Object: Collection → Single | drilldown | Collection Pane | Single Pane | project-collection → project-single |
| 親Object Single → 子Object Collection | embed | 親の Single Pane | 子の Collection Pane | project-single → task-collection |
| 上記以外 | 辺なし | — | — | — |

### 注意事項

- **drilldown は同一Object内のみ。** 異なるObject間の遷移は drilldown ではなく、Screen構成で解決する
- **embed は親→子方向のみ。** from = 親ObjectのSingle、to = 子ObjectのCollection。Object の relation（has-many等）に対応する
- **1つの辺に1つの関係。** 同じPaneペア間に複数の辺を定義しない
- 同じObjectに複数の collection がある場合（例: タスク一覧とマイタスク一覧）、それぞれから single へ drilldown を定義できる

## 3. Fields 選び方ガイド

### Collection の fields（3〜5個が目安）

一覧で**識別・比較・選択**するために必要な属性のみ。

**選定基準:**
1. **識別性**: そのインスタンスを他と区別できる属性（名前、タイトル等）→ 必須
2. **状態把握**: 現在の状態を素早く把握できる属性（ステータス、日時等）→ 重要
3. **比較性**: 一覧で比較・ソートに使う属性（数値、カテゴリ等）→ 必要に応じて

**含めるもの:**
- 名前/タイトル（必須 — これがないとインスタンスを識別できない）
- ステータス/状態
- 主要な日時（作成日、期限等）
- 所有者/担当者
- カウント系（子オブジェクトの数等）

**含めないもの:**
- 長文テキスト（説明、本文）→ single で表示
- 詳細設定項目 → single で表示
- 内部ID → ユーザーに見せない
- 他オブジェクトの詳細情報 → そのオブジェクトの Pane で表示

### Single の fields（4〜8個が目安）

詳細の**閲覧・編集**に必要な全属性。

**選定基準:**
1. collection の全 fields を含む（一覧で見えたものが詳細で消えると混乱する）
2. 閲覧頻度の高い詳細属性を追加
3. 編集可能な属性を追加

**含めるもの:**
- collection の全 fields
- 説明/詳細テキスト
- 設定項目
- 関連オブジェクトの参照（担当者名、カテゴリ名等）
- メタ情報（作成日時、更新日時等）

### fields 選定の具体例

| Object | Collection fields | Single fields |
|--------|------------------|---------------|
| プロジェクト | プロジェクト名, ステータス, メンバー数 | プロジェクト名, 説明, ステータス, 期限, メンバー数 |
| タスク | タスク名, 担当者, 期限, ステータス | タスク名, 説明, 担当者, 期限, ステータス, ラベル |
| メンバー | 名前, メール, ロール | 名前, メール, ロール, 参加日, 最終ログイン |
| 契約 | 契約名, 種別, ステータス, 申請日 | 契約名, 種別, 詳細, ステータス, 申請日, 承認者 |
| メール | 差出人, 件名, 日時, フラグ | 差出人, 宛先, 件名, 本文, 添付ファイル, 日時 |

## 4. Screen 構成のデバイス別パターン集

### 基本原則

| デバイス | Pane数/Screen | 基本方針 |
|----------|---------------|----------|
| mobile | 1 | 1画面1Pane。Pane間はナビゲーション遷移 |
| desktop | 2〜3 | embed関係のPaneを同一Screenに配置。Master-Detailが基本 |

### パターン一覧

#### P1: Master-Detail（最も基本）

Collection と Single を並べて表示。一覧から選択すると右に詳細が出る。

```
desktop: [task-collection, task-single]
mobile:  [task-collection] → 遷移 → [task-single]
```

#### P2: 親子展開

親ObjectのSingleに子ObjectのCollectionを内包。embed関係。

```
desktop: [project-single, task-collection, member-collection]
mobile:  [project-single] → 遷移 → [task-collection]
                           → 遷移 → [member-collection]
```

#### P3: ホーム画面（複数Collection）

主要オブジェクトの一覧を並列表示。ダッシュボード的な用途。

```
desktop: [project-collection, task-collection]
mobile:  [project-collection]（別Screenで [task-collection]）
```

#### P4: 三層ナビゲーション

サイドバー → リスト → 詳細。メールアプリ等で典型。

```
desktop: [mailbox-collection, mail-collection, mail-single]
mobile:  [mailbox-collection] → 遷移 → [mail-collection] → 遷移 → [mail-single]
```

#### P5: 詳細 + 子一覧（embed展開）

Singleの下に関連Collection。タスク詳細+コメント一覧など。

```
desktop: [task-single, comment-collection]
mobile:  [task-single] → 遷移 → [comment-collection]
```

### Screen 構成の判定手順

```
1. すべての Pane をリストアップする
2. embed 関係にある Pane ペアを特定する
3. drilldown 関係にある Pane ペアを特定する

desktop Screen の構成:
  - embed ペアは同じ Screen に配置する
  - 親 Single + 子 Collection が基本単位
  - 必要に応じて drilldown 先の Single も同じ Screen に含める（P1パターン）
  - 1 Screen あたり最大3 Pane

mobile Screen の構成:
  - 原則 1 Screen = 1 Pane
  - Pane 間の遷移は drilldown / embed の辺に従う
  - 同じ名前の Screen を device 違いで定義する
```

### Screen 命名規則

- 同じ論理画面は同じ name を付け、device で区別する
- name はオブジェクト名またはオブジェクトの役割で命名する
  - 良い例: 「ホーム」「プロジェクト」「タスク」「マイタスク」
  - 悪い例: 「メイン画面」「管理画面」「設定画面」（M4: UIコンポーネント名の回避）

### Screen 構成の具体例（プロジェクト管理ツール）

```
mobile Screens:
  ホーム      = [project-collection]
  プロジェクト = [project-single]
  タスク一覧   = [task-collection]
  タスク       = [task-single]
  マイタスク   = [my-task-collection]

desktop Screens:
  ホーム      = [project-collection, task-collection]        ← P3: 複数Collection
  プロジェクト = [project-single, task-collection, member-collection] ← P2: 親子展開
  タスク       = [task-single, comment-collection]            ← P5: 詳細+子一覧
  マイタスク   = [my-task-collection, task-single]            ← P1: Master-Detail
```

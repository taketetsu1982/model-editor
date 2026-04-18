# Good/Bad 具体例

入力（PRD/ユーザー説明）からどうオブジェクトを抽出するか、Bad（タスクベース）と Good（オブジェクトベース）の対比で示す。

## 例1: プロジェクト管理ツール

**入力:**
> プロジェクトごとにタスクを管理。メンバーをアサインし、期限とステータスで進捗管理。タスクにコメントやラベルを付けられる。

**Bad — タスクベース設計:**

objects を「タスク管理」「メンバー管理」「進捗管理」にしてしまう。これらは動詞（管理する）の名詞化であり、ドメインオブジェクトではない。

```json
{
  "objects": [
    { "id": "task-management", "name": "タスク管理" },
    { "id": "member-management", "name": "メンバー管理" },
    { "id": "progress-management", "name": "進捗管理" }
  ]
}
```

**Good — オブジェクトベース設計:**

名詞を抽出: プロジェクト、タスク、メンバー、コメント、ラベル。
動詞を抽出: 作成、編集、削除、アサイン、検索。
「ステータス」「期限」は属性（fields）。

```json
{
  "objects": [
    { "id": "project", "name": "プロジェクト",
      "relations": [
        { "id": "r1", "targetId": "task", "type": "has-many" },
        { "id": "r2", "targetId": "member", "type": "has-many" }
      ]},
    { "id": "task", "name": "タスク",
      "relations": [
        { "id": "r3", "targetId": "comment", "type": "has-many" },
        { "id": "r4", "targetId": "label", "type": "has-many" }
      ]},
    { "id": "member", "name": "メンバー", "relations": [] },
    { "id": "comment", "name": "コメント", "relations": [] },
    { "id": "label", "name": "ラベル", "relations": [] }
  ],
  "views": [
    { "id": "project-collection", "type": "collection", "objectId": "project",
      "fields": ["プロジェクト名", "ステータス", "メンバー数"],
      "verbs": ["作成"],
      "prompt": "プロジェクトをカード形式で一覧表示。" },
    { "id": "project-single", "type": "single", "objectId": "project",
      "fields": ["プロジェクト名", "説明", "ステータス", "期限"],
      "verbs": ["編集", "削除"],
      "prompt": "プロジェクトの詳細情報を表示・編集する。" },
    { "id": "task-collection", "type": "collection", "objectId": "task",
      "fields": ["タスク名", "担当者", "期限", "ステータス"],
      "verbs": ["作成", "検索"],
      "prompt": "タスクをカンバン形式で表示。ドラッグでステータス変更。" },
    { "id": "task-single", "type": "single", "objectId": "task",
      "fields": ["タスク名", "説明", "担当者", "期限", "ラベル"],
      "verbs": ["編集", "削除", "アサイン"],
      "prompt": "タスクの詳細情報を表示・編集する。" }
  ]
}
```

**判定ポイント:**
- 「管理」「進捗管理」はタスクの名詞化（M3）→ オブジェクトにしない
- 「ステータス」「期限」は属性（M2）→ fields に入れる
- 「作成」「編集」「アサイン」は動詞 → verbs に入れる
- collection の fields は一覧で比較・選択に必要な属性のみ（3〜5個）
- single の fields は詳細閲覧・編集に必要な属性（4〜6個）

---

## 例2: 契約管理システム

**入力:**
> 契約の新規申請、変更申請、解約申請ができる。上長が承認・否認する。契約一覧を照会できる。

**Bad — タスクベース設計:**

入力の動詞をそのままメニュー化。「新規申請」「変更申請」「解約申請」「承認」「契約照会」を別オブジェクトにする。

```json
{
  "objects": [
    { "id": "new-application", "name": "新規申請" },
    { "id": "change-application", "name": "変更申請" },
    { "id": "cancel-application", "name": "解約申請" },
    { "id": "approval", "name": "承認" }
  ]
}
```

**Good — オブジェクトベース設計:**

すべての申請は「契約」に対するアクション。「承認」も契約に対する動詞。

```json
{
  "objects": [
    { "id": "contract", "name": "契約", "relations": [] }
  ],
  "views": [
    { "id": "contract-collection", "type": "collection", "objectId": "contract",
      "fields": ["契約名", "種別", "ステータス", "申請日"],
      "verbs": ["新規申請", "検索"],
      "prompt": "契約の一覧表示。ステータスでフィルタリング可能。" },
    { "id": "contract-single", "type": "single", "objectId": "contract",
      "fields": ["契約名", "種別", "詳細", "ステータス", "申請日", "承認者"],
      "verbs": ["変更申請", "解約申請", "承認", "否認"],
      "prompt": "契約の詳細表示。ステータスに応じた操作が可能。" }
  ]
}
```

**判定ポイント:**
- 「新規申請」「変更申請」「解約申請」はすべて「契約」に対するアクション（M3, M5）
- 「承認」は動詞であり、対象は「契約」（M3）
- 1つのオブジェクトに集約することで画面数が激減し、全体像が把握しやすくなる

---

## 例3: コンテンツ管理システム

**入力:**
> ウェブサイトのページを追加・削除・編集する。ページの設定（URL、公開状態）と内容（テキスト、画像）を管理する。サイト全体の設定（テーマ、ドメイン）も変更できる。

**Bad:**

「ページの追加と削除」「内容編集」「ページ設定」「サイト設定」をメニュー項目にしてしまう。

**Good:**

```json
{
  "objects": [
    { "id": "site", "name": "サイト",
      "relations": [{ "id": "r1", "targetId": "page", "type": "has-many" }] },
    { "id": "page", "name": "ページ", "relations": [] }
  ],
  "views": [
    { "id": "site-single", "type": "single", "objectId": "site",
      "fields": ["サイト名", "テーマ", "ドメイン"],
      "verbs": ["設定変更"],
      "prompt": "サイト全体の設定を表示・編集する。" },
    { "id": "page-collection", "type": "collection", "objectId": "page",
      "fields": ["ページ名", "URL", "公開状態", "更新日"],
      "verbs": ["追加"],
      "prompt": "ページの一覧表示。ドラッグで順序変更可能。" },
    { "id": "page-single", "type": "single", "objectId": "page",
      "fields": ["ページ名", "URL", "公開状態", "内容", "テーマ設定"],
      "verbs": ["編集", "削除", "公開", "非公開"],
      "prompt": "ページの設定と内容を表示・編集する。" }
  ]
}
```

> paneGraph / screens の構成例は [patterns.md §2「Pane Graph判定フローチャート」](patterns.md) および [§4「Screen構成パターン」](patterns.md) を参照。

**判定ポイント:**
- 「サイト」はインスタンスが1つだが、プロパティと操作を持つのでオブジェクト。ただし collection は不要（single のみ）
- 「ページ」は典型的なオブジェクト（複数インスタンス + 共通操作）
- 「追加」「削除」は collection / single に適切に振り分け

---

## 例4: メールアプリ

**入力:**
> メールの受信・送信・検索。フォルダ（受信箱、送信済み、下書き、ゴミ箱）でメールを整理。メールにフラグを付けられる。

**Bad:**

「受信」「送信」「フラグ」をオブジェクトにしてしまう。

**Good:**

```json
{
  "objects": [
    { "id": "mailbox", "name": "メールボックス",
      "relations": [{ "id": "r1", "targetId": "mail", "type": "has-many" }] },
    { "id": "mail", "name": "メール", "relations": [] }
  ],
  "views": [
    { "id": "mailbox-collection", "type": "collection", "objectId": "mailbox",
      "fields": ["フォルダ名", "未読数"],
      "verbs": ["作成"],
      "prompt": "メールボックスの一覧をサイドバー形式で表示。" },
    { "id": "mail-collection", "type": "collection", "objectId": "mail",
      "fields": ["差出人", "件名", "日時", "フラグ"],
      "verbs": ["作成", "検索"],
      "prompt": "メールの一覧表示。未読は太字で強調。" },
    { "id": "mail-single", "type": "single", "objectId": "mail",
      "fields": ["差出人", "宛先", "件名", "本文", "添付ファイル", "日時"],
      "verbs": ["返信", "転送", "削除", "フラグ"],
      "prompt": "メールの全文と添付ファイルを表示。" }
  ]
}
```

> Screen構成は [patterns.md §4 P4「三層ナビゲーション」](patterns.md) が該当パターン。

**判定ポイント:**
- 「受信」「送信」は動詞（M3）→ verbs（作成 = 送信、受信は自動）
- 「フラグ」は属性（M2）→ fields。「フラグを付ける」は verb
- 「メールボックス」はグルーピング用 → single は省略可（M7）

# lead-scraper

比較媒体（アスピック / ミツモア / アイミツSaaS）のリードを自動取得してSalesforceに登録するRPAツール。

## アーキテクチャ

```
各比較媒体からメール受信
→ Google Apps Script（メール検知・トリガー）
→ GitHub Actions（Playwrightを実行）
→ Playwright（自動ログイン・スクレイピング）
→ Salesforce REST API（リード登録）
→ Slack通知（セッション切れ時など）
```

## ディレクトリ構成

```
lead-scraper/
├── pages/
│   ├── AspicLeadPage.ts        ✅ 完成
│   ├── AspicLoginPage.ts       ✅ 完成
│   ├── IimitsuLeadPage.ts      ✅ 完成
│   ├── IimitsuLoginPage.ts     ✅ 完成
│   ├── MeetsmoreLeadPage.ts    ✅ 完成
│   └── MeetsmoreLoginPage.ts   ✅ 完成
├── tests/
│   ├── aspic.spec.ts           ✅ 完成
│   ├── iimitsu.spec.ts         ✅ 完成
│   └── meetsmore.spec.ts       ✅ 完成
├── .github/
│   └── workflows/
│       └── playwright.yml      ✅ GitHub Actions設定
├── salesforce.ts               ✅ SF API関数群
├── slack.ts                    ✅ Slack通知
├── .env                        ✅ 設定済み（Gitに含めない）
├── .gitignore                  ✅ 設定済み
└── playwright.config.ts        ✅ 設定済み
```

## セットアップ

### 1. 依存関係インストール

```bash
npm install
npx playwright install chromium
```

### 2. .env 設定
```
IIMITSU_EMAIL=
IIMITSU_PASSWORD=
ASPIC_EMAIL=
ASPIC_PASSWORD=
MEETSMORE_EMAIL=
MEETSMORE_PASSWORD=
SF_CLIENT_ID=
SF_CLIENT_SECRET=
SF_INSTANCE_URL=https://widsley.my.salesforce.com
SLACK_WEBHOOK_URL=
GITHUB_PAT=
```

### 3. GitHub Secrets 設定

以下の項目を GitHub の `Settings → Secrets and variables → Actions` に登録してください。
```
IIMITSU_EMAIL
IIMITSU_PASSWORD
ASPIC_EMAIL
ASPIC_PASSWORD
MEETSMORE_EMAIL
MEETSMORE_PASSWORD
SF_CLIENT_ID
SF_CLIENT_SECRET
SF_INSTANCE_URL
SLACK_WEBHOOK_URL
```

## コマンド一覧

```bash
# 全サービス一括実行
npx playwright test --project=chromium

# 個別実行
npx playwright test tests/aspic.spec.ts --headed --project=chromium
npx playwright test tests/iimitsu.spec.ts --headed --project=chromium
npx playwright test tests/meetsmore.spec.ts --headed --project=chromium

# 過去データ一括インポート
npx playwright test tests/import-aspic.spec.ts --project=chromium
npx playwright test tests/import-iimitsu.spec.ts --project=chromium
npx playwright test tests/import-meetsmore.spec.ts --project=chromium
```

## GitHub Actions

`workflow_dispatch` で手動実行できます。メールが届くと Google Apps Script が自動で起動します。

| service パラメータ | 実行内容 |
|-------------------|---------|
| all | 全サービスを実行 |
| aspic | アスピックのみ実行 |
| iimitsu | アイミツSaaSのみ実行 |
| meetsmore | ミツモアのみ実行 |

## Google Apps Script

5分おきにメールをチェックして、各サービスからメールが届いたらGitHub Actionsを自動起動します。

| メール送信元 | 実行サービス |
|------------|------------|
| asu@asulead.cloud | アスピック |
| support_seller@saas.imitsu.jp | アイミツSaaS |
| no-reply@meetsmore.com | ミツモア |

## 各サービスのSFフィールドマッピング

### アイミツSaaS
| アイミツ項目 | SFフィールド | API参照名 |
|-------------|-------------|-----------|
| リードID | インテグレーションID | integration_ID__c |
| 担当者 | 姓・名 | LastName / FirstName |
| 会社 | 会社名 | Company |
| 電話番号 | 会社電話 | Phone |
| メールアドレス | メール | Email |
| 所在地（都道府県） | 都道府県 | State |
| 所在地（市区町村） | 住所 | Street |
| 従業員規模 | 従業員規模 | Employee_size__c |
| 役職 | 役職 | title__c |
| 部署 | 部署名 | Department__c |
| カスタマーの現状 | web問い合わせ内容 | web__c |
| 導入予定時期 | 導入時期 | InstallationTime__c |
| 業界 | 業種 | Industry |
| サービス利用人数 | 想定利用人数 | Field8__c |
| ヒアリング内容 | 説明 | Description |
| 取次日時 | 初回流入日時 | LeadSourceTime__c |
| 取次日 | 初回流入日 | LeadSourceDate__c |

### アスピック
| アスピック項目 | SFフィールド | API参照名 |
|--------------|-------------|-----------|
| No. | インテグレーションID | integration_ID__c |
| 氏名 | 姓・名 | LastName / FirstName |
| 企業名 | 会社名 | Company |
| 電話番号 | 会社電話 | Phone |
| メールアドレス | メール | Email |
| 従業員数 | 従業員規模 | Employee_size__c |
| 役職名 | 役職 | title__c |
| 部署名 | 部署名 | Department__c |
| 備考 | web問い合わせ内容 | web__c |
| 導入時期 | 導入時期 | InstallationTime__c |
| DL区分 | 備考 | Remarks__c |
| 日時 | 初回流入日時 | LeadSourceTime__c |
| 日付 | 初回流入日 | LeadSourceDate__c |

### ミツモア
| ミツモア項目 | SFフィールド | API参照名 |
|------------|-------------|-----------|
| 依頼ID | インテグレーションID | integration_ID__c |
| 氏名 | 姓・名 | LastName / FirstName |
| 会社名 | 会社名 | Company |
| 電話番号 | 会社電話 | Phone |
| メールアドレス | メール | Email |
| 住所 | 都道府県 / 住所 | State / Street |
| 従業員数 | 従業員規模 | Employee_size__c |
| 役職 | 役職 | title__c |
| 所属部署・部門 | 部署名 | Department__c |
| 業種 | 主業種 | MainIndustry__c |
| 利用開始予定時期 | 導入時期 | InstallationTime__c |
| 想定利用人数/オペレーターの人数 | 想定利用人数 | Field8__c |
| 事業形態・業務種類・導入検討サービス | 備考 | Remarks__c |
| 依頼日時 | 初回流入日時 | LeadSourceTime__c |
| 依頼日 | 初回流入日 | LeadSourceDate__c |
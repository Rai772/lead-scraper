import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import { MeetsmoreLoginPage } from '../pages/MeetsmoreLoginPage';
import { MeetsmoreLeadPage } from '../pages/MeetsmoreLeadPage';
import { getSalesforceToken, createSFLead, findLeadByIntegrationId } from '../salesforce';

dotenv.config();

test('ミツモア リードスクレイプ → SF登録', async ({ page }) => {

  const email    = process.env.MEETSMORE_EMAIL!;
  const password = process.env.MEETSMORE_PASSWORD!;

  // ① 自動ログイン
  const loginPage = new MeetsmoreLoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);

  // ② リード一覧へ遷移して一番上のリードを開く
  const leadPage = new MeetsmoreLeadPage(page);
  await leadPage.gotoList();
  await leadPage.openLatestLead();

  // ③ リード情報を取得
  const leadInfo = await leadPage.getLeadInfo();

  // ④ 役職の変換マップ
  const jobTitleMap: Record<string, string> = {
    '代表取締役':     '代表',
    '取締役':         '役員クラス', 
    '役員相当':       '役員クラス',
    '執行役員相当':   '役員クラス',
    '部長相当':       '部長クラス',
    '課長相当':       '課長クラス',
    '一般社員・その他': '一般社員',
    'その他':         'その他',
  };

  // ⑤ 従業員規模の変換マップ
  const employeeSizeMap: Record<string, string> = {
    '1人':      '1\uFF5E10',
    '2人':      '1\uFF5E10',
    '3人':      '1\uFF5E10',
    '4人':      '1\uFF5E10',
    '5人':      '1\uFF5E10',
    '6人':      '1\uFF5E10',
    '7人':      '1\uFF5E10',
    '8人':      '1\uFF5E10',
    '9人':      '1\uFF5E10',
    '10人':     '1\uFF5E10',
    '15人':     '11\uFF5E49',
    '20人':     '11\uFF5E49',
    '30人':     '11\uFF5E49',
    '50人':     '50\uFF5E99',
    '100人':    '100\uFF5E299',
    '300人':    '300\uFF5E499',
    '500人':    '500\uFF5E999',
    '1000人':   '1000\uFF5E4999',
    '5000人':   '5000\uFF5E',
  };

  // ⑥ 業種の変換マップ
  const industryMap: Record<string, string> = {
    '飲食':               'サービス業（飲食）',
    '小売・卸売':         '小売業',
    'サービス':           'サービス業（その他）',
    '美容・サロン':       'サロン＆美容',
    '医療・福祉':         '医療/福祉・介護',
    '製造':               '製造・メーカー',
    '建設・工事':         '建設・工事',
    '不動産':             '不動産（その他）',
    '農林水産':           'サービス業（その他）',
    'IT・インターネット': 'IT＆通信',
    '運輸・物流':         '運輸・物流',
    'コンサルティング・士業': '総合コンサルティング',
    '人材紹介・人材派遣': '人材紹介',
    '金融':               '金融（その他）',
    '広告・メディア':     '広告代理店',
    '旅行・レジャー':     'エンタメ・娯楽、専門サービス',
    '教育・学習支援':     '教育/学習塾',
    '公務員':             '行政',
    'その他・近いものはない': 'その他',
  };

  const sfLead = {
    LastName:            leadInfo.LastName,            // 姓
    FirstName:           leadInfo.FirstName,           // 名
    Company:             leadInfo.Company,             // 会社名
    Phone:               leadInfo.Phone,               // 会社電話
    Email:               leadInfo.Email,               // メール
    State:               leadInfo.State,               // 都道府県
    Street:              leadInfo.Street,              // 住所
    Employee_size__c:    employeeSizeMap[leadInfo.Employee_size__c] ?? '', // 従業員規模
    title__c:            jobTitleMap[leadInfo.title__c] ?? 'その他',       // 役職
    Department__c:       leadInfo.Department__c,       // 部署名
    web__c:              leadInfo.web__c,              // web問い合わせ内容
    integration_ID__c:   leadInfo.integration_ID__c,  // インテグレーションID
    first_touchpoint__c: leadInfo.first_touchpoint__c, // 初回流入経路
    LeadSource:          leadInfo.LeadSource,          // リードソース
    product__c:          leadInfo.product__c,          // 商材
    InstallationTime__c: leadInfo.InstallationTime__c, // 導入時期
    Description:         leadInfo.Description,         // 説明
    Field8__c:           leadInfo.Field8__c,           // 想定利用人数
    LeadSourceTime__c:   leadInfo.LeadSourceTime__c,   // 初回流入日時
    LeadSourceDate__c:   leadInfo.LeadSourceDate__c,   // 初回流入日
    Remarks__c:          leadInfo.Remarks__c,          // 備考
    MainIndustry__c:     industryMap[leadInfo.MainIndustry__c] ?? 'その他',     // 主業種
  };

  // ⑥ SF認証
  const token = await getSalesforceToken();

  // ⑦ 重複チェック
  const exists = await findLeadByIntegrationId(token, sfLead.integration_ID__c);
  if (exists) {
    console.log('⏭️ スキップ（登録済み）: 依頼ID', sfLead.integration_ID__c);
    return;
  }

  // ⑧ SF登録
  const result = await createSFLead(token, sfLead);
  console.log('🎉 登録完了！SF ID:', result.id);
});
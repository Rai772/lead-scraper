import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import { AspicLoginPage } from '../pages/AspicLoginPage';
import { AspicLeadPage } from '../pages/AspicLeadPage';
import { getSalesforceToken, createSFLead, findLeadByIntegrationId } from '../salesforce';

dotenv.config();

test('アスピック リードスクレイプ → SF登録', async ({ page }) => {

  const email    = process.env.ASPIC_EMAIL!;
  const password = process.env.ASPIC_PASSWORD!;

  // ① 自動ログイン
  const loginPage = new AspicLoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);

  // ② リード一覧へ遷移して一番上のリードを開く
  const leadPage = new AspicLeadPage(page);
  await leadPage.gotoList();
  await leadPage.openLatestLead();

  // ③ リード情報を取得
  const leadInfo = await leadPage.getLeadInfo();

  // ④ 役職の変換マップ
  const jobTitleMap: Record<string, string> = {
    '代表取締役・社長':   '代表',
    '経営者・役員相当':   '役員クラス',
    '執行役員以上':       '役員クラス',
    '部長・課長クラス':   '部長クラス',
    '部長・次長相当':     '部長クラス',
    '課長・係長相当':     '課長クラス',
    '一般社員・スタッフ': '一般社員',
    'その他':             'その他',
  };

  // ⑤ 従業員規模の変換マップ
  const employeeSizeMap: Record<string, string> = {
    '1～10人':      '1\uFF5E10',
    '11～50人':     '11\uFF5E49',
    '51～100人':    '50\uFF5E99',
    '101～500人':   '100\uFF5E299',
    '501～1000人':  '500\uFF5E999',
    '1001人以上':   '1000\uFF5E4999',
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
    Remarks__c:          leadInfo.Remarks__c ? `【DL区分】${leadInfo.Remarks__c}` : '', // 備考
    LeadSourceTime__c: leadInfo.LeadSourceTime__c, // 初回流入日時
    LeadSourceDate__c: leadInfo.LeadSourceDate__c, // 初回流入日
  };

  // ⑥ SF認証
  const token = await getSalesforceToken();

  // ⑦ 重複チェック
  const exists = await findLeadByIntegrationId(token, sfLead.integration_ID__c);
  if (exists) {
    console.log('⏭️ スキップ（登録済み）: No.', sfLead.integration_ID__c);
    return;
  }

  // ⑧ SF登録
  const result = await createSFLead(token, sfLead);
  console.log('🎉 登録完了！SF ID:', result.id);
});
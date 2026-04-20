import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import { IttrendLoginPage } from '../pages/IttrendLoginPage';
import { IttrendLeadPage } from '../pages/IttrendLeadPage';
import { getSalesforceToken, createSFLead, findLeadByIntegrationId } from '../salesforce';
import { sendSlackNotification } from '../slack';

dotenv.config();

test('ITトレンド リードスクレイプ → SF登録', async ({ browser }) => {

  // セッションを使ってブラウザを起動
  let context;
  try {
    context = await browser.newContext({
      storageState: 'session.json',
    });
  } catch {
    await sendSlackNotification(
      '🔴 ITトレンドの自動ログインが切れました。\n以下のコマンドで再登録してください。\n`npx playwright test tests/save-session.ts --headed --project=chromium`'
    );
    throw new Error('session.jsonが見つかりません');
  }

  const page = await context.newPage();

  // ① セッションでログイン確認
  const loginPage = new IttrendLoginPage(page);
  await loginPage.loginWithSession(context);

  // ② 資料請求一覧へ遷移して一番上のリードを開く
  const leadPage = new IttrendLeadPage(page);
  await leadPage.gotoList();
  const detailPage = await leadPage.openLatestLead();

  // ③ リード情報を取得
  const leadInfo = await leadPage.getLeadInfo(detailPage);

  // ④ 役職の変換マップ
  const jobTitleMap: Record<string, string> = {
    '代表取締役・社長':   '代表',
    '経営者・役員相当':   '役員クラス',
    '部長・次長相当':     '部長クラス',
    '課長・係長相当':     '課長クラス',
    '一般社員・スタッフ': '一般社員',
    'その他':             'その他',
  };

  const sfLead = {
    LastName:            leadInfo.LastName,
    FirstName:           leadInfo.FirstName,
    Company:             leadInfo.Company,
    Phone:               leadInfo.Phone,
    Email:               leadInfo.Email,
    State:               leadInfo.State,
    Street:              leadInfo.Street,
    LeadSourceTime__c:   leadInfo.LeadSourceTime__c,
    LeadSourceDate__c:   leadInfo.LeadSourceDate__c,
    integration_ID__c:   leadInfo.integration_ID__c,
    Employee_size__c:    leadInfo.Employee_size__c,
    MainIndustry__c:     leadInfo.MainIndustry__c,
    Department__c:       leadInfo.Department__c,
    title__c:            jobTitleMap[leadInfo.title__c] ?? 'その他',
    InstallationTime__c: leadInfo.InstallationTime__c,
    Field5__c:           leadInfo.Field5__c,
    product__c:          leadInfo.product__c,
    first_touchpoint__c: leadInfo.first_touchpoint__c,
    Description:         leadInfo.Description,
    Remarks__c:          leadInfo.Remarks__c,
    web__c:              leadInfo.web__c,
    LeadSource:          leadInfo.LeadSource,
  };

  // ⑤ SF認証
  const token = await getSalesforceToken();

  // ⑥ 重複チェック
  const exists = await findLeadByIntegrationId(token, sfLead.integration_ID__c);
  if (exists) {
    console.log('⏭️ スキップ（登録済み）: 注文番号', sfLead.integration_ID__c);
    await context.close();
    return;
  }

  // ⑦ SF登録
  const result = await createSFLead(token, sfLead);
  console.log('🎉 登録完了！SF ID:', result.id);

  await context.close();
});
import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import { AspicLoginPage } from '../pages/AspicLoginPage';
import { AspicLeadPage } from '../pages/AspicLeadPage';
import { getSalesforceToken, createSFLead, findLeadByIntegrationId } from '../salesforce';
import { notifySlackError } from '../slack';

dotenv.config();

test('アスピック リードスクレイプ → SF登録', async ({ page }) => {

  const email    = process.env.ASPIC_EMAIL!;
  const password = process.env.ASPIC_PASSWORD!;

  // ① 自動ログイン
  const loginPage = new AspicLoginPage(page);
  await loginPage.goto();
  try {
    await loginPage.login(email, password);
  } catch (e: any) {
    await notifySlackError('アスピック', 'ログイン失敗', e.message);
    throw e;
  }

  // ② リード一覧へ遷移して一番上のリードを開く
  const leadPage = new AspicLeadPage(page);
  try {
    await leadPage.gotoList();
  } catch (e: any) {
        await notifySlackError('アスピック', 'スクレイピング失敗', e.message);
        throw e;
  }

    // ③ リードが0件ならスキップ
    const hasLeads = await leadPage.hasLeads();
    if (!hasLeads) {
          console.log('⏭️ アスピック: リードが0件のためスキップ');
          return;
    }

    // ④ 一番上のリードを開く
    try {
          await leadPage.openLatestLead();
    } catch (e: any) {
          await notifySlackError('アスピック', 'スクレイピング失敗', e.message);
          throw e;
    }
  // ③ リード情報を取得
  let leadInfo: any;
  try {
    leadInfo = await leadPage.getLeadInfo();
  } catch (e: any) {
    await notifySlackError('アスピック', 'リード情報取得失敗', e.message);
    throw e;
  }

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
  const resolveEmployeeSize = (raw: string): string => {
    const matches = raw.match(/\d+/g);
    if (!matches) return '';
    const num = parseInt(matches[matches.length - 1]);
    if (isNaN(num)) return '';
    if (num <= 10)   return '1\uFF5E10';
    if (num <= 49)   return '11\uFF5E49';
    if (num <= 99)   return '50\uFF5E99';
    if (num <= 299)  return '100\uFF5E299';
    if (num <= 499)  return '300\uFF5E499';
    if (num <= 999)  return '500\uFF5E999';
    if (num <= 4999) return '1000\uFF5E4999';
    return '5000\uFF5E';
  };

  const sfLead = {
    LastName:            leadInfo.LastName,
    FirstName:           leadInfo.FirstName,
    Company:             leadInfo.Company,
    Phone:               leadInfo.Phone,
    Email:               leadInfo.Email,
    State:               leadInfo.State,
    Street:              leadInfo.Street,
    Employee_size__c:    resolveEmployeeSize(leadInfo.Employee_size__c),
    title__c:            jobTitleMap[leadInfo.title__c] ?? 'その他',
    Department__c:       leadInfo.Department__c,
    ComparisonSiteContent__c: leadInfo.web__c,
    integration_ID__c:   leadInfo.integration_ID__c,
    first_touchpoint__c: leadInfo.first_touchpoint__c,
    LeadSource:          leadInfo.LeadSource,
    product__c:          leadInfo.product__c,
    InstallationTime__c: leadInfo.InstallationTime__c,
    Description:         leadInfo.Remarks__c ? `【DL区分】${leadInfo.Remarks__c}` : '',
    LeadSourceTime__c:   leadInfo.LeadSourceTime__c,
    LeadSourceDate__c:   leadInfo.LeadSourceDate__c,
  };

  // ⑥ SF認証
  let token: string;
  try {
    token = await getSalesforceToken();
  } catch (e: any) {
    await notifySlackError('アスピック', 'SF認証失敗', e.message);
    throw e;
  }

  // ⑦ 重複チェック（注文番号）
  const exists = await findLeadByIntegrationId(token, sfLead.integration_ID__c);
  if (exists) {
    console.log('⏭️ スキップ（登録済み）: No.', sfLead.integration_ID__c);
    return;
  }

  // ⑧ SF登録
  try {
    const result = await createSFLead(token, {
      ...sfLead,
      User__c: process.env.SF_ADMIN_USER_ID,
    });
    console.log('🎉 登録完了！SF ID:', result.id);
  } catch (e: any) {
    await notifySlackError('アスピック', 'SF登録失敗', `No.${sfLead.integration_ID__c}\n${e.message}`);
    throw e;
  }
});

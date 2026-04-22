import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import { IimitsuLoginPage } from '../pages/IimitsuLoginPage';
import { IimitsuLeadPage } from '../pages/IimitsuLeadPage';
import { getSalesforceToken, createSFLead, findLeadByIntegrationId, findLeadIdByEmail, updateSFLead } from '../salesforce';
import { notifySlackError } from '../slack';

dotenv.config();

test('アイミツ リードスクレイプ → SF登録', async ({ page }) => {

  const email    = process.env.IIMITSU_EMAIL!;
  const password = process.env.IIMITSU_PASSWORD!;

  // ① 自動ログイン
  const loginPage = new IimitsuLoginPage(page);
  await loginPage.goto();
  try {
    await loginPage.login(email, password);
  } catch (e: any) {
    await notifySlackError('アイミツ', 'ログイン失敗', e.message);
    throw e;
  }

  // ② リード一覧へ遷移して一番上のリードを開く
  const leadPage = new IimitsuLeadPage(page);
  try {
    await leadPage.gotoList();
    await leadPage.openLatestLead();
  } catch (e: any) {
    await notifySlackError('アイミツ', 'スクレイピング失敗', e.message);
    throw e;
  }

  // ③ リード情報を取得
  let leadInfo: any;
  try {
    leadInfo = await leadPage.getLeadInfo();
  } catch (e: any) {
    await notifySlackError('アイミツ', 'リード情報取得失敗', e.message);
    throw e;
  }

  // ④ 役職の変換マップ
  const jobTitleMap: Record<string, string> = {
    '代表取締役・社長': '代表',
    '経営者・役員相当': '役員クラス',
    '執行役員以上':     '役員クラス',
    '部長・次長相当':   '部長クラス',
    '課長・係長相当':   '課長クラス',
    '一般社員・スタッフ': '一般社員',
    'その他':           'その他',
  };

  const sfLead = {
    LastName:            leadInfo.LastName,
    FirstName:           leadInfo.FirstName,
    Company:             leadInfo.Company,
    Phone:               leadInfo.Phone,
    Email:               leadInfo.Email,
    State:               leadInfo.State,
    Street:              leadInfo.Street,
    Employee_size__c: (() => {
      const map: Record<string, string> = {
        '1〜9名':       '1\uFF5E10',
        '10〜29名':     '11\uFF5E49',
        '30〜99名':     '50\uFF5E99',
        '100〜299名':   '100\uFF5E299',
        '300〜499名':   '300\uFF5E499',
        '500〜999名':   '500\uFF5E999',
        '1000〜4999名': '1000\uFF5E4999',
        '5000名以上':   '5000\uFF5E',
      };
      return map[leadInfo.Employee_size__c] ?? '';
    })(),
    title__c:            jobTitleMap[leadInfo.title__c] ?? 'その他',
    Department__c:       leadInfo.Department__c,
    web__c:              leadInfo.web__c,
    InstallationTime__c: leadInfo.InstallationTime__c,
    Industry:            leadInfo.Industry,
    Field8__c:           parseInt(leadInfo.Field8__c) || 0,
    Description:         leadInfo.Description,
    integration_ID__c:   leadInfo.integration_ID__c,
    first_touchpoint__c: leadInfo.first_touchpoint__c,
    LeadSource:          leadInfo.LeadSource,
    product__c:          leadInfo.product__c,
    LeadSourceTime__c:   leadInfo.LeadSourceTime__c,
    LeadSourceDate__c:   leadInfo.LeadSourceDate__c,
  };

  // ⑤ SF認証
  let token: string;
  try {
    token = await getSalesforceToken();
  } catch (e: any) {
    await notifySlackError('アイミツ', 'SF認証失敗', e.message);
    throw e;
  }

  // ⑥ 重複チェック（リードID）
  const exists = await findLeadByIntegrationId(token, sfLead.integration_ID__c);
  if (exists) {
    console.log('⏭️ スキップ（登録済み）: リードID', sfLead.integration_ID__c);
    return;
  }

  // ⑦ メールアドレスで既存リード検索
  const existingLeadId = await findLeadIdByEmail(token, sfLead.Email);
  if (existingLeadId) {
    const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
    try {
      await updateSFLead(token, existingLeadId, {
        Remarks__c: `アイミツより再問い合わせあり（${today}）`,
      });
      console.log('🔄 既存リード備考更新（メール重複）: SF ID:', existingLeadId);
    } catch (e: any) {
      await notifySlackError('アイミツ', 'SF備考更新失敗', `SF ID:${existingLeadId}\n${e.message}`);
      throw e;
    }
    return;
  }

  // ⑧ SF登録
  try {
    const result = await createSFLead(token, sfLead);
    console.log('🎉 登録完了！SF ID:', result.id);
  } catch (e: any) {
    await notifySlackError('アイミツ', 'SF登録失敗', `リードID:${sfLead.integration_ID__c}\n${e.message}`);
    throw e;
  }
});
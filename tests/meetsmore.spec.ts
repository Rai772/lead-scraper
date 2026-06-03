import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import { MeetsmoreLoginPage } from '../pages/MeetsmoreLoginPage';
import { MeetsmoreLeadPage } from '../pages/MeetsmoreLeadPage';
import { getSalesforceToken, createSFLead, findLeadByIntegrationId } from '../salesforce';
import { notifySlackError } from '../slack';

dotenv.config();

test('ミツモア リードスクレイプ → SF登録', async ({ page }) => {

       const email = process.env.MEETSMORE_EMAIL!;
    const password = process.env.MEETSMORE_PASSWORD!;

       // ① 自動ログイン
       const loginPage = new MeetsmoreLoginPage(page);
    await loginPage.goto();
    try {
          await loginPage.login(email, password);
    } catch (e: any) {
    await notifySlackError('ミツモア', 'ログイン失敗', e.message);
          throw e;
    }

       // ② リード一覧へ遷移して一番上のリードを開く
       const leadPage = new MeetsmoreLeadPage(page);
    try {
          await leadPage.gotoList();
          await leadPage.openLatestLead();
    } catch (e: any) {
    await notifySlackError('ミツモア', 'スクレイピング失敗', e.message);
          throw e;
    }

       // ③ リード情報を取得
       let leadInfo: any;
    try {
          leadInfo = await leadPage.getLeadInfo();
    } catch (e: any) {
    await notifySlackError('ミツモア', 'リード情報取得失敗', e.message);
          throw e;
    }

       // ④ 従業員数の変換マップ
       const employeeSizeMap: Record<string, string> = {
             '1〜9名': '1～10',
             '10〜29名': '11～49',
             '30〜99名': '50～99',
             '100〜299名': '100～299',
             '300〜499名': '300～499',
             '500〜999名': '500～999',
             '1000〜4999名': '1000～4999',
             '5000名以上': '5000～',
       };

       const sfLead = {
             LastName: leadInfo.LastName,
             FirstName: leadInfo.FirstName,
             Company: leadInfo.Company,
             Phone: leadInfo.Phone,
             Email: leadInfo.Email,
             State: leadInfo.State,
             Street: leadInfo.Street,
             Employee_size__c: employeeSizeMap[leadInfo.Employee_size__c] ?? leadInfo.Employee_size__c ?? '',
             title__c: leadInfo.title__c,
             Department__c: leadInfo.Department__c,
             InstallationTime__c: leadInfo.InstallationTime__c,
             MainIndustry__c: leadInfo.MainIndustry__c,
             Field8__c: leadInfo.Field8__c,
             Description: leadInfo.Description,
             Remarks__c: leadInfo.Remarks__c,
             integration_ID__c: leadInfo.integration_ID__c,
             first_touchpoint__c: leadInfo.first_touchpoint__c,
             LeadSource: leadInfo.LeadSource,
             product__c: leadInfo.product__c,
             LeadSourceTime__c: leadInfo.LeadSourceTime__c,
             LeadSourceDate__c: leadInfo.LeadSourceDate__c,
       };

       // ⑤ SF認証
       let token: string;
    try {
          token = await getSalesforceToken();
    } catch (e: any) {
    await notifySlackError('ミツモア', 'SF認証失敗', e.message);
          throw e;
    }

       // ⑥ 重複チェック（リードID）
       const exists = await findLeadByIntegrationId(token, sfLead.integration_ID__c);
    if (exists) {
          console.log('⏭️ スキップ（登録済み）: リードID', sfLead.integration_ID__c);
          return;
    }

       // ⑦ SF登録
       try {
             const result = await createSFLead(token, {
                     ...sfLead,
                     User__c: process.env.SF_ADMIN_USER_ID,
             });
             console.log('🎉 登録完了！SF ID:', result.id);
       } catch (e: any) {
    await notifySlackError('ミツモア', 'SF登録失敗', `リードID:${sfLead.integration_ID__c}\n${e.message}`);
             throw e;
       }
});

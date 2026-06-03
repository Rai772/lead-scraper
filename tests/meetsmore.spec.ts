import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import { MeetsmoreLoginPage } from '../pages/MeetsmoreLoginPage';
import { MeetsmoreLeadPage } from '../pages/MeetsmoreLeadPage';
import { getSalesforceToken, createSFLead, findLeadByIntegrationId, findLeadIdByEmail, getExistingRemarks, buildRemarksText, updateSFLead } from '../salesforce';
import { notifySlackError } from '../slack';

dotenv.config();

test('ミツモア リードスクレイプ → SF登録', async ({ page }) => {

       const email    = process.env.MEETSMORE_EMAIL!;
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

       // ④ 役職の変換マップ
       const jobTitleMap: Record<string, string> = {
                  '代表取締役':       '代表',
                  '取締役':           '役員クラス',
                  '役員相当':         '役員クラス',
                  '執行役員相当':     '役員クラス',
                  '部長相当':         '部長クラス',
                  '課長相当':         '課長クラス',
                  '一般社員・その他': '一般社員',
                  'その他':           'その他',
       };

       // ⑤ 従業員規模を数値で範囲判定
       const resolveEmployeeSize = (raw: string): string => {
                  const num = parseInt(raw);
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

       // ⑥ 業種の変換マップ
       const industryMap: Record<string, string> = {
                  '飲食':                   'サービス業（飲食）',
                  '小売・卸売':             '小売業',
                  'サービス':               'サービス業（その他）',
                  '美容・サロン':           'サロン＆美容',
                  '医療・福祉':             '医療/福祉・介護',
                  '製造':                   '製造・メーカー',
                  '建設・工事':             '建設・工事',
                  '不動産':                 '不動産（その他）',
                  '農林水産':               'サービス業（その他）',
                  'IT・インターネット':     'IT＆通信',
                  '運輸・物流':             '運輸・物流',
                  'コンサルティング・士業': '総合コンサルティング',
                  '人材紹介・人材派遣':     '人材紹介',
                  '金融':                   '金融（その他）',
                  '広告・メディア':         '広告代理店',
                  '旅行・レジャー':         'エンタメ・娯楽、専門サービス',
                  '教育・学習支援':         '教育/学習塾',
                  '公務員':                 '行政',
                  'その他・近いものはない': 'その他',
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
                  web__c:              leadInfo.web__c,
                  integration_ID__c:   leadInfo.integration_ID__c,
                  first_touchpoint__c: leadInfo.first_touchpoint__c,
                  LeadSource:          leadInfo.LeadSource,
                  product__c:          leadInfo.product__c,
                  InstallationTime__c: leadInfo.InstallationTime__c,
                  Description:         leadInfo.Remarks__c,
                  Field8__c:           leadInfo.Field8__c,
                  LeadSourceTime__c:   leadInfo.LeadSourceTime__c,
                  LeadSourceDate__c:   leadInfo.LeadSourceDate__c,
                  MainIndustry__c:     industryMap[leadInfo.MainIndustry__c] ?? 'その他',
       };

       // ⑦ SF認証
       let token: string;
         try {
                    token = await getSalesforceToken();
         } catch (e: any) {
    await notifySlackError('ミツモア', 'SF認証失敗', e.message);
                    throw e;
         }

       // ⑧ 重複チェック（依頼ID）
       const exists = await findLeadByIntegrationId(token, sfLead.integration_ID__c);
         if (exists) {
                    console.log('⏭️ スキップ（登録済み）: 依頼ID', sfLead.integration_ID__c);
                    return;
         }

       // ⑨ メールアドレスで既存リード検索 → 備考追記して終了
       const existingLeadId = await findLeadIdByEmail(token, sfLead.Email);
         if (existingLeadId) {
                    try {
                                 const existingRemarks = await getExistingRemarks(token, existingLeadId);
                                 const remarks = buildRemarksText('ミツモア', leadInfo, existingRemarks);
                                 await updateSFLead(token, existingLeadId, { Remarks__c: remarks });
                                 console.log('🔄 既存リード備考更新（メール重複）: SF ID:', existingLeadId);
                    } catch (e: any) {
      await notifySlackError('ミツモア', 'SF備考更新失敗', `SF ID:${existingLeadId}\n${e.message}`);
                                 throw e;
                    }
                    return;
         }

       // ⑩ SF登録
       try {
                  const result = await createSFLead(token, {
                               ...sfLead,
                               User__c: process.env.SF_ADMIN_USER_ID,
                  });
                  console.log('🎉 登録完了！SF ID:', result.id);
       } catch (e: any) {
    await notifySlackError('ミツモア', 'SF登録失敗', `依頼ID:${sfLead.integration_ID__c}\n${e.message}`);
                  throw e;
       }
});

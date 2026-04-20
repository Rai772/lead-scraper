import { Page } from '@playwright/test';

export type IimitsuLeadInfo = {
  LastName: string;
  FirstName: string;
  Company: string;
  Phone: string;
  Email: string;
  State: string;
  Street: string;
  Employee_size__c: string;
  title__c: string;
  Department__c: string;
  web__c: string;
  InstallationTime__c: string;
  Industry: string;
  Field8__c: string;
  Description: string;
  integration_ID__c: string;
  first_touchpoint__c: string;
  LeadSource: string;
  product__c: string;
  LeadSourceTime__c: string;
  LeadSourceDate__c: string;
};

export class IimitsuLeadPage {

  constructor(private page: Page) {}

  // 一覧ページへ遷移する
  async gotoList() {
    await this.page.goto('https://saas.imitsu.jp/mypage-partner/lead');
    await this.page.waitForLoadState('domcontentloaded');
    console.log('📋 アイミツ リード一覧へ遷移');
  }

  // 一番上のリードを開く
  async openLatestLead() {
    await this.page.locator('a[href^="/mypage-partner/lead/"]').first().click();
    await this.page.waitForLoadState('domcontentloaded');
    console.log('📄 詳細URL:', this.page.url());
  }

  // リード情報を取得する
  async getLeadInfo(): Promise<IimitsuLeadInfo> {

    // spanラベルで値を取得するヘルパー関数
    const getByLabel = async (label: string) => {
      try {
        const labelEl = this.page.locator('p.mui-18g3h65', { hasText: label }).first();
        const parent  = labelEl.locator('xpath=..');
        const valueEl = parent.locator('p.mui-11o2v0y').first();
        return (await valueEl.textContent({ timeout: 2000 }) ?? '').trim();
      } catch {
        return '';
      }
    };

    // spanラベルで値を取得するヘルパー関数（ヒアリング内容用）
    const getBySpanLabel = async (label: string) => {
      try {
        const labelEl = this.page.locator('span.mui-1nf44rn', { hasText: label }).first();
        const parent  = labelEl.locator('xpath=..');
        const valueEl = parent.locator('p').first();
        return (await valueEl.textContent({ timeout: 2000 }) ?? '').trim();
      } catch {
        return '';
      }
    };

    // リードIDをURLから取得
    const integration_ID__c = this.page.url().split('/').pop() ?? '';

    // 担当者名を取得（自由形式のため分割しない）
    const fullName = await getByLabel('担当者').catch(() => '');
    const lastName = fullName.trim() || '不明';
    const firstName = '';

    // 住所を取得
    const prefecture = await getByLabel('所在地（都道府県）');
    const city       = await getByLabel('所在地（市区町村）');

    // 初回流入日時・日付を取得
    const rawDate = await getByLabel('取次日時');
    const leadSourceTime = rawDate.trim().replace(
      /(\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2})/,
      '$1-$2-$3T$4:00'
    );
    const leadSourceDate = rawDate.trim().substring(0, 10).replace(/\//g, '-');

    // Description用のヒアリング内容
    const installationDestination = await getBySpanLabel('導入先');
    const installationPurpose     = await getBySpanLabel('導入目的・背景');
    const currentSystem           = await getBySpanLabel('現在システムを利用しているか');
    const usageType               = await getBySpanLabel('主な利用用途');
    const requiredFeatures        = await getBySpanLabel('導入に必要な機能');
    const niceToHave              = await getBySpanLabel('あれば良い機能');
    const newNumber               = await getBySpanLabel('新規取得したい番号');

    const description = [
      `【導入先】${installationDestination}`,
      `【導入目的・背景】${installationPurpose}`,
      `【現在システムを利用しているか】${currentSystem}`,
      `【主な利用用途】${usageType}`,
      `【導入に必要な機能】${requiredFeatures}`,
      `【あれば良い機能】${niceToHave}`,
      `【新規取得したい番号】${newNumber}`,
    ].join('\n');

    const leadInfo: IimitsuLeadInfo = {
      LastName:            lastName,
      FirstName:           firstName,
      Company:             await getByLabel('会社'),
      Phone:               await getByLabel('電話番号'),
      Email:               await getByLabel('メールアドレス'),
      State:               prefecture,
      Street:              city,
      Employee_size__c:    await getByLabel('従業員規模'),
      title__c:            await getByLabel('役職'),
      Department__c:       await getByLabel('部署'),
      web__c:              await getBySpanLabel('カスタマーの現状'),
      InstallationTime__c: await getBySpanLabel('導入予定時期'),
      Industry:            await getByLabel('業界'),
      Field8__c:           await getBySpanLabel('サービス利用人数'),
      Description:          description,
      integration_ID__c,
      first_touchpoint__c: 'アイミツSaaS',
      LeadSource:          'アイミツSaaS',
      product__c:          'Comdesk Lead',
      LeadSourceTime__c:   leadSourceTime,
      LeadSourceDate__c:   leadSourceDate,
    };

    console.log('📋 取得データ:', JSON.stringify(leadInfo, null, 2));
    return leadInfo;
  }
}
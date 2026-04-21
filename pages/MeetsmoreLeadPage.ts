import { Page } from '@playwright/test';

export type MeetsmoreLeadInfo = {
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
  integration_ID__c: string;
  first_touchpoint__c: string;
  LeadSource: string;
  product__c: string;
  InstallationTime__c: string;
  Description: string;
  Remarks__c: string;
  Field8__c: number;
  LeadSourceTime__c: string;
  LeadSourceDate__c: string;
  MainIndustry__c: string;
};

export class MeetsmoreLeadPage {

  constructor(private page: Page) {}

  // 一覧ページへ遷移する
  async gotoList() {
    await this.page.getByRole('menuitem', { name: '顧客管理' }).click();
    await this.page.waitForLoadState('domcontentloaded');
    console.log('📋 ミツモア リード一覧へ遷移');
  }

  // 一番上のリードを開く
  async openLatestLead() {
    await this.page.locator('a').filter({ hasText: /有効/ }).first().click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(5000);
    console.log('📄 詳細URL:', this.page.url());
  }

  // リード情報を取得する
  async getLeadInfo(): Promise<MeetsmoreLeadInfo> {

    // 単一値取得
    const getByLabel = async (label: string) => {
      try {
        const row = this.page.locator('tr').filter({
          has: this.page.locator('td').filter({ hasText: new RegExp(`^${label}$`) })
        }).first();
        return (await row.locator('td').nth(1).locator('span').first().textContent({ timeout: 3000 }) ?? '').trim();
      } catch {
        return '';
      }
    };

    // チェックマークがついた値のみ取得
    const getCheckedValues = async (label: string) => {
      const row = this.page.locator('tr').filter({
        has: this.page.locator('td').filter({ hasText: new RegExp(`^${label}$`) })
      }).first();
      const valueTd     = row.locator('td').nth(1);
      const checkedDivs = valueTd.locator('div:has([data-testid="CheckIcon"])');
      try {
        const texts = await checkedDivs.locator('span').allTextContents();
        return texts.map(t => t.trim()).filter(t => t).join('、');
      } catch {
        return '';
      }
    };

    // 氏名を取得して苗字と名前に分割
    const fullName  = await this.page.locator('[data-testid="customer-name"]').textContent() ?? '';
    const nameParts = fullName.trim().split(/[\s　]+/);
    const lastName  = nameParts[0] ?? fullName;
    const firstName = nameParts[1] ?? '';

    // 住所を取得
    const fullAddress  = await this.page.locator('[data-testid="address"]').textContent() ?? '';
    const addressParts = fullAddress.trim().split(' ');
    const state  = addressParts[0] ?? '';
    const street = addressParts.slice(1).join(' ') ?? '';

    // 依頼日時を取得してSF形式に変換
    const rawDate = await this.page.locator('[data-testid="request-date"]').textContent() ?? '';
    const cleanDate = rawDate.replace(/\s*\(.*\)/, '').trim();
    const leadSourceTime = cleanDate.replace(
      /(\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2})/,
      '$1-$2-$3T$4:00'
    );
    const leadSourceDate = cleanDate.substring(0, 10).replace(/\//g, '-');

    // 各項目を取得
    const userCountRaw  = await getByLabel('想定利用人数') || await getByLabel('オペレーターの人数');
    const businessType  = await getCheckedValues('業務の種類');
    const otherServices = await getCheckedValues('導入検討サービス（CTIシステム以外）');
    const businessForm  = await getCheckedValues('事業形態');
    const industry      = await getCheckedValues('業種');

    const remarks = [
      `【事業形態】${businessForm}`,
      `【業務の種類】${businessType}`,
      `【想定利用人数】${userCountRaw}`,
      `【導入検討サービス】${otherServices}`,
    ].join('\n');

    const leadInfo: MeetsmoreLeadInfo = {
      LastName:            lastName,
      FirstName:           firstName,
      Company:             await this.page.locator('[data-testid="company-name"]').textContent() ?? '',
      Phone:               await this.page.locator('a[href^="tel:"]').first().textContent() ?? '',
      Email:               await this.page.locator('a[href^="mailto:"]').first().textContent() ?? '',
      State:               state,
      Street:              street,
      Employee_size__c:    await getByLabel('従業員数'),
      title__c:            await getCheckedValues('役職'),
      Department__c:       await getCheckedValues('所属部署・部門'),
      web__c:              '',
      integration_ID__c:   (await this.page.locator('[data-testid="request-id"]').textContent() ?? '').trim().substring(0, 20),
      first_touchpoint__c: 'ミツモア',
      LeadSource:          'ミツモア',
      product__c:          'Comdesk Lead',
      InstallationTime__c: await getCheckedValues('利用開始予定時期'),
      Description:         '',
      Remarks__c:          remarks,
      Field8__c:           parseInt(userCountRaw) || 0,
      LeadSourceTime__c:   leadSourceTime,
      LeadSourceDate__c:   leadSourceDate,
      MainIndustry__c:     industry,
    };

    console.log('📋 取得データ:', JSON.stringify(leadInfo, null, 2));
    return leadInfo;
  }
}
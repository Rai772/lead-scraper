import { Page } from '@playwright/test';

export type AspicLeadInfo = {
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
  Remarks__c: string;
  LeadSourceTime__c: string;
  LeadSourceDate__c: string;
};

export class AspicLeadPage {

  constructor(private page: Page) {}

  // 最新一覧へ遷移
  async gotoList() {
    await this.page.goto('https://asulead.cloud/asu/lead');
    await this.page.waitForLoadState('domcontentloaded');

    // 今月の期間を設定
    const now       = new Date();
    const year      = now.getFullYear();
    const month     = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay   = new Date(year, now.getMonth() + 1, 0).getDate();
    const startDate = `${year}-${month}-01`;
    const endDate   = `${year}-${month}-${lastDay}`;

    await this.page.locator('#formulate--asu-lead-2').fill(startDate);
    await this.page.locator('#formulate--asu-lead-3').fill(endDate);

    // 対象サービスを「すべて」に設定
    await this.page.locator('#formulate--asu-lead-4').selectOption('0');
    await this.page.waitForLoadState('domcontentloaded');

    console.log('📋 アスピック リード一覧へ遷移');
  }

  // 一番上のリードを開く
  async openLatestLead() {
    await this.page.locator('.atom_fnc_company_name').first().click();

    // 詳細が展開されるまで待つ
    await this.page.locator('.atom_fnc_base_data').first().waitFor({ timeout: 10000 });
    console.log('📄 詳細URL:', this.page.url());
  }

  // リード情報を取得する
  async getLeadInfo(): Promise<AspicLeadInfo> {

    // 全データを順番で取得
    const items = await this.page.locator('.atom_fnc_base_data').allTextContents();

    // 初回流入日時・日付を取得
    const rawDate = await this.page.locator('.atom_fnc_time_stamp').first().textContent() ?? '';
    const leadSourceTime = rawDate.trim().replace(
      /(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}:\d{2})/,
      '$1-$2-$3T$4'
    );
    const leadSourceDate = rawDate.trim().substring(0, 10); 

    // 氏名を苗字と名前に分割
    const fullName  = items[4] ?? '';
    const nameParts = fullName.trim().split(/[\s　]+/);
    const lastName  = nameParts[0] ?? fullName;
    const firstName = nameParts[1] ?? '';

    // No.を取得（integration_ID）
    const integration_ID__c = await this.page.locator('span[data-v-6f75b669]').first().textContent() ?? '';

    // 導入時期・DL区分を取得
    const installationTime = items[7] ?? '';
    const dlCategory       = items[8] ?? '';

    // 備考を取得（「備考はありません」の場合は空欄）
    const bikoRaw    = items[9] ?? '';
    const webInquiry = (bikoRaw.trim() === '備考はありません' || bikoRaw.trim() === '-') ? '' : bikoRaw.trim();

    const leadInfo: AspicLeadInfo = {
      LastName:            lastName,
      FirstName:           firstName,
      Company:             items[0] ?? '',
      Phone:               items[5] ?? '',
      Email:               items[6] ?? '',
      State:               '',
      Street:              '',
      Employee_size__c:    items[1] ?? '',
      title__c:            items[3] ?? '',
      Department__c:       items[2] ?? '',
      web__c:              webInquiry,
      integration_ID__c:   integration_ID__c.trim(),
      first_touchpoint__c: 'アスピック',
      LeadSource:          'アスピック',
      product__c:          'Comdesk Lead',
      InstallationTime__c: installationTime.trim(),
      Remarks__c:          dlCategory.trim(),
      LeadSourceTime__c:   leadSourceTime,
      LeadSourceDate__c:   leadSourceDate,
    };

    console.log('📋 取得データ:', JSON.stringify(leadInfo, null, 2));
    return leadInfo;
  }
}
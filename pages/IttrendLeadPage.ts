import { Page } from '@playwright/test';

export type LeadInfo = {
  LastName: string;
  FirstName: string;
  Company: string;
  Phone: string;
  Email: string;
  State: string;
  Street: string;
  LeadSourceTime__c: string;
  integration_ID__c: string;
  Employee_size__c: string;
  MainIndustry__c: string;
  Department__c: string;
  title__c: string;
  InstallationTime__c: string;
  Field5__c: string;
  product__c: string;
  first_touchpoint__c: string;
  Description: string;
  LeadSource: string;
  Remarks__c: string;
  web__c: string;
  LeadSourceDate__c: string;
};

export class IttrendLeadPage {

  constructor(private page: Page) {}

  // 資料請求一覧ページへ遷移する
  async gotoList() {
    await this.page.getByRole('link', { name: '資料請求一覧・履歴' }).click();
    await this.page.waitForLoadState('domcontentloaded');
    console.log('📋 資料請求一覧へ遷移');
  }

  // 今月で検索して一番上の詳細を開く
  async openLatestLead() {
    await this.page.locator('.fa.fa-calendar').first().click();
    await this.page.getByText('今月').click();
    await this.page.getByRole('button', { name: '検 索' }).click();
    await this.page.waitForLoadState('domcontentloaded');
    console.log('🔍 検索完了');

    const pagePromise = this.page.context().waitForEvent('page');
    await this.page.locator('.fa.fa-file-text-o').first().click();

    const newPage = await pagePromise;
    await newPage.waitForLoadState('domcontentloaded');
    console.log('📄 詳細URL:', newPage.url());

    return newPage;
  }

  // 詳細ページへ直接アクセス（テスト用）
  async goto(orderUrl: string) {
    await this.page.goto(orderUrl);
  }

  // リード情報を取得する
  async getLeadInfo(target?: Page): Promise<LeadInfo> {
    const p = target || this.page;

    const lead = await p.evaluate(() => {

      // ラベルで値を取得するヘルパー関数
      const getByLabel = (label: string): string => {
        for (const th of document.querySelectorAll('th')) {
          if (th.textContent?.trim() === label) {
            const row = th.closest('tr');
            if (!row) continue;
            const thIndex = Array.from(row.children).indexOf(th);
            for (const td of row.querySelectorAll('td')) {
              if (Array.from(row.children).indexOf(td) > thIndex) {
                return td.textContent?.trim() ?? '';
              }
            }
          }
        }
        return '';
      };

      // 氏名分割
      const fullName  = getByLabel('氏名');
      const nameParts = fullName.split(/[\s　]+/);
      const lastName  = nameParts[0] || fullName;
      const firstName = nameParts[1] || '';

      // 住所クリーニング
      const rawAddress = getByLabel('住所');
      const address = rawAddress
        .replace(/郵便番号を取得/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // 従業員規模の変換
      const employeeSizeMap: Record<string, string> = {
        '10名未満':   '1\uFF5E10',
        '10名以上':   '11\uFF5E49',
        '50名以上':   '50\uFF5E99',
        '100名以上':  '100\uFF5E299',
        '250名以上':  '300\uFF5E499',
        '500名以上':  '500\uFF5E999',
        '750名以上':  '500\uFF5E999',
        '1000名以上': '1000\uFF5E4999',
        '5000名以上': '5000\uFF5E',
      };
      const employeeSize = employeeSizeMap[getByLabel('従業員規模')] ?? '';

      // お問い合わせ内容
      let inquiryText = '';
      for (const p of document.querySelectorAll('p.bold.font-gray')) {
        if (p.textContent?.trim() === 'お問い合わせ内容') {
          const next = p.nextElementSibling;
          if (next) inquiryText = next.textContent?.trim() ?? '';
          break;
        }
      }

      // 資料請求日をSF形式に変換
      const rawDate = getByLabel('資料請求日');
      const leadSourceTime = rawDate
        ? rawDate.replace(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2})/, '$1-$2-$3T$4:00')
        : '';

      // 説明欄
      const description = [
        `【お客様の立場】${getByLabel('役職')}`,
        `【導入予定時期】${getByLabel('導入予定時期')}`,
        `【導入状況】${getByLabel('導入状況')}`,
      ].join('\n');

      return {
        LastName:            lastName,
        FirstName:           firstName,
        Company:             getByLabel('企業名'),
        Phone:               getByLabel('電話番号'),
        Email:               getByLabel('メールアドレス'),
        State:               address.split(' ')[0] ?? '',
        Street:              address.split(' ').slice(1).join(' ') ?? '',
        LeadSourceTime__c:   leadSourceTime,
        integration_ID__c:   getByLabel('注文番号'),
        Employee_size__c:    employeeSize,
        MainIndustry__c:     getByLabel('業種'),
        Department__c:       getByLabel('部署名'),
        title__c:            getByLabel('役職'),
        InstallationTime__c: getByLabel('導入予定時期'),
        Field5__c:           getByLabel('導入状況'),
        product__c:          'Comdesk Lead',
        first_touchpoint__c: 'ITトレンド',
        Description:         description,
        Remarks__c:          getByLabel('請求単価'),
        web__c:              inquiryText,
        LeadSource:          'ITトレンド',
        LeadSourceDate__c: leadSourceTime.substring(0, 10), 
      };
    });

    console.log('📋 取得データ:', JSON.stringify(lead, null, 2));
    return lead;
  }
}
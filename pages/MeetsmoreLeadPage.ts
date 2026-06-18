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

  async gotoList() {
        await this.page.getByRole('menuitem', { name: '顧客管理' }).click();
        await this.page.waitForLoadState('domcontentloaded');
        console.log('📋 ミツモア リード一覧へ遷移');
  }

  async openLatestLead() {
        await this.page.locator('a').filter({ hasText: /有効/ }).nth(1).click();
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(5000);
        console.log('📄 詳細URL:', this.page.url());
  }

  async getLeadInfo(): Promise<MeetsmoreLeadInfo> {

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

      const getCheckedValues = async (label: string) => {
              const row = this.page.locator('tr').filter({
                        has: this.page.locator('td').filter({ hasText: new RegExp(`^${label}$`) })
              }).first();
              const valueTd = row.locator('td').nth(1);
              const checkedDivs = valueTd.locator('div:has([data-testid="CheckIcon"])');
              try {
                        const texts = await checkedDivs.locator('span').allTextContents();
                        return texts.map(t => t.trim()).filter(t => t).join('、');
              } catch {
                        return '';
              }
      };

      const fullName = await this.page.locator('[data-testid="customer-name"]').textContent() ?? '';
        const nameParts = fullName.trim().split(/[\s\u3000]+/);
        const lastName = nameParts[0] ?? fullName;
        const firstName = nameParts[1] ?? '';

      const fullAddress = await this.page.locator('[data-testid="address"]').textContent() ?? '';
        const addressParts = fullAddress.trim().split(' ');
        const state = addressParts[0] ?? '';
        const street = addressParts.slice(1).join(' ') ?? '';

      // 依頼日時を取得してJST対応でSF形式に変換
      let rawDate = '';
        try {
                rawDate = await this.page.locator('[data-testid="lead-date"]').textContent({ timeout: 5000 }) ?? '';
        } catch {
                rawDate = '';
        }
        console.log('📅 rawDate:', rawDate);
        // カッコ書き除去・全角スペース正規化・前後空白除去
      const cleanDate = rawDate.replace(/\s*\(.*?\)/, '').replace(/\u3000/g, ' ').trim();
        console.log('📅 cleanDate:', cleanDate);

      const match = cleanDate.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})\s+(\d{2}):(\d{2})/);
        let leadSourceTime = '';
        let leadSourceDate = '';
        if (match) {
                // ページはJST表示なのでそのまま使用
                leadSourceTime = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00`;
                leadSourceDate = `${match[1]}-${match[2]}-${match[3]}`;
        } else {
                console.log('⚠️ 日付パース失敗 cleanDate:', cleanDate);
        }

      let userCountRaw = '';
        let userCountLabel = '想定利用人数';

      const count1 = await getByLabel('想定利用人数');
        const count2 = await getByLabel('オペレーターの人数');

      if (count1) {
              userCountRaw = count1;
              userCountLabel = '想定利用人数';
      } else if (count2) {
              userCountRaw = count2;
              userCountLabel = 'オペレーターの人数';
      }

      const businessType = await getCheckedValues('業務の種類');
        const otherServices = await getCheckedValues('導入検討サービス（CTIシステム以外）');
        const businessForm = await getCheckedValues('事業形態');
        const industry = await getCheckedValues('業種');

      const remarks = [
              `【事業形態】${businessForm}`,
              `【業務の種類】${businessType}`,
              `【${userCountLabel}】${userCountRaw}`,
              `【導入検討サービス】${otherServices}`,
            ].join('\n');

      const leadInfo: MeetsmoreLeadInfo = {
              LastName: lastName,
              FirstName: firstName,
              Company: await this.page.locator('[data-testid="company-name"]').textContent() ?? '',
              Phone: await this.page.locator('a[href^="tel:"]').first().textContent() ?? '',
              Email: await this.page.locator('a[href^="mailto:"]').first().textContent() ?? '',
              State: state,
              Street: street,
              Employee_size__c: await getByLabel('従業員数'),
              title__c: await getCheckedValues('役職'),
              Department__c: await getCheckedValues('所属部署・部門'),
              web__c: '',
              integration_ID__c: (await this.page.locator('[data-testid="request-id"]').textContent() ?? '').trim().substring(0, 20),
              first_touchpoint__c: 'ミツモア',
              LeadSource: 'ミツモア',
              product__c: 'Comdesk Lead',
              InstallationTime__c: await getCheckedValues('利用開始予定時期'),
              Description: '',
              Remarks__c: remarks,
              Field8__c: parseInt(userCountRaw) || 0,
              LeadSourceTime__c: leadSourceTime,
              LeadSourceDate__c: leadSourceDate,
              MainIndustry__c: industry,
      };

      console.log('📋 取得データ:', JSON.stringify(leadInfo, null, 2));
        return leadInfo;
  }
}

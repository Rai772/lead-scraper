import { Page } from '@playwright/test';

export class MeetsmoreLoginPage {

  constructor(private page: Page) {}

  // ログインページを開く
  async goto() {
    await this.page.goto('https://meetsmore.com/login');
  }

  // ログインする
  async login(email: string, password: string) {
    await this.page.getByRole('textbox', { name: 'メールアドレス' }).fill(email);
    await this.page.getByRole('button', { name: '次へ' }).click();
    await this.page.getByRole('textbox', { name: 'パスワード' }).fill(password);
    await this.page.getByRole('button', { name: 'ログイン', exact: true }).click();

    // ログイン完了を待つ
    await this.page.waitForURL('**/account/product-provider**', { timeout: 30000 });
    console.log('✅ ミツモア ログイン成功！');
  }
}
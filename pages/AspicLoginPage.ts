import { Page } from '@playwright/test';

export class AspicLoginPage {

  constructor(private page: Page) {}

  // ログインページを開く
  async goto() {
    await this.page.goto('https://asulead.cloud/asu/login');
  }

  // ログインする
  async login(email: string, password: string) {
    await this.page.getByRole('textbox', { name: 'ログインIDを入力してください' }).fill(email);
    await this.page.getByRole('textbox', { name: 'パスワードを入力してください' }).fill(password);
    await this.page.getByRole('button', { name: 'ログイン' }).click();

    // ログイン完了を待つ
    await this.page.waitForLoadState('networkidle');
    console.log('✅ アスピック ログイン成功！');
  }
}
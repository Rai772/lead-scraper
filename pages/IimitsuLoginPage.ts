import { Page } from '@playwright/test';

export class IimitsuLoginPage {

  constructor(private page: Page) {}

  // ログインページを開く
  async goto() {
    await this.page.goto('https://saas.imitsu.jp/mypage-partner/login');
  }

  // ログインする
  async login(email: string, password: string) {
    // Auth0ログイン画面へ遷移
    await this.page.getByRole('link', { name: 'ログイン画面へ' }).click();

    // メールアドレスを入力
    await this.page.getByRole('textbox', { name: 'メールアドレス' }).fill(email);

    // パスワードを入力
    await this.page.getByRole('textbox', { name: 'パスワード' }).fill(password);
    await this.page.getByRole('button', { name: '続ける' }).click();

    // ログイン完了を待つ
    await this.page.waitForURL('**/mypage-partner**', { timeout: 30000 });
    console.log('✅ アイミツ ログイン成功！');
  }
}
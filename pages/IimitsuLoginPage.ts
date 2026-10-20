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

    // Auth0の画面が開くまで待つ（ラベル名に依存しないセレクタを使用）
    const emailInput = this.page
      .locator('input[name="username"], input[name="email"], input[type="email"]')
      .or(this.page.getByRole('textbox', { name: /メールアドレス|Email/i }))
      .first();
    await emailInput.waitFor({ state: 'visible', timeout: 30000 });
    console.log('🔎 アイミツ ログイン画面URL:', this.page.url());

    // メールアドレスを入力
    await emailInput.fill(email);

    // Auth0がメール→パスワードの2段階画面の場合は先に「続ける」を押す
    const passwordInput = this.page
      .locator('input[name="password"], input[type="password"]')
      .first();
    if (!(await passwordInput.isVisible())) {
      await this.page.getByRole('button', { name: /続ける|Continue/i }).first().click();
      await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
    }

    // パスワードを入力
    await passwordInput.fill(password);
    await this.page.getByRole('button', { name: /続ける|ログイン|Continue|Log in/i }).first().click();

    // ログイン完了を待つ
    await this.page.waitForURL('**/mypage-partner**', { timeout: 30000 });
    console.log('✅ アイミツ ログイン成功！');
  }
}

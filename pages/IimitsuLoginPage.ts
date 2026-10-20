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
    // ※Auth0画面はブラウザの言語設定で日本語/英語が切り替わる（CIでは英語になる）ため両対応
    await this.page.getByRole('textbox', { name: /メールアドレス|Email address/ }).fill(email);

    // パスワードを入力
    await this.page.getByRole('textbox', { name: /パスワード|^Password$/ }).fill(password);
    await this.page.getByRole('button', { name: /^(続ける|Continue)$/ }).click();

    // ログイン完了を待つ
    await this.page.waitForURL('**/mypage-partner**', { timeout: 30000 });
    console.log('✅ アイミツ ログイン成功！');
  }
}
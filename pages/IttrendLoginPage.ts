import { Page, BrowserContext } from '@playwright/test';
import { sendSlackNotification } from '../slack';

export class IttrendLoginPage {

  constructor(private page: Page) {}

  // ログインページを開く
  async goto() {
    await this.page.goto('https://client.it-trend.jp/login');
  }

  // セッションを使ってログインする
  async loginWithSession(context: BrowserContext) {
    // 詳細ページに直接アクセスしてセッションが有効か確認
    await this.page.goto('https://client.it-trend.jp/dashboard');

    // ログインページにリダイレクトされたらセッション切れ
    if (this.page.url().includes('/login')) {
      console.log('⚠️ セッション切れ！Slackに通知します...');
      await sendSlackNotification(
        '🚨 ITトレンドのセッションが切れました。\n`npx playwright test tests/save-session.ts --headed --project=chromium'
      );
      throw new Error('セッション切れ：再ログインが必要です');
    }

    console.log('✅ セッション有効！ログイン成功！');
  }

  // 通常ログイン（セッション保存用）
  async login(email: string, password: string) {
    await this.page.locator('input[name="email"]').click();
    await this.page.locator('input[name="email"]').fill(email);
    await this.page.locator('input[name="password"]').click();
    await this.page.locator('input[name="password"]').fill(password);
    await this.page.getByRole('button', { name: 'ログイン' }).click();
    await this.page.waitForURL('**/dashboard**', { timeout: 60000 });
    console.log('ログイン成功！');
  }
}
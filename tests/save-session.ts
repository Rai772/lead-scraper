import { test } from '@playwright/test';
import { chromium } from '@playwright/test';

test('セッション保存', async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();

  // ログインページを開く
  await page.goto('https://client.it-trend.jp/login');

  console.log('=============================');
  console.log('手動でログインしてください！');
  console.log('reCAPTCHAも手動で解決してください');
  console.log('=============================');

  // ログイン完了まで待機
  await page.waitForURL('**/dashboard**', { timeout: 120000 });

  // セッションを保存
  await context.storageState({ path: 'session.json' });
  console.log('✅ セッションを保存しました！');

  await browser.close();
});
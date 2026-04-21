import { test } from '@playwright/test';
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

test('セッション保存 → GitHub Secrets更新', async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto('https://client.it-trend.jp/login');

  console.log('=============================');
  console.log('手動でログインしてください！');
  console.log('reCAPTCHAも手動で解決してください');
  console.log('=============================');

  await page.waitForURL('**/dashboard**', { timeout: 120000 });

  await context.storageState({ path: 'session.json' });
  console.log('✅ セッションを保存しました！');

  await browser.close();

  await updateGitHubSecret();
});

async function updateGitHubSecret() {
  const sessionJson = fs.readFileSync('session.json', 'utf-8');
  const token       = process.env.GITHUB_PAT!;
  const owner       = 'Rai772';
  const repo        = 'lead-scraper';
  const secretName  = 'SESSION_JSON';

  // 公開鍵を取得
  const keyRes  = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.github.v3+json',
      },
    }
  );
  const keyData = await keyRes.json();
  console.log('🔍 keyData:', JSON.stringify(keyData));

  if (!keyData.key) {
    console.error('❌ 公開鍵の取得に失敗しました:', JSON.stringify(keyData));
    return;
  }

  // tweetsodiumで暗号化
  const sodium         = require('tweetsodium');
  const keyBytes       = Buffer.from(keyData.key, 'base64');
  const valueBytes     = Buffer.from(sessionJson);
  const encrypted      = sodium.seal(valueBytes, keyBytes);
  const encryptedValue = Buffer.from(encrypted).toString('base64');

  // Secretを更新
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        encrypted_value: encryptedValue,
        key_id:          keyData.key_id,
      }),
    }
  );

  if (res.ok) {
    console.log('✅ GitHub Secrets (SESSION_JSON) を自動更新しました！');
  } else {
    const data = await res.json();
    console.error('❌ GitHub Secrets更新失敗:', JSON.stringify(data));
  }
}
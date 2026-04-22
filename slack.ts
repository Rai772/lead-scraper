import * as dotenv from 'dotenv';
dotenv.config();

export async function notifySlackError(service: string, errorType: string, detail: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('SLACK_WEBHOOK_URL が設定されていません');
    return;
  }

  const message = {
    text: `🚨 *${service}* 自動登録エラー`,
    attachments: [
      {
        color: 'danger',
        fields: [
          { title: 'エラー種別', value: errorType, short: true },
          { title: '詳細',       value: detail,    short: false },
        ],
        footer: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      },
    ],
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });

  console.log(`📣 Slack通知送信: [${service}] ${errorType}`);
}
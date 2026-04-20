require('dotenv').config();

// Slackに通知を送る
export async function sendSlackNotification(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL!;

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: message,
    }),
  });

  if (!res.ok) {
    console.error('Slack通知失敗:', res.statusText);
  } else {
    console.log('✅ Slack通知送信成功');
  }
}
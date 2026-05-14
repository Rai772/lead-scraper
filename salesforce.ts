require('dotenv').config();

function escapeSoqlString(value: string): string {
  // SOQLは文字列をシングルクォートで囲むため、' と \ をエスケープしてクエリ破壊を防ぐ
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// SFのアクセストークンを取得する
export async function getSalesforceToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     process.env.SF_CLIENT_ID!,
    client_secret: process.env.SF_CLIENT_SECRET!,
  });

  const res = await fetch(`https://widsley.my.salesforce.com/services/oauth2/token`, {
    method: 'POST',
    body:   params,
  });

  const data = await res.json() as any;
  if (!data.access_token) {
    throw new Error('SF認証失敗: ' + JSON.stringify(data));
  }

  console.log('✅ SF認証成功');
  return data.access_token;
}

// SFにリードを新規登録する
export async function createSFLead(token: string, lead: Record<string, any>): Promise<any> {
  const res = await fetch(`${process.env.SF_INSTANCE_URL}/services/data/v59.0/sobjects/Lead`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Sforce-Duplicate-Rules-Header': 'allowSave=true',
    },
    body: JSON.stringify(lead),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    throw new Error('SFリード登録失敗: ' + JSON.stringify(data));
  }

  console.log('✅ SFリード登録成功 ID:', data.id);
  return data;
}

// メールアドレスまたは電話番号で重複チェック
export async function findLeadByEmailOrPhone(
  token: string,
  email: string,
  phone: string
): Promise<boolean> {
  if (!email && !phone) return false;

  const conditions: string[] = [];
  if (email) conditions.push(`Email = '${escapeSoqlString(email)}'`);
  if (phone) conditions.push(`Phone = '${escapeSoqlString(phone)}'`);

  const query = encodeURIComponent(
    `SELECT Id FROM Lead WHERE ${conditions.join(' OR ')} LIMIT 1`
  );

  const res = await fetch(
    `${process.env.SF_INSTANCE_URL}/services/data/v59.0/query?q=${query}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error('SF重複チェック失敗(email/phone): ' + JSON.stringify(data));
  }
  return data.totalSize > 0;
}

// 注文番号で重複チェックをする（登録済みならtrueを返す）
export async function findLeadByIntegrationId(token: string, integrationId: string): Promise<boolean> {
  if (!integrationId) return false;

  const query = encodeURIComponent(
    `SELECT Id FROM Lead WHERE integration_ID__c = '${escapeSoqlString(integrationId)}' LIMIT 1`
  );
  const res = await fetch(
    `${process.env.SF_INSTANCE_URL}/services/data/v59.0/query?q=${query}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error('SF重複チェック失敗(integrationId): ' + JSON.stringify(data));
  }
  return data.totalSize > 0;
}

// integration_ID__cでリードIDを取得する
export async function findLeadIdByIntegrationId(token: string, integrationId: string): Promise<string | null> {
  if (!integrationId) return null;

  const query = encodeURIComponent(
    `SELECT Id FROM Lead WHERE integration_ID__c = '${escapeSoqlString(integrationId)}' LIMIT 1`
  );
  const res = await fetch(
    `${process.env.SF_INSTANCE_URL}/services/data/v59.0/query?q=${query}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await res.json() as any;
  return data.totalSize > 0 ? data.records[0].Id : null;
}

// メールアドレスでリードIDを取得する
export async function findLeadIdByEmail(token: string, email: string): Promise<string | null> {
  if (!email) return null;

  const query = encodeURIComponent(
    `SELECT Id FROM Lead WHERE Email = '${escapeSoqlString(email)}' LIMIT 1`
  );
  const res = await fetch(
    `${process.env.SF_INSTANCE_URL}/services/data/v59.0/query?q=${query}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await res.json() as any;
  return data.totalSize > 0 ? data.records[0].Id : null;
}

// 既存リードの現在の Remarks__c を取得する
export async function getExistingRemarks(token: string, leadId: string): Promise<string> {
  const res = await fetch(
    `${process.env.SF_INSTANCE_URL}/services/data/v59.0/sobjects/Lead/${leadId}?fields=Remarks__c`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error('SF備考取得失敗: ' + JSON.stringify(data));
  }
  return data.Remarks__c ?? '';
}

// 再問い合わせ時に既存リードの備考に追記するテキストを組み立てる
export function buildRemarksText(
  sourceName: string,
  leadInfo: Record<string, any>,
  existingRemarks: string
): string {
  const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

  const lines: string[] = [];
  lines.push(`【${sourceName}より再問い合わせあり】`);
  lines.push(`日付：${today}`);
  if (leadInfo.LastName || leadInfo.FirstName) {
    lines.push(`氏名：${(leadInfo.LastName ?? '')} ${(leadInfo.FirstName ?? '')}`.trimEnd());
  }
  if (leadInfo.Company)          lines.push(`会社名：${leadInfo.Company}`);
  if (leadInfo.Phone)            lines.push(`電話番号：${leadInfo.Phone}`);
  if (leadInfo.Employee_size__c) lines.push(`従業員規模：${leadInfo.Employee_size__c}`);
  if (leadInfo.web__c)           lines.push(`WEB問い合わせ：${leadInfo.web__c}`);
  if (leadInfo.Description)      lines.push(`説明：${leadInfo.Description}`);
  if (leadInfo.Remarks__c)       lines.push(`備考：${leadInfo.Remarks__c}`);

  const newEntry = lines.join('\n');

  return existingRemarks
    ? `${existingRemarks}\n\n${newEntry}`
    : newEntry;
}

// SFのリードを更新する
export async function updateSFLead(token: string, leadId: string, lead: Record<string, any>): Promise<void> {
  const res = await fetch(
    `${process.env.SF_INSTANCE_URL}/services/data/v59.0/sobjects/Lead/${leadId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lead),
    }
  );

  if (!res.ok) {
    const data = await res.json() as any;
    throw new Error('SFリード更新失敗: ' + JSON.stringify(data));
  }

  console.log('✅ SFリード更新成功 ID:', leadId);
}
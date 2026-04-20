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

  const data = await res.json();
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

  const data = await res.json();

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
  const data = await res.json();
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
  const data = await res.json();
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
  const data = await res.json();
  return data.totalSize > 0 ? data.records[0].Id : null;
}

/// メールアドレスでリードIDを取得する
export async function findLeadIdByEmail(token: string, email: string): Promise<string | null> {
  if (!email) return null;

  const query = encodeURIComponent(
    `SELECT Id FROM Lead WHERE Email = '${escapeSoqlString(email)}' LIMIT 1`
  );
  const res = await fetch(
    `${process.env.SF_INSTANCE_URL}/services/data/v59.0/query?q=${query}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.totalSize > 0 ? data.records[0].Id : null;
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
    const data = await res.json();
    throw new Error('SFリード更新失敗: ' + JSON.stringify(data));
  }

  console.log('✅ SFリード更新成功 ID:', leadId);
}
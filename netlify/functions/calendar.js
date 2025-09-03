// 予約カレンダー保存API（Netlify Functions）
const { getStore } = require('@netlify/blobs');
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };

  const store = getStore('calendar');         // サーバー側の保存箱
  const ADMIN_PIN = String(process.env.ADMIN_PIN || ''); // 管理者PIN（後でNetlifyに設定）

  try {
    if (event.httpMethod === 'GET') {
      const { ym, verify, pin } = event.queryStringParameters || {};
      // PINテスト用（動作確認）
      if (verify) {
        const ok = !!pin && pin === ADMIN_PIN;
        return { statusCode: ok ? 200 : 401, headers: cors, body: JSON.stringify({ ok }) };
      }
      // 指定月の状態を返す（例 ym="2025-09"）
      if (!ym) return { statusCode: 400, headers: cors, body: 'Missing ym' };
      const data = await store.get(ym, { type: 'json' });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ days: data || {} }) };
    }

    if (event.httpMethod === 'POST') {
      // { ym: "2025-09", patch: { "10": {status:"taken"} }, mode: "reserve"|"admin", pin?: "2468" }
      const { ym, patch, mode, pin } = JSON.parse(event.body || '{}');
      if (!ym || !patch) return { statusCode: 400, headers: cors, body: 'Missing ym or patch' };

      // 管理者モードからの手動操作だけPINチェック
      if (mode === 'admin') {
        if (!pin || pin !== ADMIN_PIN) return { statusCode: 401, headers: cors, body: 'Unauthorized' };
      }

      const current = (await store.get(ym, { type: 'json' })) || {};
      const merged = { ...current, ...patch };   // 月データに日別パッチをマージ
      await store.set(ym, JSON.stringify(merged), { metadata: { updatedAt: Date.now() } });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: cors, body: 'Method not allowed' };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: 'Server error' };
  }
};

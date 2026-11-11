const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const BASE = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}`;

async function airtable(method, path, body) {
  const res = await fetch(`${BASE}/${encodeURIComponent(path)}`, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Airtable ${method} ${path}: ${await res.text()}`);
  return res.json();
}

async function batchCreate(table, records) {
  const ids = [];
  for (let i = 0; i < records.length; i += 10) {
    const d = await airtable('POST', table, { records: records.slice(i, i + 10) });
    ids.push(...d.records.map(r => r.id));
  }
  return ids;
}

async function batchPatch(table, updates) {
  for (let i = 0; i < updates.length; i += 10) {
    await airtable('PATCH', table, { records: updates.slice(i, i + 10) });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) return { statusCode: 500, headers: CORS, body: 'Server not configured' };

  let payload;
  try { payload = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: 'Invalid JSON' }; }

  const { op, table } = payload;
  if (!table) return { statusCode: 400, headers: CORS, body: 'Missing table' };

  try {
    if (op === 'create') {
      const ids = await batchCreate(table, payload.records || []);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ids }) };

    } else if (op === 'patch') {
      await batchPatch(table, payload.updates || []);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };

    } else {
      return { statusCode: 400, headers: CORS, body: `Unknown op: ${op}` };
    }
  } catch (err) {
    console.error(err);
    return { statusCode: 502, headers: CORS, body: err.message };
  }
};

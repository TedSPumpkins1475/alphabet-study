const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    return { statusCode: 500, headers: CORS, body: 'Server not configured' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS, body: 'Invalid JSON' };
  }

  const { summaryRecords = [], perItemRecords = [] } = payload;
  const airtableHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const postBatch = async (table, records) => {
    for (let i = 0; i < records.length; i += 10) {
      const res = await fetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
        { method: 'POST', headers: airtableHeaders,
          body: JSON.stringify({ records: records.slice(i, i + 10) }) }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Airtable ${table} error: ${err}`);
      }
    }
  };

  try {
    await postBatch('Summary', summaryRecords);
    if (perItemRecords.length) await postBatch('PerItem', perItemRecords);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 502, headers: CORS, body: err.message };
  }
};

const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
};

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

function supabaseReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(data && { 'Content-Length': Buffer.byteLength(data) })
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Use Supabase's SQL endpoint to create the table
async function runSQL(sql) {
  // Try the pg endpoint approach via a direct REST call
  const result = await supabaseReq('POST', '/rest/v1/rpc/exec_sql', { query: sql });
  return result;
}

async function main() {
  console.log('Creating elena_conversas table via INSERT test...');
  
  // Try to query the table - if it fails, it doesn't exist
  const check = await supabaseReq('GET', '/rest/v1/elena_conversas?limit=1');
  if (check.status === 200) {
    console.log('Table elena_conversas already exists!');
    return;
  }

  console.log('Table not found (status:', check.status, '), need to create it manually in Supabase Dashboard.');
  console.log('');
  console.log('Run this SQL in Supabase SQL Editor:');
  console.log('='.repeat(60));
  console.log(fs.readFileSync('./supabase/migrations/005_elena_historico.sql', 'utf8'));
}

main().catch(console.error);

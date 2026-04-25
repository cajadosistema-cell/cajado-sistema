const https = require('https');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (k) => { const m = env.match(new RegExp(`^${k}=(.+)$`, 'm')); return m ? m[1].trim() : ''; };
const URL_BASE = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

function req(path) {
  return new Promise((res, rej) => {
    const u = new URL(URL_BASE + path);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
    }, (resp) => {
      let b = ''; resp.on('data', c => b += c);
      resp.on('end', () => { try { res({ status: resp.statusCode, body: JSON.parse(b) }); } catch { res({ status: resp.statusCode, body: b }); } });
    });
    r.on('error', rej); r.end();
  });
}

async function main() {
  const cats = await req('/rest/v1/categorias_financeiras?limit=20&select=id,nome,tipo');
  console.log('categorias_financeiras:', JSON.stringify(cats.body, null, 2));
}
main().catch(console.error);

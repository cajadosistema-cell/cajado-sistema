const https = require('https');

// Read .env.local
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
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '[]') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== 1. Checking agenda_eventos table (last 10 records) ===');
  const all = await supabaseReq('GET', '/rest/v1/agenda_eventos?select=*&order=created_at.desc&limit=10');
  console.log('Status:', all.status);
  console.log('Records:', JSON.stringify(all.body, null, 2));

  console.log('\n=== 2. Testing INSERT directly ===');
  const ins = await supabaseReq('POST', '/rest/v1/agenda_eventos', {
    user_id: '00000000-0000-0000-0000-000000000001', // placeholder
    titulo: 'Teste direto do script',
    tipo: 'compromisso',
    data_inicio: new Date(Date.now() + 86400000).toISOString(),
    data_fim: null,
    dia_inteiro: false,
    status: 'pendente',
    prioridade: 'normal',
    cor: '#3b82f6',
    origem: 'ia',
  });
  console.log('Insert Status:', ins.status);
  console.log('Insert Result:', JSON.stringify(ins.body, null, 2));
}

main().catch(console.error);

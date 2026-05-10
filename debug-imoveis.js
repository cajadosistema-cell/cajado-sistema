const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => { const m = env.match(new RegExp(`^${key}=(.+)$`, 'm')); return m ? m[1].trim() : ''; };

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY  = getEnv('SUPABASE_SERVICE_ROLE_KEY');

function req(path, body, method = 'GET') {
  return new Promise((res, rej) => {
    const u = new URL(SUPABASE_URL + path);
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: {
        'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
        ...(data && { 'Content-Length': Buffer.byteLength(data) })
      }
    }, resp => {
      let b = ''; resp.on('data', c => b += c);
      resp.on('end', () => { try { res({ s: resp.statusCode, b: JSON.parse(b || '[]') }); } catch { res({ s: resp.statusCode, b }); } });
    });
    r.on('error', rej); if (data) r.write(data); r.end();
  });
}

async function main() {
  console.log('\n=== DIAGNÓSTICO IMÓVEIS ===\n');

  // 1. Verifica empresas existentes
  const empresas = await req('/rest/v1/empresas?select=id,nome,plano&limit=10');
  console.log('📊 Empresas no banco:', JSON.stringify(empresas.b, null, 2));

  // 2. Verifica perfis e seus empresa_id
  const perfis = await req('/rest/v1/perfis?select=id,nome,email,empresa_id,role&limit=10');
  console.log('\n👤 Perfis cadastrados:', JSON.stringify(perfis.b, null, 2));

  // 3. Verifica o que está na tabela imoveis (com service role = sem RLS)
  const imoveis = await req('/rest/v1/imoveis?select=id,titulo,empresa_id&limit=10');
  console.log('\n🏠 Imóveis salvos (SEM RLS - service role):', JSON.stringify(imoveis.b, null, 2));
  console.log('\n→ Status HTTP:', imoveis.s);

  // 4. Verifica se a tabela imoveis tem a coluna empresa_id
  const cols = await req('/rest/v1/imoveis?select=*&limit=0');
  console.log('\n📋 Status tabela imoveis:', cols.s);

  console.log('\n=== FIM DIAGNÓSTICO ===\n');
  console.log('💡 Se "Imóveis salvos" mostrar dados mas o sistema não mostrar,');
  console.log('   o problema é na RLS (SELECT bloqueado).');
  console.log('💡 Se "Imóveis salvos" estiver vazio, o INSERT está falhando silenciosamente.');
}

main().catch(console.error);

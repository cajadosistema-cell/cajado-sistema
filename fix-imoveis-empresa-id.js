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
      resp.on('end', () => { try { res({ s: resp.statusCode, b: JSON.parse(b || '{}') }); } catch { res({ s: resp.statusCode, b }); } });
    });
    r.on('error', rej); if (data) r.write(data); r.end();
  });
}

async function main() {
  // Descobrimos que a FK aponta para perfis.id, não empresas.id
  // Os IDs de perfis que existem são:
  // max@cajado.com => d7f70a0c-19ed-4301-8541-bc3f097e97f3  (empresa Cajado)
  // carlos@cajado.com => 1040cde7-f51a-45b3-945d-c1ecaed8f5b6 (empresa Cajado Admin)

  // Vamos testar com o ID do perfil do max (empresa Cajado = 658ed627)
  const maxPerfilId = 'd7f70a0c-19ed-4301-8541-bc3f097e97f3';
  const cajadoAdminPerfilId = '1040cde7-f51a-45b3-945d-c1ecaed8f5b6';

  // Testa se a FK é para perfis.id ou para empresas.id
  console.log('🔍 Testando FK com perfil ID do max (d7f70a0c)...');
  const test1 = await req(
    '/rest/v1/imoveis?id=eq.291af16b-0817-4cfb-a7b1-890f568364a4',
    { empresa_id: maxPerfilId },
    'PATCH'
  );
  console.log('Resultado (perfil max):', test1.s, JSON.stringify(test1.b, null, 2));

  if (test1.s === 200 || test1.s === 204) {
    console.log('\n✅ A FK aponta para perfis.id (ID do usuário)!');
    console.log('Corrigindo todos os imóveis com empresa_id=null para max@cajado.com...');

    const fix = await req(
      '/rest/v1/imoveis?empresa_id=is.null',
      { empresa_id: maxPerfilId },
      'PATCH'
    );
    console.log('Fix todos:', fix.s, JSON.stringify(fix.b).substring(0, 200));
  } else {
    console.log('\n❌ Não é perfis.id. Vamos ver a estrutura da tabela imoveis:');
    // Tenta inserir um registro de teste para ver qual campo é aceito
    const schema = await req('/rest/v1/imoveis?select=*&limit=1&empresa_id=not.is.null');
    console.log('Schema query:', schema.s, JSON.stringify(schema.b));
  }

  // Mostra resultado final
  const depois = await req('/rest/v1/imoveis?select=id,titulo,empresa_id&limit=5');
  console.log('\n🏠 Imóveis após fix:', JSON.stringify(depois.b, null, 2));
}

main().catch(console.error);

// Verifica estado ao vivo do servidor Railway
const crypto = require('crypto');

const EMPRESA_VISIOPRO = '9cb2f597-367d-4475-b307-43345b09dee8';
const INBOX_URL = 'https://scintillating-freedom-production.up.railway.app';

function gerarToken(empresaId, email, secret = 'cajado-jwt-secret-2025-troque-em-producao') {
  const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeBase64Url({
    id: 'test', email, role: 'admin', setor: 'todos', empresa_id: empresaId,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600
  });
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

async function run() {
  const token = gerarToken(EMPRESA_VISIOPRO, 'admin@visiopro.com');

  // 1. Health do servidor
  console.log('=== HEALTH DO SERVIDOR ===');
  const health = await fetch(`${INBOX_URL}/health`);
  const h = await health.json();
  console.log('Versão:', h.versao);
  console.log('Uptime:', h.uptime);
  console.log('Supabase:', h.supabase ? '✅' : '❌');

  // 2. Status (mostra canais em memória)
  console.log('\n=== STATUS COM TOKEN ===');
  const status = await fetch(`${INBOX_URL}/api/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (status.ok) {
    const s = await status.json();
    console.log(JSON.stringify(s, null, 2));
  } else {
    console.log('Status:', status.status, await status.text());
  }

  // 3. Debug inbox (mostra canaisMemoria)
  console.log('\n=== DEBUG INBOX (canais em memória) ===');
  const debug = await fetch(`${INBOX_URL}/debug/inbox`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (debug.ok) {
    const d = await debug.json();
    console.log('Admin empresa_id:', d.adminDefault);
    console.log('Super admin?', d.isSuperAdmin);
    console.log('Conversas em memória:', d.conversasMemoria?.length);
    console.log('\n--- CANAIS (Evolution/WABA) ---');
    for (const c of (d.canaisMemoria || [])) {
      console.log(`  - Canal: ${c.instance_name || 'Desconhecido'} | Empresa: ${c.empresa_id}`);
    }
    console.log('\n--- FIM CANAIS ---');
    for (const c of (d.conversasMemoria || [])) {
      console.log(`  - ${c.nome} (${c.numero}) | empresa: ${c.empresa_id} | msgs: ${c.msgs}`);
    }
    console.log('Conversas no Supabase:', d.conversasSupabase?.length);
  } else {
    console.log('Debug status:', debug.status, await debug.text());
  }

  // 4. Conversas disponíveis
  console.log('\n=== CONVERSAS DISPONÍVEIS ===');
  const conv = await fetch(`${INBOX_URL}/inbox/conversas`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (conv.ok) {
    const c = await conv.json();
    console.log(`Total: ${c.length} conversas`);
    for (const item of c) {
      console.log(`  - ${item.nome} (${item.numero}) | última: "${item.ultimaMensagem?.slice(0,40)}" | unread: ${item.unread}`);
    }
  } else {
    console.log('Conversas status:', conv.status, await conv.text());
  }
}

run();

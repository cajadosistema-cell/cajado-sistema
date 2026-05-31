// Migra as conversas da instância "maiara" para a empresa correta (VisioPro admin)
const { createClient } = require('@supabase/supabase-js');

const EMPRESA_VISIOPRO = '9cb2f597-367d-4475-b307-43345b09dee8'; // admin@visiopro.com
const EMPRESA_CAJADO   = '658ed627-c84e-46c0-a9d2-83c4a1b66bca'; // max@cajado.com
const EMPRESA_ANTIGA   = '15860bf2-cd65-46c1-bb13-dff6018255a1'; // empresa antiga

const inbox = createClient(
  'https://agwgaxahgmeacfjfjoid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM1MzAwOCwiZXhwIjoyMDg4OTI5MDA4fQ.SwxKjWDUTGIEkbFF08-m80FLVNghgYgmK1aQ2Hr3tWM'
);

async function run() {
  // 1. Busca todas as conversas
  const { data: conversas } = await inbox.from('whatsapp_conversas').select('numero, empresa_id, dados');
  
  console.log('=== PLANO DE MIGRAÇÃO ===');
  
  for (const c of (conversas || [])) {
    const canal = c.dados?.canal || c.dados?.phone_number_id || 'evolution';
    const instanceName = c.dados?.instanceName || c.dados?.instance || '';
    const numero = c.numero;
    
    // Conversas da instância maiara → empresa VisioPro (admin@visiopro.com)
    // Conversas da vp_cajado_01 → empresa Cajado (max@cajado.com)
    
    // Como identificar? Pelo número ou pelo instanceName salvo
    // Por enquanto: conversas antigas com empresa_antiga → mover para VisioPro (são testes)
    
    if (c.empresa_id === EMPRESA_ANTIGA) {
      console.log(`Migrar ${c.numero} (${c.empresa_id}) → VisioPro`);
      await inbox.from('whatsapp_conversas')
        .update({ empresa_id: EMPRESA_VISIOPRO })
        .eq('numero', numero)
        .eq('empresa_id', EMPRESA_ANTIGA);
    }
  }
  
  console.log('\n=== ESTADO FINAL ===');
  const { data: final } = await inbox.from('whatsapp_conversas').select('numero, empresa_id, dados');
  for (const c of (final || [])) {
    const empresa = c.empresa_id === EMPRESA_CAJADO ? 'Cajado(max)' :
                    c.empresa_id === EMPRESA_VISIOPRO ? 'VisioPro(admin)' : c.empresa_id?.slice(0,8);
    console.log(` - ${c.dados?.nome || c.numero} → ${empresa}`);
  }
  
  // 2. Testa o endpoint de conversas com o token correto
  console.log('\n=== TESTANDO ENDPOINT DE CONVERSAS ===');
  const crypto = require('crypto');
  
  function gerarToken(empresaId, email) {
    const secret = 'cajado-jwt-secret-2025-troque-em-producao';
    const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
    const payload = encodeBase64Url({
      id: 'test', email, role: 'admin', setor: 'todos', empresa_id: empresaId,
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600
    });
    const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
  }
  
  const tokenAdmin = gerarToken(EMPRESA_VISIOPRO, 'admin@visiopro.com');
  const res = await fetch('https://scintillating-freedom-production.up.railway.app/inbox/conversas', {
    headers: { Authorization: `Bearer ${tokenAdmin}` }
  });
  const data = await res.json();
  console.log(`admin@visiopro.com vê ${data.length} conversas:`);
  for (const c of data) console.log(`  - ${c.nome} (${c.numero})`);
}

run();

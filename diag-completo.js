// Diagnóstico completo do fluxo de mensagens
// Testa JWT, autenticação e se conversas aparecem no backend

const INBOX_URL = 'https://scintillating-freedom-production.up.railway.app';

// Simula exatamente o que o Cajado faz ao gerar um token
function gerarToken(empresaId, email, secret) {
  const crypto = require('crypto');
  const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeBase64Url({
    id: 'test-id',
    email,
    role: 'admin',
    setor: 'todos',
    empresa_id: empresaId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  });
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

async function testar() {
  const EMPRESA_VISIOPRO = '9cb2f597-367d-4475-b307-43345b09dee8';
  
  // Testa com DOIS secrets diferentes para ver qual o backend aceita
  const secrets = [
    'visiopro-jwt-secret-2025-troque-em-producao',
    'cajado-jwt-secret-2025-troque-em-producao',
    'visiopro-secret-2025'
  ];

  for (const secret of secrets) {
    const token = gerarToken(EMPRESA_VISIOPRO, 'admin@visiopro.com', secret);
    
    try {
      const res = await fetch(`${INBOX_URL}/inbox/conversas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const body = await res.text();
      console.log(`\nSecret "${secret.slice(0,20)}...": Status ${res.status}`);
      if (res.status === 200) {
        console.log('✅ JWT ACEITO! Conversas:', body.slice(0, 200));
      } else if (res.status === 401) {
        console.log('❌ JWT REJEITADO');
      } else {
        console.log('Resposta:', body.slice(0, 100));
      }
    } catch(e) {
      console.error('Erro:', e.message);
    }
  }

  // Também testa sem token para ver se o endpoint existe
  console.log('\n--- Sem token ---');
  const semToken = await fetch(`${INBOX_URL}/inbox/conversas`);
  console.log('Status sem token:', semToken.status);
  
  // Testa envio de mensagem
  console.log('\n--- Testando webhook direto ---');
  const wh = await fetch(`${INBOX_URL}/webhook/evolution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: "messages.upsert",
      instance: "maiara",
      data: {
        key: { id: "DIAG-" + Date.now(), remoteJid: "5521999887766@s.whatsapp.net", fromMe: false },
        pushName: "Diagnostico Teste",
        message: { conversation: "Mensagem de diagnóstico - " + new Date().toLocaleTimeString() }
      }
    })
  });
  console.log('Webhook status:', wh.status, await wh.text());
}

testar();

// Testa se o servidor está recebendo e processando webhooks da instância maiara
// Simula exatamente o payload que o Evolution API v2 envia

async function testarWebhook() {
  const url = 'https://scintillating-freedom-production.up.railway.app/webhook/evolution';
  
  // Payload exatamente como o Evolution API v2 envia
  const payload = {
    event: "messages.upsert",
    instance: "maiara",
    data: {
      key: {
        remoteJid: "5521999887766@s.whatsapp.net",
        fromMe: false,
        id: "REAL-TEST-" + Date.now()
      },
      pushName: "Cliente Teste Real",
      message: {
        conversation: "Olá, quero saber sobre os produtos!"
      },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
      instanceId: "maiara",
      source: "android"
    }
  };

  console.log('Enviando webhook de teste (formato Evolution v2)...');
  console.log('URL:', url);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log('\nResposta do servidor:', res.status, text);
    
    if (res.status === 200) {
      console.log('\n✅ Servidor recebeu o webhook!');
      console.log('Aguarde 3 segundos e verifique o Cajado Inbox...');
    }
  } catch(e) {
    console.error('Erro:', e.message);
  }
  
  // Também testar endpoint de conversas
  console.log('\n=== VERIFICANDO CONVERSAS NO BACKEND ===');
  try {
    const convRes = await fetch('https://scintillating-freedom-production.up.railway.app/conversas', {
      headers: {
        'Authorization': 'Bearer INBOX_TEST'
      }
    });
    console.log('Status /conversas:', convRes.status);
    const convText = await convRes.text();
    console.log('Resposta:', convText.slice(0, 300));
  } catch(e) {
    console.error('Erro ao buscar conversas:', e.message);
  }
}

testarWebhook();

// Script para verificar e corrigir o canal maiara no Supabase cajado
// e também testar se o webhook está sendo recebido
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
);

async function run() {
  // 1. Mostra todos os canais Evolution ativos
  console.log('=== CANAIS EVOLUTION NO BANCO ===');
  const { data: canais } = await supabase
    .from('canais')
    .select('*')
    .eq('tipo', 'evolution');

  for (const c of canais || []) {
    console.log(`ID: ${c.id}`);
    console.log(`Nome: ${c.nome}`);
    console.log(`Status: ${c.status}`);
    console.log(`Instância: ${c.dados_conexao?.instance_name}`);
    console.log(`Webhook OK: ${c.dados_conexao?.webhook_ok}`);
    console.log(`Webhook URL: ${c.dados_conexao?.webhook_url}`);
    console.log(`Empresa: ${c.empresa_id}`);
    console.log('---');
  }
  
  // 2. Pega a instância maiara
  const maiara = (canais || []).find(c => c.dados_conexao?.instance_name === 'maiara');
  
  if (maiara) {
    console.log('\n=== CORRIGINDO CANAL MAIARA ===');
    const novoDados = {
      ...maiara.dados_conexao,
      webhook_url: 'https://scintillating-freedom-production.up.railway.app/webhook/evolution',
      webhook_ok: true,
      ativo: true,
    };
    
    const { error } = await supabase
      .from('canais')
      .update({ 
        status: 'conectado',
        dados_conexao: novoDados
      })
      .eq('id', maiara.id);
      
    if (error) {
      console.error('Erro ao atualizar:', error);
    } else {
      console.log('Canal maiara atualizado com webhook URL correto!');
      console.log('Novo webhook_url:', novoDados.webhook_url);
    }
  } else {
    console.log('Canal maiara não encontrado!');
  }
  
  // 3. Verificar se o servidor está recebendo
  console.log('\n=== TESTANDO WEBHOOK ===');
  const testPayload = JSON.stringify({
    event: "messages.upsert",
    instance: "maiara",
    data: {
      key: { id: "TEST-" + Date.now(), remoteJid: "5511999999999@s.whatsapp.net", fromMe: false },
      message: { conversation: "Teste de webhook - pode ignorar" },
      pushName: "Teste Sistema"
    }
  });
  
  try {
    const res = await fetch('https://scintillating-freedom-production.up.railway.app/webhook/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: testPayload
    });
    console.log('Resposta do webhook:', res.status, await res.text());
    if (res.status === 200) {
      console.log('✅ Webhook respondendo! O servidor está recebendo mensagens.');
    } else {
      console.log('❌ Webhook retornou erro');
    }
  } catch (e) {
    console.error('Erro ao testar webhook:', e.message);
  }
}

run();

// Verificar e criar canal maiara no banco do INBOX (que o backend usa)
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://agwgaxahgmeacfjfjoid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM1MzAwOCwiZXhwIjoyMDg4OTI5MDA4fQ.SwxKjWDUTGIEkbFF08-m80FLVNghgYgmK1aQ2Hr3tWM'
);

async function run() {
  console.log('=== VERIFICANDO BANCO DO INBOX ===\n');
  
  // 1. Listar empresas
  const { data: empresas } = await supabase.from('empresas').select('id, nome, email_admin').limit(5);
  console.log('Empresas no banco do Inbox:');
  for (const e of (empresas || [])) {
    console.log(` - ${e.nome} | ${e.email_admin} | ID: ${e.id}`);
  }
  
  // 2. Listar canais evolution
  const { data: canais } = await supabase.from('canais').select('*').eq('tipo', 'evolution');
  console.log('\nCanais Evolution no banco do Inbox:');
  for (const c of (canais || [])) {
    console.log(` - ${c.nome} | instância: ${c.dados_conexao?.instance_name} | empresa: ${c.empresa_id}`);
  }
  
  if (!canais || canais.length === 0) {
    console.log('Nenhum canal Evolution no banco do Inbox!');
  }
  
  // 3. Verificar tabela whatsapp_conversas (que o backend usa)
  const { data: tabelas } = await supabase
    .rpc('pg_catalog.pg_tables', {})
    .catch(() => ({ data: null }));
  
  // Checar se maiara existe nos canais
  const temMaiara = (canais || []).some(c => c.dados_conexao?.instance_name === 'maiara');
  console.log(`\n=> Canal 'maiara' no banco do Inbox: ${temMaiara ? 'SIM ✅' : 'NÃO ❌'}`);
  
  if (!temMaiara) {
    console.log('\n=== CRIANDO CANAL MAIARA NO BANCO DO INBOX ===');
    
    // Pega a empresa do admin
    const adminEmail = 'admin@visiopro.com';
    const { data: admin } = await supabase.from('usuarios')
      .select('empresa_id').eq('email', adminEmail).single();
    
    let empresaId = admin?.empresa_id;
    if (!empresaId && empresas?.length > 0) {
      empresaId = empresas[0].id;
    }
    
    if (!empresaId) {
      console.error('Não foi possível determinar empresa_id!');
      return;
    }
    
    console.log(`Usando empresa_id: ${empresaId}`);
    
    const { error } = await supabase.from('canais').insert({
      empresa_id: empresaId,
      nome: 'WhatsApp Principal',
      tipo: 'evolution',
      status: 'conectado',
      dados_conexao: {
        instance_name: 'maiara',
        webhook_url: 'https://scintillating-freedom-production.up.railway.app/webhook/evolution',
        webhook_ok: true,
        ativo: true,
      }
    });
    
    if (error) {
      console.error('Erro ao criar canal:', error.message);
    } else {
      console.log('✅ Canal maiara criado no banco do Inbox!');
      console.log('O servidor vai reconhecê-lo automaticamente ao reiniciar.');
    }
  }
}

run();

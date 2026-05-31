// Verifica o estado atual do banco do Inbox para debug do boot
const { createClient } = require('@supabase/supabase-js');

const inbox = createClient(
  'https://agwgaxahgmeacfjfjoid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM1MzAwOCwiZXhwIjoyMDg4OTI5MDA4fQ.SwxKjWDUTGIEkbFF08-m80FLVNghgYgmK1aQ2Hr3tWM'
);

async function run() {
  // 1. Usuário admin@visiopro.com
  console.log('=== USUÁRIO admin@visiopro.com NO BANCO DO INBOX ===');
  const { data: admin } = await inbox.from('usuarios').select('*').eq('email', 'admin@visiopro.com').single();
  console.log(JSON.stringify(admin, null, 2));

  // 2. Canais evolution (como o boot os vê)
  console.log('\n=== CANAIS NO BANCO (como boot carrega) ===');
  const { data: canais } = await inbox.from('canais').select('*');
  for (const c of (canais || [])) {
    const idx = c.tipo === 'evolution'
      ? c.dados_conexao?.instance_name
      : c.dados_conexao?.phone_number_id;
    console.log(`\nCanal: ${c.nome}`);
    console.log(`  tipo: ${c.tipo}`);
    console.log(`  instance_name: ${c.dados_conexao?.instance_name}`);
    console.log(`  idx (chave na memória): ${idx}`);
    console.log(`  empresa_id: ${c.empresa_id}`);
  }

  // 3. Empresas (ordem como aparecem no banco - fallback do boot)
  console.log('\n=== EMPRESAS (primeira = fallback do boot) ===');
  const { data: empresas } = await inbox.from('empresas').select('id, nome').limit(5);
  empresas?.forEach((e, i) => console.log(`${i+1}. ${e.nome} | ${e.id}`));
}

run();

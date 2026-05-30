// Atualiza o admin no banco do Inbox agora que a empresa existe
const { createClient } = require('@supabase/supabase-js');

const CAJADO_EMPRESA_ADMIN = '9cb2f597-367d-4475-b307-43345b09dee8';

const inbox = createClient(
  'https://agwgaxahgmeacfjfjoid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM1MzAwOCwiZXhwIjoyMDg4OTI5MDA4fQ.SwxKjWDUTGIEkbFF08-m80FLVNghgYgmK1aQ2Hr3tWM'
);

async function run() {
  // 1. Atualizar admin@visiopro.com
  console.log('Atualizando admin@visiopro.com...');
  const { error: e1 } = await inbox.from('usuarios')
    .update({ empresa_id: CAJADO_EMPRESA_ADMIN })
    .eq('email', 'admin@visiopro.com');
  if (e1) console.error('Erro:', e1.message);
  else console.log('✅ admin@visiopro.com atualizado!');

  // 2. Estado final
  console.log('\n=== ESTADO FINAL ===');
  const { data: usuarios } = await inbox.from('usuarios').select('email, empresa_id, role').limit(5);
  for (const u of (usuarios || [])) console.log(` - ${u.email} | ${u.empresa_id} | ${u.role}`);

  const { data: canais } = await inbox.from('canais').select('nome, dados_conexao, empresa_id, status').eq('tipo', 'evolution');
  console.log('\nCanais:');
  for (const c of (canais || [])) console.log(` - ${c.nome} | instância: ${c.dados_conexao?.instance_name} | empresa: ${c.empresa_id} | status: ${c.status}`);

  // 3. Fazer push para o Railway redeploiar
  console.log('\n✅ Banco sincronizado! Agora faça o redeploy no Railway.');
}

run();

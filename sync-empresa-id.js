// Sincroniza empresa_id entre Cajado e Inbox
// Estratégia: atualiza o admin@visiopro.com no banco do Inbox para usar o mesmo empresa_id do Cajado
// E atualiza o canal maiara para usar o empresa_id do Cajado

const { createClient } = require('@supabase/supabase-js');

const CAJADO_EMPRESA_ADMIN = '9cb2f597-367d-4475-b307-43345b09dee8';  // empresa_id no Cajado
const INBOX_EMPRESA_ATUAL  = '15860bf2-cd65-46c1-bb13-dff6018255a1'; // empresa_id atual no Inbox

const inbox = createClient(
  'https://agwgaxahgmeacfjfjoid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM1MzAwOCwiZXhwIjoyMDg4OTI5MDA4fQ.SwxKjWDUTGIEkbFF08-m80FLVNghgYgmK1aQ2Hr3tWM'
);

async function run() {
  console.log('Sincronizando empresa_id entre Cajado e Inbox...\n');

  // 1. Atualizar usuário admin no Inbox para usar o empresa_id do Cajado
  console.log('1. Atualizando admin@visiopro.com no banco do Inbox...');
  const { error: errUser } = await inbox.from('usuarios')
    .update({ empresa_id: CAJADO_EMPRESA_ADMIN })
    .eq('email', 'admin@visiopro.com');
  if (errUser) console.error('Erro ao atualizar usuario:', errUser.message);
  else console.log(`   ✅ Usuario atualizado para empresa_id: ${CAJADO_EMPRESA_ADMIN}`);

  // 2. Verificar se existe empresa com o ID do Cajado no Inbox (para não quebrar FK)
  console.log('\n2. Verificando se empresa existe no banco Inbox...');
  const { data: emp } = await inbox.from('empresas').select('id').eq('id', CAJADO_EMPRESA_ADMIN).single();
  
  if (!emp) {
    console.log('   Empresa não existe no Inbox. Criando...');
    const { error: errEmp } = await inbox.from('empresas').insert({
      id: CAJADO_EMPRESA_ADMIN,
      nome: 'Cajado Soluções',
      status: 'ativo',
      plano_tipo: 'enterprise'
    });
    if (errEmp) console.error('   Erro ao criar empresa:', errEmp.message);
    else console.log('   ✅ Empresa criada!');
  } else {
    console.log('   ✅ Empresa já existe!');
  }

  // 3. Atualizar canal maiara para usar empresa_id do Cajado
  console.log('\n3. Atualizando canal maiara para usar empresa_id do Cajado...');
  const { error: errCanal } = await inbox.from('canais')
    .update({ empresa_id: CAJADO_EMPRESA_ADMIN })
    .eq('dados_conexao->>instance_name', 'maiara');
  if (errCanal) {
    // Tenta o update com outra abordagem
    const { data: canais } = await inbox.from('canais').select('id, dados_conexao').eq('tipo', 'evolution');
    for (const c of (canais || [])) {
      if (c.dados_conexao?.instance_name === 'maiara') {
        const { error: e2 } = await inbox.from('canais').update({ empresa_id: CAJADO_EMPRESA_ADMIN }).eq('id', c.id);
        if (e2) console.error('   Erro ao atualizar canal:', e2.message);
        else console.log(`   ✅ Canal maiara (${c.id}) atualizado!`);
      }
    }
  } else {
    console.log('   ✅ Canal maiara atualizado!');
  }

  // 4. Também atualizar whatsapp_conversas existentes (se houver)
  console.log('\n4. Atualizando conversas existentes...');
  const { error: errConv } = await inbox.from('whatsapp_conversas')
    .update({ empresa_id: CAJADO_EMPRESA_ADMIN })
    .eq('empresa_id', INBOX_EMPRESA_ATUAL);
  if (errConv) console.error('   Erro ao atualizar conversas:', errConv.message);
  else console.log('   ✅ Conversas atualizadas!');

  console.log('\n✅ Sincronização completa!');
  console.log('O Cajado Inbox vai reconhecer as mensagens após o próximo redeploy do servidor.');
}

run();

// Corrige o isolamento multi-empresa no banco do Inbox
// - maiara → empresa 9cb2f597 (VisioPro / admin@visiopro.com)
// - vp_cajado_01 → empresa 658ed627 (Cajado / max@cajado.com)

const { createClient } = require('@supabase/supabase-js');

const EMPRESA_VISIOPRO = '9cb2f597-367d-4475-b307-43345b09dee8';  // admin@visiopro.com
const EMPRESA_CAJADO   = '658ed627-c84e-46c0-a9d2-83c4a1b66bca';  // max@cajado.com

const inbox = createClient(
  'https://agwgaxahgmeacfjfjoid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM1MzAwOCwiZXhwIjoyMDg4OTI5MDA4fQ.SwxKjWDUTGIEkbFF08-m80FLVNghgYgmK1aQ2Hr3tWM'
);

async function run() {
  console.log('=== CORRIGINDO ISOLAMENTO MULTI-EMPRESA ===\n');

  // 1. Garantir que a empresa Cajado existe no banco do Inbox
  console.log('1. Verificando empresa Cajado no banco do Inbox...');
  const { data: empCajado } = await inbox.from('empresas').select('id').eq('id', EMPRESA_CAJADO).single();
  if (!empCajado) {
    const { error } = await inbox.from('empresas').insert({
      id: EMPRESA_CAJADO,
      nome: 'Cajado',
      status: 'ativo',
      plano_tipo: 'enterprise'
    });
    if (error) console.error('   Erro ao criar empresa Cajado:', error.message);
    else console.log('   ✅ Empresa Cajado criada!');
  } else {
    console.log('   ✅ Empresa Cajado já existe!');
  }

  // 2. Adicionar max@cajado.com no banco do Inbox
  console.log('\n2. Adicionando max@cajado.com no banco do Inbox...');
  const { data: maxExiste } = await inbox.from('usuarios').select('id').eq('email', 'max@cajado.com').single();
  if (!maxExiste) {
    const { error } = await inbox.from('usuarios').insert({
      email: 'max@cajado.com',
      nome: 'Sr. Max',
      senha: '$2b$10$placeholderHashDoNotUse',  // não usado, login é via Supabase Auth
      empresa_id: EMPRESA_CAJADO,
      role: 'admin',
      ativo: true,
      setor: 'todos'
    });
    if (error) console.error('   Erro ao criar max@cajado.com:', error.message);
    else console.log('   ✅ max@cajado.com criado na empresa Cajado!');
  } else {
    // Atualiza empresa_id caso esteja errado
    await inbox.from('usuarios').update({ empresa_id: EMPRESA_CAJADO }).eq('email', 'max@cajado.com');
    console.log('   ✅ max@cajado.com atualizado com empresa Cajado!');
  }

  // 3. Corrigir canal vp_cajado_01 para empresa Cajado
  console.log('\n3. Corrigindo canal vp_cajado_01 para empresa Cajado...');
  const { data: canais } = await inbox.from('canais').select('id, nome, dados_conexao, empresa_id');
  for (const c of (canais || [])) {
    const inst = c.dados_conexao?.instance_name;
    if (inst === 'vp_cajado_01' || inst === 'vvisiopro') {
      const { error } = await inbox.from('canais').update({ empresa_id: EMPRESA_CAJADO }).eq('id', c.id);
      if (error) console.error(`   Erro ao atualizar ${inst}:`, error.message);
      else console.log(`   ✅ Canal ${inst} → empresa Cajado`);
    }
    if (inst === 'maiara') {
      const { error } = await inbox.from('canais').update({ empresa_id: EMPRESA_VISIOPRO }).eq('id', c.id);
      if (error) console.error(`   Erro ao atualizar ${inst}:`, error.message);
      else console.log(`   ✅ Canal maiara → empresa VisioPro`);
    }
  }

  // 4. Corrigir conversas salvas com empresa errada
  console.log('\n4. Corrigindo conversas existentes...');
  // Conversas da vp_cajado_01 → para Cajado
  const { error: e1 } = await inbox.from('whatsapp_conversas')
    .update({ empresa_id: EMPRESA_CAJADO })
    .eq('empresa_id', '15860bf2-cd65-46c1-bb13-dff6018255a1');
  if (!e1) console.log('   ✅ Conversas antigas migradas para empresa Cajado');

  // 5. Estado final
  console.log('\n=== ESTADO FINAL ===');
  const { data: resultado } = await inbox.from('canais').select('nome, dados_conexao, empresa_id, status');
  for (const c of (resultado || [])) {
    const empresa = c.empresa_id === EMPRESA_CAJADO ? 'Cajado (max)' : c.empresa_id === EMPRESA_VISIOPRO ? 'VisioPro (admin)' : c.empresa_id;
    console.log(` - ${c.dados_conexao?.instance_name || c.nome} → ${empresa} | ${c.status}`);
  }

  console.log('\n✅ Isolamento multi-empresa configurado!');
  console.log('\nAgora:');
  console.log('  admin@visiopro.com → vê apenas conversas da instância "maiara"');
  console.log('  max@cajado.com     → vê apenas conversas da instância "vp_cajado_01"');
}

run();

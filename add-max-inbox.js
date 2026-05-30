// Adiciona max@cajado.com com UUID gerado no banco do Inbox
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const EMPRESA_CAJADO = '658ed627-c84e-46c0-a9d2-83c4a1b66bca';

const inbox = createClient(
  'https://agwgaxahgmeacfjfjoid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM1MzAwOCwiZXhwIjoyMDg4OTI5MDA4fQ.SwxKjWDUTGIEkbFF08-m80FLVNghgYgmK1aQ2Hr3tWM'
);

async function run() {
  // Verifica se já existe
  const { data: existente } = await inbox.from('usuarios').select('id, email, empresa_id').eq('email', 'max@cajado.com').single();
  
  if (existente) {
    console.log('Usuário max@cajado.com já existe:', existente);
    // Garante empresa correta
    if (existente.empresa_id !== EMPRESA_CAJADO) {
      await inbox.from('usuarios').update({ empresa_id: EMPRESA_CAJADO }).eq('email', 'max@cajado.com');
      console.log('✅ empresa_id atualizado para Cajado');
    } else {
      console.log('✅ empresa_id já está correto');
    }
    return;
  }

  // Cria com UUID explícito
  const novoId = crypto.randomUUID();
  const { error } = await inbox.from('usuarios').insert({
    id: novoId,
    email: 'max@cajado.com',
    nome: 'Sr. Max',
    senha: 'sync-via-supabase-auth',
    empresa_id: EMPRESA_CAJADO,
    role: 'admin',
    ativo: true,
    setor: 'todos'
  });

  if (error) {
    console.error('Erro ao criar max@cajado.com:', error.message);
    // Verifica estrutura da tabela
    const { data: sample } = await inbox.from('usuarios').select('*').limit(1);
    console.log('Estrutura de um usuário existente:', JSON.stringify(sample?.[0] || {}, null, 2));
  } else {
    console.log(`✅ max@cajado.com criado com ID ${novoId} na empresa Cajado`);
  }
}

run();

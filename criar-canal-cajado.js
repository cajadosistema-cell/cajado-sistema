const { createClient } = require('@supabase/supabase-js');

// IMPORTANTE: Preencha com a SUPABASE_SERVICE_ROLE_KEY do Cajado (gwergvhvujsybkiqrhlo)
const supabase = createClient(
  'https://gwergvhvujsybkiqrhlo.supabase.co',
  'COLOQUE_A_SERVICE_ROLE_KEY_AQUI'
);

async function run() {
  // ID da empresa Cajado
  const empresaId = '658ed627-c84e-46c0-a9d2-83c4a1b66bca';

  console.log('Criando canal vp_cajado_01 no banco da Cajado...');
  const { data, error } = await supabase.from('canais').insert({
    empresa_id: empresaId,
    nome: 'Cajado Evolution (vp_cajado_01)',
    tipo: 'evolution',
    status: 'conectado',
    dados_conexao: {
      instance_name: 'vp_cajado_01',
      webhook_url: 'https://scintillating-freedom-production.up.railway.app/webhook/evolution',
      webhook_ok: true,
      ativo: true,
    }
  }).select().single();

  if (error) {
    console.error('Erro:', error.message);
  } else {
    console.log('✅ Canal criado com sucesso! ID:', data.id);
    console.log('Agora reinicie o servidor da Cajado no Railway para carregar o canal.');
  }
}

run();

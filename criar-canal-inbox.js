const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://agwgaxahgmeacfjfjoid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM1MzAwOCwiZXhwIjoyMDg4OTI5MDA4fQ.SwxKjWDUTGIEkbFF08-m80FLVNghgYgmK1aQ2Hr3tWM'
);

async function run() {
  // Empresa principal
  const empresaId = '15860bf2-cd65-46c1-bb13-dff6018255a1';

  console.log('Criando canal maiara no banco do Inbox...');
  const { data, error } = await supabase.from('canais').insert({
    empresa_id: empresaId,
    nome: 'WhatsApp Principal (maiara)',
    tipo: 'evolution',
    status: 'conectado',
    dados_conexao: {
      instance_name: 'maiara',
      webhook_url: 'https://scintillating-freedom-production.up.railway.app/webhook/evolution',
      webhook_ok: true,
      ativo: true,
    }
  }).select().single();

  if (error) {
    console.error('Erro:', error.message);
  } else {
    console.log('✅ Canal criado com sucesso! ID:', data.id);
    console.log('Agora reinicie o servidor no Railway para ele carregar o novo canal.');
  }
}

run();

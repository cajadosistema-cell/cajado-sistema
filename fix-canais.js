const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
);

async function run() {
  console.log('Buscando canais...');
  const { data: canais, error } = await supabase.from('canais').select('*').eq('tipo', 'evolution');
  if (error) {
    console.error('Erro ao buscar canais:', error);
    return;
  }
  
  for (const canal of canais) {
    console.log(`\nCanal: ${canal.id} | Status: ${canal.status} | Instância: ${canal.dados_conexao?.instance_name}`);
    
    // Deletar visiopro
    if (canal.dados_conexao?.instance_name === 'visiopro') {
      console.log('=> Deletando instância visiopro quebrada...');
      await supabase.from('canais').delete().eq('id', canal.id);
    }
    
    // Atualizar maiara para conectado
    if (canal.dados_conexao?.instance_name === 'maiara') {
      console.log('=> Atualizando instância maiara para conectado e ativo=true...');
      const novosDados = { ...canal.dados_conexao, ativo: true };
      const { error: errUp } = await supabase.from('canais').update({
        status: 'conectado',
        dados_conexao: novosDados
      }).eq('id', canal.id);
      
      if (errUp) console.error('Erro ao atualizar maiara:', errUp);
      else console.log('=> Atualizado com sucesso!');
    }
  }
  
  console.log('\nPronto!');
}

run();

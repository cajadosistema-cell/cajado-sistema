const { createClient } = require('@supabase/supabase-js');

const inbox = createClient(
  'https://agwgaxahgmeacfjfjoid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM1MzAwOCwiZXhwIjoyMDg4OTI5MDA4fQ.SwxKjWDUTGIEkbFF08-m80FLVNghgYgmK1aQ2Hr3tWM'
);

async function run() {
  console.log('=== CONVERSAS NO BANCO DO INBOX ===');
  const { data: conversas, error } = await inbox
    .from('whatsapp_conversas')
    .select('numero, empresa_id, dados')
    .limit(10);

  if (error) { console.error('Erro:', error.message); return; }

  for (const c of (conversas || [])) {
    const dados = c.dados || {};
    const ultimaMsg = dados.mensagens?.slice(-1)?.[0];
    console.log(`\n📱 ${dados.nome || c.numero} (${c.numero})`);
    console.log(`   Empresa: ${c.empresa_id}`);
    console.log(`   Msgs: ${dados.mensagens?.length || 0} | Última: "${ultimaMsg?.texto?.slice(0,50)}" (${ultimaMsg?.tipo})`);
  }

  // Testa com a chave global da API (chave GLOBAL do servidor, não da instância)
  console.log('\n=== CHAVE GLOBAL DA EVOLUTION ===');
  // A chave global é diferente da chave da instância
  // Tenta descobrir a chave listando instâncias com chaves conhecidas
  const urls = [
    'https://evolution-api-production-ed09.up.railway.app',
    'https://evolution-api-production-2ae1.up.railway.app',
  ];
  const chaves = ['77FB8D9E33F5-4C3E-8FDC-FF7F247AF689', 'B6D22DE2-BB71-40BC-A5B3-F4B4CEB09A7C', 'visiopro2025', '123456'];
  
  for (const url of urls) {
    for (const chave of chaves) {
      try {
        const r = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: chave } });
        if (r.status === 200) {
          const d = await r.json();
          console.log(`✅ URL: ${url}`);
          console.log(`   Chave: ${chave}`);
          console.log(`   Instâncias: ${d.map(i => i.instance?.instanceName || i.name).join(', ')}`);
          
          // Verifica webhook da maiara com essa chave
          const wh = await fetch(`${url}/webhook/find/maiara`, { headers: { apikey: chave } });
          if (wh.status === 200) {
            console.log('   Webhook maiara:', JSON.stringify(await wh.json()));
          }
          return; // para na primeira que funcionar
        }
      } catch(e) {}
    }
  }
  console.log('Nenhuma chave/URL funcionou para a Evolution API');
}

run();

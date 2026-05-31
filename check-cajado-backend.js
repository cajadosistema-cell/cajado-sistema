// Diagnostica e corrige o banco REAL do cajado-backend (gwergvhvujsybkiqrhlo)
// Este é o Supabase que o scintillating-freedom realmente usa

const { createClient } = require('@supabase/supabase-js');

// ESTE é o banco correto do cajado-backend
const cajado = createClient(
  'https://gwergvhvujsybkiqrhlo.supabase.co',
  // Precisamos da service_role key deste banco - usando anon por enquanto
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZXJndmh2dWpzeWJraXFyaGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDEyNTcsImV4cCI6MjA5MDk3NzI1N30.kKinm9rhtb8lP3np-8mjjkXkY1j49RMn04aZn7M_ork'
);

async function run() {
  console.log('=== SUPABASE DO CAJADO-BACKEND (gwergvhvujsybkiqrhlo) ===');
  
  // 1. Usuários
  console.log('\n--- Usuários ---');
  const { data: usuarios, error: eu } = await cajado.from('usuarios').select('email, empresa_id, role, nome');
  if (eu) console.error('Erro usuarios:', eu.message);
  else usuarios?.forEach(u => console.log(`  ${u.email} | empresa: ${u.empresa_id} | role: ${u.role}`));
  
  // 2. Empresas
  console.log('\n--- Empresas ---');
  const { data: empresas, error: ee } = await cajado.from('empresas').select('id, nome');
  if (ee) console.error('Erro empresas:', ee.message);
  else empresas?.forEach(e => console.log(`  ${e.nome} | ${e.id}`));
  
  // 3. Canais
  console.log('\n--- Canais ---');
  const { data: canais, error: ec } = await cajado.from('canais').select('nome, tipo, dados_conexao, empresa_id, status');
  if (ec) console.error('Erro canais:', ec.message);
  else canais?.forEach(c => console.log(`  ${c.nome} | inst: ${c.dados_conexao?.instance_name} | empresa: ${c.empresa_id} | ${c.status}`));
  
  // 4. Conversas recentes
  console.log('\n--- Conversas (últimas 3) ---');
  const { data: convs, error: ecv } = await cajado.from('whatsapp_conversas').select('numero, empresa_id, dados').limit(3);
  if (ecv) console.error('Erro conversas:', ecv.message);
  else convs?.forEach(c => console.log(`  ${c.dados?.nome || c.numero} | empresa: ${c.empresa_id}`));
}

run();

// Verifica empresa_id no banco do Cajado vs banco do Inbox
const { createClient } = require('@supabase/supabase-js');

const cajado = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
);

const inbox = createClient(
  'https://agwgaxahgmeacfjfjoid.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnd2dheGFoZ21lYWNmamZqb2lkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM1MzAwOCwiZXhwIjoyMDg4OTI5MDA4fQ.SwxKjWDUTGIEkbFF08-m80FLVNghgYgmK1aQ2Hr3tWM'
);

async function run() {
  console.log('=== BANCO CAJADO ===');
  const { data: usuariosCajado } = await cajado.from('usuarios').select('id, email, empresa_id').limit(5);
  for (const u of (usuariosCajado || [])) {
    console.log(` - ${u.email} | empresa_id: ${u.empresa_id}`);
  }

  console.log('\n=== BANCO INBOX ===');
  const { data: usuariosInbox } = await inbox.from('usuarios').select('id, email, empresa_id').limit(5);
  for (const u of (usuariosInbox || [])) {
    console.log(` - ${u.email} | empresa_id: ${u.empresa_id}`);
  }

  console.log('\n=== EMPRESAS INBOX ===');
  const { data: empresasInbox } = await inbox.from('empresas').select('id, nome').limit(5);
  for (const e of (empresasInbox || [])) {
    console.log(` - ${e.nome} | ID: ${e.id}`);
  }

  console.log('\n=== EMPRESAS CAJADO ===');
  const { data: empresasCajado } = await cajado.from('empresas').select('id, nome').limit(5);
  for (const e of (empresasCajado || [])) {
    console.log(` - ${e.nome} | ID: ${e.id}`);
  }
}

run();

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

async function debug() {
  console.log('--- DEBUG PERFIS ---')
  const { data, error } = await supabase.from('perfis').select('*')
  if (error) {
    console.error('ERRO AO BUSCAR PERFIS:', error)
  } else {
    console.log(`Encontrados ${data.length} perfis`)
    console.log(data)
  }
}
debug()

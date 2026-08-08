const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

async function test() {
  const { data, error } = await supabase.from('elena_ideias').select('id').limit(1)
  console.log('Result elena_ideias:', error || data)
}
test()

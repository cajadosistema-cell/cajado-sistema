const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

async function checkPolicies() {
  const { data, error } = await supabase.from('veiculos').select('id').limit(1)
  console.log("Access Check:", error ? error.message : "Success");
  
  // Try inserting as Admin (bypassing RLS with service role is not what we want, but let's test)
  // Actually, let's use a function if it exists to get policies.
}
checkPolicies()

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://cqagunhewncthekmvftk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.log("No service role key found in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
  const payload = {
    ai_provider: 'openai',
    api_key: 'sk-test123'
  };

  const { data, error } = await supabase
    .from('global_settings')
    .update(payload)
    .eq('id', 1)
    .select()
    .single();

  console.log("Update Result:", { data, error });
}

testSupabase();

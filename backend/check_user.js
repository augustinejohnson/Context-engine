const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('user_profiles').select('*').eq('email', 'augustinejohnsonrobin@gmail.com');
  console.log("Profiles:", data, error);
}

check();

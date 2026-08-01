const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cqagunhewncthekmvftk.supabase.co';
const supabaseAnonKey = 'sb_publishable_RHLgwUCfvdGNtjog7NrLGg_31AsXAEx';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Testing connection...");
  const { data, error } = await supabase.from('songs').select('*').limit(1);
  console.log("Response:", { data, error });
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'test' + Math.random() + '@example.com',
    password: 'password123'
  });
  console.log("Auth Response:", { authData, authError });
}

test();

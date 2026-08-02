require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://cqagunhewncthekmvftk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixGlobalSettings() {
  const payload = {
    ai_provider: 'openai',
    api_key: 'sk-test123'
  };

  // 1. Fetch the existing row
  const { data: existingRow, error: fetchErr } = await supabase
    .from('global_settings')
    .select('*')
    .limit(1)
    .single();

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    console.error("Fetch error:", fetchErr);
    return;
  }

  if (existingRow) {
    // Update existing row using its actual UUID
    const { data, error } = await supabase
      .from('global_settings')
      .update(payload)
      .eq('id', existingRow.id)
      .select()
      .single();
    console.log("Update success:", data, error);
  } else {
    // Insert new row (don't specify ID, let DB generate UUID)
    const { data, error } = await supabase
      .from('global_settings')
      .insert([payload])
      .select()
      .single();
    console.log("Insert success:", data, error);
  }
}

fixGlobalSettings();

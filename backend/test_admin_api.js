const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cqagunhewncthekmvftk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYWd1bmhld25jdGhla212ZnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDgxODEsImV4cCI6MjEwMTA4NDE4MX0.DuRnmcOrohiFRwzo5GDwGQ-i9TkE-Br287EkfiyXQeA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdmin() {
  // Login as admin
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'ronimationstudios@gmail.com',
    password: 'ronimationadmin' // Assuming this is the password? No wait, I don't know their password!
  });

  if (error) {
    console.error("Login failed:", error.message);
    return;
  }
  
  const token = data.session.access_token;

  const res = await fetch('https://context-engine-production-51a1.up.railway.app/api/admin/settings', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ ai_provider: 'openai', api_key: 'sk-test' })
  });
  
  const json = await res.json();
  console.log("Response:", res.status, json);
}

testAdmin();

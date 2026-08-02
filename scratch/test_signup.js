const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cqagunhewncthekmvftk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYWd1bmhld25jdGhla212ZnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDgxODEsImV4cCI6MjEwMTA4NDE4MX0.DuRnmcOrohiFRwzo5GDwGQ-i9TkE-Br287EkfiyXQeA'
);

async function test() {
  const { data, error } = await supabase.auth.signUp({
    email: 'test_node_' + Date.now() + '@example.com',
    password: 'password123'
  });
  console.log('Data:', JSON.stringify(data));
  console.log('Error:', JSON.stringify(error));
}
test();

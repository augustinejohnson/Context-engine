require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const db = new sqlite3.Database('./context_engine.db');

async function run() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error || !users) {
    console.log("Error listing users:", error);
    return;
  }
  const user = users.users.find(u => u.email === 'ronimationstudios@gmail.com' || u.email === 'augustinejohnsonrobin@gmail.com');
  if (!user) {
    console.log("Could not find user.");
    return;
  }
  const tenantId = user.id;
  console.log("Found tenant ID:", tenantId);

  // Check how many already exist
  const { count } = await supabase.from('bible_verses').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId);
  console.log("Existing verses in Supabase:", count);
  if (count > 0 && count > 60000) {
      console.log("Bible verses appear to be already migrated.");
      return;
  }

  console.log("Reading bible verses from local SQLite...");
  db.all("SELECT * FROM bible_verses", async (err, rows) => {
    if (err) return console.error(err);
    if (!rows || rows.length === 0) return console.log("No bible verses to migrate");
    
    console.log(`Found ${rows.length} verses. Starting chunked upload...`);
    
    const CHUNK_SIZE = 500;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE).map(row => ({
        tenant_id: tenantId,
        book: row.book,
        chapter: row.chapter,
        verse: row.verse,
        text: row.text,
        version: row.version || 'KJV'
      }));

      const { error: insertErr } = await supabase.from('bible_verses').insert(chunk);
      if (insertErr) {
          console.error(`Error inserting chunk at index ${i}:`, insertErr);
      } else {
          console.log(`Successfully inserted chunk ${i} to ${i + chunk.length}`);
      }
    }
    console.log("Bible verses migration completed!");
  });
}
run();

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
  const user = users.users.find(u => u.email === 'augustinejohnsonrobin@gmail.com');
  if (!user) {
    console.log("Could not find user.");
    return;
  }
  const tenantId = user.id;
  console.log("Found tenant ID:", tenantId);

  // Migrate Knowledge Cards
  db.all("SELECT * FROM knowledge_cards", async (err, rows) => {
    if (err) return console.error(err);
    if (!rows || rows.length === 0) return console.log("No knowledge cards to migrate");
    
    for (const row of rows) {
      await supabase.from('knowledge_cards').upsert({
        tenant_id: tenantId,
        keyword: row.keyword,
        title: row.title,
        summary: row.summary
      }, { onConflict: 'id' });
    }
    console.log(`Migrated ${rows.length} knowledge cards.`);
  });

  // Migrate Songs & Lyrics
  db.all("SELECT * FROM songs", async (err, songs) => {
    if (err) return console.error(err);
    for (const song of songs) {
      const { data: newSong } = await supabase.from('songs').upsert({
        id: song.id, // preserve ID if UUID, assuming it is
        tenant_id: tenantId,
        title: song.title,
        artist: song.artist,
        lyrics: song.lyrics || ''
      }, { onConflict: 'id' }).select('*').single();

      if (newSong) {
        db.all(`SELECT * FROM song_lyrics WHERE song_id = '${song.id}'`, async (err, lyrics) => {
           for (const l of lyrics) {
              await supabase.from('song_lyrics').upsert({
                id: l.id,
                tenant_id: tenantId,
                song_id: newSong.id,
                title: l.title,
                artist: l.artist,
                section: l.section,
                text: l.text
              }, { onConflict: 'id' });
           }
           console.log(`Migrated song: ${song.title} with ${lyrics.length} sections`);
        });
      }
    }
  });
}
run();

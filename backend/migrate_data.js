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

  // Migrate Knowledge Cards
  db.all("SELECT * FROM knowledge_cards", async (err, rows) => {
    if (err) return console.error(err);
    if (!rows || rows.length === 0) return console.log("No knowledge cards to migrate");
    
    for (const row of rows) {
      // Check if exists first to avoid duplicates
      const { data: existing } = await supabase.from('knowledge_cards').select('id').eq('tenant_id', tenantId).eq('keyword', row.keyword).single();
      if (!existing) {
        await supabase.from('knowledge_cards').insert({
          tenant_id: tenantId,
          keyword: row.keyword,
          title: row.title,
          summary: row.summary
        });
      }
    }
    console.log(`Migrated ${rows.length} knowledge cards.`);
  });

  // Migrate Songs & Lyrics
  db.all("SELECT * FROM songs", async (err, songs) => {
    if (err) return console.error(err);
    for (const song of songs) {
      // Avoid duplicates
      const { data: existingSong } = await supabase.from('songs').select('id').eq('tenant_id', tenantId).eq('title', song.title).single();
      
      let newSongId = existingSong ? existingSong.id : null;
      if (!existingSong) {
        const { data: newSong, error: errSong } = await supabase.from('songs').insert({
          tenant_id: tenantId,
          title: song.title,
          artist: song.artist,
          lyrics: song.lyrics || ''
        }).select('*').single();
        if (errSong) {
           console.error("Error inserting song:", errSong);
           continue;
        }
        newSongId = newSong.id;
      }

      if (newSongId) {
        db.all(`SELECT * FROM song_lyrics WHERE title = ?`, [song.title], async (err, lyrics) => {
           if (err) return console.error("Error getting lyrics:", err);
           for (const l of lyrics) {
              const { data: existingLyric } = await supabase.from('song_lyrics').select('id').eq('tenant_id', tenantId).eq('song_id', newSongId).eq('section', l.section).single();
              if (!existingLyric) {
                await supabase.from('song_lyrics').insert({
                  tenant_id: tenantId,
                  song_id: newSongId,
                  title: l.title,
                  artist: l.artist,
                  section: l.section,
                  text: l.text
                });
              }
           }
           console.log(`Migrated song: ${song.title} with ${lyrics.length} sections`);
        });
      }
    }
  });
}
run();

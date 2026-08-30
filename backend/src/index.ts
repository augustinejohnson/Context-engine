import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { detectScripture, detectKeywords } from './nlp-engine';
import { createClient } from '@supabase/supabase-js';
import { fetchLyricsFromWeb } from './lyrics-scraper';
import { parseOffice } from 'officeparser';

dotenv.config();

const BIBLE_BOOKS = [
  { book: 'Genesis', chapters: 50 }, { book: 'Exodus', chapters: 40 }, { book: 'Leviticus', chapters: 27 }, { book: 'Numbers', chapters: 36 }, { book: 'Deuteronomy', chapters: 34 },
  { book: 'Joshua', chapters: 24 }, { book: 'Judges', chapters: 21 }, { book: 'Ruth', chapters: 4 }, { book: '1 Samuel', chapters: 31 }, { book: '2 Samuel', chapters: 24 },
  { book: '1 Kings', chapters: 22 }, { book: '2 Kings', chapters: 25 }, { book: '1 Chronicles', chapters: 29 }, { book: '2 Chronicles', chapters: 36 }, { book: 'Ezra', chapters: 10 },
  { book: 'Nehemiah', chapters: 13 }, { book: 'Esther', chapters: 10 }, { book: 'Job', chapters: 42 }, { book: 'Psalms', chapters: 150 }, { book: 'Proverbs', chapters: 31 },
  { book: 'Ecclesiastes', chapters: 12 }, { book: 'Song of Solomon', chapters: 8 }, { book: 'Isaiah', chapters: 66 }, { book: 'Jeremiah', chapters: 52 }, { book: 'Lamentations', chapters: 5 },
  { book: 'Ezekiel', chapters: 48 }, { book: 'Daniel', chapters: 12 }, { book: 'Hosea', chapters: 14 }, { book: 'Joel', chapters: 3 }, { book: 'Amos', chapters: 9 },
  { book: 'Obadiah', chapters: 1 }, { book: 'Jonah', chapters: 4 }, { book: 'Micah', chapters: 7 }, { book: 'Nahum', chapters: 3 }, { book: 'Habakkuk', chapters: 3 },
  { book: 'Zephaniah', chapters: 3 }, { book: 'Haggai', chapters: 2 }, { book: 'Zechariah', chapters: 14 }, { book: 'Malachi', chapters: 4 },
  { book: 'Matthew', chapters: 28 }, { book: 'Mark', chapters: 16 }, { book: 'Luke', chapters: 24 }, { book: 'John', chapters: 21 }, { book: 'Acts', chapters: 28 },
  { book: 'Romans', chapters: 16 }, { book: '1 Corinthians', chapters: 16 }, { book: '2 Corinthians', chapters: 13 }, { book: 'Galatians', chapters: 6 }, { book: 'Ephesians', chapters: 6 },
  { book: 'Philippians', chapters: 4 }, { book: 'Colossians', chapters: 4 }, { book: '1 Thessalonians', chapters: 5 }, { book: '2 Thessalonians', chapters: 3 }, { book: '1 Timothy', chapters: 6 },
  { book: '2 Timothy', chapters: 4 }, { book: 'Titus', chapters: 3 }, { book: 'Philemon', chapters: 1 }, { book: 'Hebrews', chapters: 13 }, { book: 'James', chapters: 5 },
  { book: '1 Peter', chapters: 5 }, { book: '2 Peter', chapters: 3 }, { book: '1 John', chapters: 5 }, { book: '2 John', chapters: 1 }, { book: '3 John', chapters: 1 },
  { book: 'Jude', chapters: 1 }, { book: 'Revelation', chapters: 22 }
];
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

let cardIdCounter = 0;
const SERVER_BUILD_ID = Date.now().toString();
const tenantLiveCards: Record<string, any> = {};

// Helper to fetch scripture locally or fallback to bible-api
async function fetchScriptureLocalOrRemote(book: string, chapter: number, verse: number, tenantId: string, settings: any): Promise<string | null> {
  const version = settings.defaultBibleVersion || 'kjv';
  try {
    const { data: verses } = await supabase.from('bible_verses')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('book', `%${book}%`)
      .eq('chapter', chapter)
      .eq('verse', verse)
      .eq('version', version.toUpperCase())
      .limit(1);
    
    if (verses && verses.length > 0) {
      const v = verses[0];
      return `${v.book} ${v.chapter}:${v.verse} (${v.version.toUpperCase()}) — ${v.text}`;
    }
  } catch (e) {
    console.error('[NLP] Error querying local bible_verses:', e);
  }

  try {
    const query = `${book} ${chapter}:${verse}`;
    const res = await fetch(`https://bible-api.com/${encodeURIComponent(query)}?translation=${version}`);
    if (res.ok) {
      const data = await res.json();
      return `${data.reference} (${data.translation_id.toUpperCase()}) — ${data.text.trim()}`;
    }
  } catch (e) {
    console.error('[NLP] Error querying bible-api:', e);
  }
  return null;
}

// Function to automatically fetch song from genius via background worker(express.json());

app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- Mock STT ----
let mockSttInterval: NodeJS.Timeout | null = null;
// Store tenant settings in memory
const tenantSettings = new Map<string, any>();

let currentLineIndex = 0;

let currentBibleVersion = 'KJV';

// ---- OpenAI State ----
let openAIApiKey = '';
let aiExtractionEnabled = false;
let aiProvider = 'openrouter';
let aiBaseUrl = 'https://openrouter.ai/api/v1';
let aiModel = 'google/gemini-2.5-flash';
let aiExtractionTarget = 'all';

// ---- Phase 4 State ----
let lyricsModeEnabled = false;
let translationEnabled = false;
let translationTarget = 'Spanish';
let holyricsEnabled = false;
let holyricsIp = '127.0.0.1';
let holyricsPort = '8090';
let holyricsToken = '';
let proPresenterEnabled = false;
let proPresenterIp = '127.0.0.1';
let proPresenterPort = '20562';
let vmixEnabled = false;
let vmixIp = '127.0.0.1';
let vmixInput = 'Title 1';

// ---- Phase 6 State ----
let activeSessionId: string | null = null;

let openaiClient: OpenAI | null = null;
let geminiClient: GoogleGenAI | null = null;
let anthropicClient: Anthropic | null = null;

const mockTranscript = [
  "Welcome everyone to today's service.",
  "Let us open our Bibles to John chapter 3 verse 16",
  "For God so loved the world that He gave His only begotten Son.",
  "Today we'll be talking about grace",
  "As Albert Einstein once said, imagination is more important than knowledge.",
  "And Martin Luther King had a dream that changed a nation.",
  "Let's look at Psalm 23",
  "It takes intellectual capacity to understand these deep truths.",
  "Turn with me to Romans chapter 8 verse 28",
  "Let us reflect on the meaning of salvation",
  "Now let's read Philippians chapter 4 verse 13",
];

async function startMockStt(socket: any) {
  if (mockSttInterval) return;
  
  const tenantId = socket.tenantId;

  // Fetch all keywords from the database
  let keywords: string[] = [];
  try {
    const { data: rows } = await supabase.from('knowledge_cards').select('keyword').eq('tenant_id', tenantId);
    if (rows) keywords = rows.map((row: any) => row.keyword);
  } catch (e) {
    console.error('[NLP] Error fetching keywords:', e);
  }

  currentLineIndex = 0;

  mockSttInterval = setInterval(async () => {
    if (currentLineIndex >= mockTranscript.length) {
      currentLineIndex = 0; // Loop
    }

    const text = mockTranscript[currentLineIndex];
    console.log(`[STT] "${text}"`);

    // Emit transcript line to all clients in the tenant room (if using rooms, else broadcast)
    // Actually, io.emit broadcasts to all. To be safe, emit to tenant room. 
    io.to(tenantId).emit('transcript_line', text);

    const scripture = detectScripture(text);
    if (scripture) {
      console.log(`[NLP] Scripture detected: ${JSON.stringify(scripture)}`);
      try {
        const settings = tenantSettings.get(tenantId) || {};
        const version = settings.defaultBibleVersion || 'kjv';
        const query = `${scripture.book} ${scripture.chapter}:${scripture.verse}`;
        const res = await fetch(`https://bible-api.com/${encodeURIComponent(query)}?translation=${version}`);
        
        if (res.ok) {
          const data = await res.json();
          const card = {
            id: `card-${cardIdCounter++}`,
            type: 'scripture' as const,
            content: `${data.reference} (${data.translation_id.toUpperCase()}) — ${data.text.trim()}`,
            preset: 'full-screen' as const,
          };
          console.log(`[NLP] Emitting scripture card: ${card.content.substring(0, 50)}...`);
          io.to(tenantId).emit('staging_card', card);
        }
      } catch (e) {
        console.error('[NLP] Error fetching scripture from api:', e);
      }
    }

    // NLP Detection: Keywords
    const matchedKws = detectKeywords(text, keywords);
    for (const kw of matchedKws) {
      try {
        const { data: row } = await supabase.from('knowledge_cards').select('*').eq('keyword', kw).eq('tenant_id', tenantId).single();
        if (row) {
          const card = {
            id: `card-${cardIdCounter++}`,
            type: 'knowledge' as const,
            content: `${row.title}: ${row.summary}`,
            preset: 'lower-third' as const,
          };
          console.log(`[NLP] Emitting knowledge card: ${card.content.substring(0, 50)}...`);
          io.to(tenantId).emit('staging_card', card);
        }
      } catch (e) {
        console.error('[NLP] Error querying keyword:', e);
      }
    }

    currentLineIndex++;
  }, 3000);
}

function stopMockStt() {
  if (mockSttInterval) {
    clearInterval(mockSttInterval);
    mockSttInterval = null;
    console.log('[STT] Mock STT stopped.');
  }
}

// Middleware to inject tenant_id via JWT token
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Missing token'));
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return next(new Error('Authentication error: Invalid token'));
  }
  (socket as any).tenantId = user.id;
  socket.join(user.id); // Join a room for this tenant
  next();
});

// ---- Socket.io Events ----
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id} (Tenant: ${(socket as any).tenantId})`);
  const tenantId = (socket as any).tenantId;

  // Send initial data to client
  socket.emit('server_info', { buildId: SERVER_BUILD_ID });
  if (tenantLiveCards[tenantId]) {
    socket.emit('live_card', tenantLiveCards[tenantId]);
  }
  
  // Load settings from DB on connect
  (async () => {
    try {
      const { data } = await supabase.from('system_settings').select('settings').eq('tenant_id', tenantId).single();
      if (data && data.settings) {
        tenantSettings.set(tenantId, data.settings);
        socket.emit('settings_updated', data.settings);
      }
    } catch (e: any) {
      console.error('[Settings] Load error:', e?.message || e);
    }
  })();

  // Handle get_live_card request from output screen
  socket.on('get_live_card', () => {
    if (tenantLiveCards[tenantId]) {
      socket.emit('live_card', tenantLiveCards[tenantId]);
    } else {
      socket.emit('clear_live');
    }
  });

  socket.on('start_session', () => {
    activeSessionId = require('crypto').randomUUID();
    console.log(`[Session] Started new session: ${activeSessionId}`);
    io.to(tenantId).emit('session_status', activeSessionId);
  });

  socket.on('end_session', () => {
    if (activeSessionId) {
      console.log(`[Session] Ended session: ${activeSessionId}`);
      io.to(tenantId).emit('session_ended', activeSessionId);
      activeSessionId = null;
      io.to(tenantId).emit('session_status', null);
    }
  });

  supabase.from('songs').select('*').eq('tenant_id', tenantId).then(({ data }) => {
    socket.emit('songs_list', data || []);
  });

  socket.on('audio_start', () => {
    console.log('[Audio] Starting mock STT...');
    startMockStt(socket);
  });

  socket.on('audio_stop', () => {
    console.log('[Audio] Stopping mock STT...');
    stopMockStt();
  });

  socket.on('audio_stream', (_chunk: Buffer) => {
    // Future: Forward to real STT provider (Deepgram, Whisper)
  });

  const handleAutoFetchSong = async (title: string, tenantId: string, socket: any) => {
    try {
      console.log(`[Auto-Fetch] Scraping lyrics for: ${title}`);
      socket.emit('fetch_success', `Fetching lyrics for: "${title}"...`);
      const songData = await fetchLyricsFromWeb(title);
      
      const { data: songRecord, error: songErr } = await supabase.from('songs')
        .insert({ title: songData.title, artist: songData.artist, tenant_id: tenantId })
        .select()
        .single();
        
      if (songErr || !songRecord) throw new Error("Failed to insert song into database.");
      for (const section of songData.sections) {
        await supabase.from('song_lyrics').insert({
          song_id: songRecord.id,
          title: songData.title,
          artist: songData.artist,
          section: section.section,
          text: section.text,
          tenant_id: tenantId
        });
      }
      
      // Refresh the frontend's song list
      const { data: songs } = await supabase.from('songs').select('*').eq('tenant_id', tenantId);
      io.to(tenantId).emit('songs_list', songs || []);
      socket.emit('fetch_success', `Successfully fetched and imported "${songData.title}"!`);

      // Automatically pop the first verse onto the staging area so they know it worked
      if (songData.sections.length > 0) {
        const settings = tenantSettings.get(tenantId) || {};
        const firstSection = songData.sections[0];
        const card = {
          id: `card-${cardIdCounter++}`,
          type: 'lyric' as const,
          content: firstSection.text,
          preset: settings.lyricsPosition || 'lower-third',
          songSections: songData.sections.map(s => ({ name: s.section, text: s.text }))
        };
        io.to(tenantId).emit('staging_card', card);
      }

    } catch (e: any) {
      console.error('[Auto-Fetch] Error:', e);
      socket.emit('fetch_error', `Could not fetch lyrics for "${title}". Error: ${e.message}`);
    }
  };

  socket.on('auto_fetch_song', async (title: string) => {
    await handleAutoFetchSong(title, tenantId, socket);
  });

  // ---- Manual Song Import (pasted lyrics) ----
  socket.on('add_song', async (songData: { title: string; artist: string; lyrics: string }) => {
    try {
      console.log(`[Songs] Manually importing song: "${songData.title}"`);
      
      // Insert the song record
      const { data: songRecord, error: songErr } = await supabase.from('songs')
        .insert({ title: songData.title, artist: songData.artist || 'Unknown', tenant_id: tenantId })
        .select()
        .single();
      
      if (songErr || !songRecord) throw new Error("Failed to insert song: " + songErr?.message);

      // Parse lyrics into sections (split by [Verse 1], [Chorus], etc.)
      const lines = songData.lyrics.split('\n');
      let currentSection = 'Verse 1';
      let currentText = '';
      const sections: { section: string; text: string }[] = [];

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith('[') && line.endsWith(']')) {
          if (currentText.trim()) {
            sections.push({ section: currentSection, text: currentText.trim() });
          }
          currentSection = line.replace('[', '').replace(']', '');
          currentText = '';
        } else {
          currentText += line + '\n';
        }
      }
      if (currentText.trim()) {
        sections.push({ section: currentSection, text: currentText.trim() });
      }

      // If no section headers were found, treat the entire lyrics as one section
      if (sections.length === 0) {
        sections.push({ section: 'Full Song', text: songData.lyrics.trim() });
      }

      // Insert all sections into song_lyrics
      for (const section of sections) {
        await supabase.from('song_lyrics').insert({
          song_id: songRecord.id,
          title: songData.title,
          artist: songData.artist || 'Unknown',
          section: section.section,
          text: section.text,
          tenant_id: tenantId
        });
      }

      console.log(`[Songs] Successfully imported "${songData.title}" with ${sections.length} sections.`);
      
      // Refresh the frontend's song list
      const { data: songs } = await supabase.from('songs').select('*').eq('tenant_id', tenantId);
      io.to(tenantId).emit('songs_list', songs || []);
      socket.emit('fetch_success', `Song "${songData.title}" imported with ${sections.length} sections!`);
    } catch (e: any) {
      console.error('[Songs] Error importing song:', e);
      socket.emit('fetch_error', `Failed to import "${songData.title}": ${e.message}`);
    }
  });

  // ---- Save Genius Lyrics (edit_song_lyrics) ----
  socket.on('edit_song_lyrics', async (songData: { title: string; artist: string; lyrics: string }) => {
    try {
      console.log(`[Songs] Saving fetched lyrics for: "${songData.title}"`);
      
      let { data: existingSongs } = await supabase.from('songs')
        .select('*')
        .eq('title', songData.title)
        .eq('tenant_id', tenantId);

      let songRecord = existingSongs && existingSongs.length > 0 ? existingSongs[0] : null;

      if (!songRecord) {
        const { data: newRecord, error: songErr } = await supabase.from('songs')
          .insert({ title: songData.title, artist: songData.artist || 'Unknown', tenant_id: tenantId })
          .select()
          .single();
        if (songErr || !newRecord) throw new Error("Failed to insert song: " + songErr?.message);
        songRecord = newRecord;
      } else {
        // If the song already exists, clean up its old lyrics and remove duplicates if any
        if (existingSongs && existingSongs.length > 1) {
           for (let i = 1; i < existingSongs.length; i++) {
              await supabase.from('song_lyrics').delete().eq('song_id', existingSongs[i].id);
              await supabase.from('songs').delete().eq('id', existingSongs[i].id);
           }
        }
        await supabase.from('song_lyrics').delete().eq('song_id', songRecord.id);
      }

      const lines = songData.lyrics.split('\n');
      let currentSection = 'Verse 1';
      let currentText = '';
      const sections: { section: string; text: string }[] = [];

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith('[') && line.endsWith(']')) {
          if (currentText.trim()) sections.push({ section: currentSection, text: currentText.trim() });
          currentSection = line.replace('[', '').replace(']', '');
          currentText = '';
        } else {
          currentText += line + '\n';
        }
      }
      if (currentText.trim()) sections.push({ section: currentSection, text: currentText.trim() });
      if (sections.length === 0) sections.push({ section: 'Full Song', text: songData.lyrics.trim() });

      for (const section of sections) {
        await supabase.from('song_lyrics').insert({
          song_id: songRecord.id,
          title: songData.title,
          artist: songData.artist || 'Unknown',
          section: section.section,
          text: section.text,
          tenant_id: tenantId
        });
      }

      console.log(`[Songs] Successfully saved "${songData.title}" with ${sections.length} sections.`);
      
      const { data: songs } = await supabase.from('songs').select('*').eq('tenant_id', tenantId);
      io.to(tenantId).emit('songs_list', songs || []);
      socket.emit('fetch_success', `Song "${songData.title}" saved successfully!`);
    } catch (e: any) {
      console.error('[Songs] Error saving fetched lyrics:', e);
      socket.emit('fetch_error', `Failed to save "${songData.title}": ${e.message}`);
    }
  });

  // ---- Get Song Lyrics (for editing) ----
  socket.on('get_song_lyrics', async (title: string) => {
    try {
      const { data: song } = await supabase.from('songs').select('*').eq('tenant_id', tenantId).eq('title', title).single();
      if (!song) throw new Error("Song not found");
      
      const { data: lyrics } = await supabase.from('song_lyrics').select('*').eq('tenant_id', tenantId).eq('song_id', song.id);
      let combinedLyrics = '';
      if (lyrics) {
        combinedLyrics = lyrics.map((l: any) => `[${l.section}]\n${l.text}`).join('\n\n');
      }
      socket.emit('song_lyrics_result', { title: song.title, artist: song.artist, lyrics: combinedLyrics });
    } catch (e: any) {
      console.error('[Songs] Error getting lyrics:', e);
      socket.emit('fetch_error', `Failed to get lyrics for "${title}"`);
    }
  });

  // ---- Delete Song ----
  socket.on('delete_song', async (title: string) => {
    try {
      const { error } = await supabase.from('songs').delete().eq('tenant_id', tenantId).eq('title', title);
      if (error) throw error;
      console.log(`[Songs] Deleted song: ${title}`);
      
      const { data: songs } = await supabase.from('songs').select('*').eq('tenant_id', tenantId);
      io.to(tenantId).emit('songs_list', songs || []);
    } catch (e: any) {
      console.error('[Songs] Error deleting song:', e);
      socket.emit('fetch_error', `Failed to delete "${title}"`);
    }
  });

  // ---- Get Songs List ----
  socket.on('get_songs', async () => {
    const { data: songs } = await supabase.from('songs').select('*').eq('tenant_id', tenantId);
    socket.emit('songs_list', songs || []);
  });

  // ---- File Import: CSV/TXT ----
  socket.on('import_csv', async (csvText: string) => {
    try {
      console.log('[Import] Processing CSV/TXT file...');
      const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) throw new Error('File is empty');

      // Try to detect if it's a Holyrics CSV (title, artist, lyrics columns)
      // or a plain text lyrics file
      let title = 'Imported Song';
      let artist = 'Unknown';
      let lyricsText = '';

      // Check if first line looks like a CSV header
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes('title') && firstLine.includes('lyric')) {
        // Holyrics CSV format - skip header, parse rows
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 2) {
            title = parts[0].replace(/"/g, '').trim() || title;
            artist = parts.length >= 3 ? parts[1].replace(/"/g, '').trim() : artist;
            lyricsText = parts.slice(parts.length >= 3 ? 2 : 1).join(',').replace(/"/g, '').trim();
          }
        }
      } else {
        // Plain text - treat entire content as lyrics for one song
        lyricsText = lines.join('\n');
      }

      // Save to DB
      const { data: songRecord, error: songErr } = await supabase.from('songs')
        .insert({ title, artist, tenant_id: tenantId })
        .select().single();
      if (songErr || !songRecord) throw new Error('Failed to insert song: ' + songErr?.message);

      // Parse sections
      const sectionLines = lyricsText.split('\n');
      let currentSection = 'Verse 1';
      let currentText = '';
      const sections: { section: string; text: string }[] = [];
      for (let line of sectionLines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith('[') && line.endsWith(']')) {
          if (currentText.trim()) sections.push({ section: currentSection, text: currentText.trim() });
          currentSection = line.replace('[', '').replace(']', '');
          currentText = '';
        } else {
          currentText += line + '\n';
        }
      }
      if (currentText.trim()) sections.push({ section: currentSection, text: currentText.trim() });
      if (sections.length === 0) sections.push({ section: 'Full Song', text: lyricsText.trim() });

      for (const section of sections) {
        await supabase.from('song_lyrics').insert({
          song_id: songRecord.id, title, artist, section: section.section, text: section.text, tenant_id: tenantId
        });
      }

      const { data: songs } = await supabase.from('songs').select('*').eq('tenant_id', tenantId);
      io.to(tenantId).emit('songs_list', songs || []);
      socket.emit('fetch_success', `CSV imported: "${title}" with ${sections.length} sections.`);
    } catch (e: any) {
      console.error('[Import] CSV error:', e);
      socket.emit('fetch_error', `Failed to import CSV: ${e.message}`);
    }
  });

  // ---- File Import: DOCX ----
  socket.on('import_docx', async (payload: { title: string; artist: string; buffer: ArrayBuffer }) => {
    try {
      console.log(`[Import] Processing DOCX: "${payload.title}"`);
      const buf = Buffer.from(payload.buffer);
      const text = (await parseOffice(buf)).toText();

      const { data: songRecord, error: songErr } = await supabase.from('songs')
        .insert({ title: payload.title, artist: payload.artist || 'Unknown', tenant_id: tenantId })
        .select().single();
      if (songErr || !songRecord) throw new Error('Failed to insert song: ' + songErr?.message);

      const lines = text.split('\n');
      let currentSection = 'Verse 1';
      let currentText = '';
      const sections: { section: string; text: string }[] = [];
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith('[') && line.endsWith(']')) {
          if (currentText.trim()) sections.push({ section: currentSection, text: currentText.trim() });
          currentSection = line.replace('[', '').replace(']', '');
          currentText = '';
        } else {
          currentText += line + '\n';
        }
      }
      if (currentText.trim()) sections.push({ section: currentSection, text: currentText.trim() });
      if (sections.length === 0) sections.push({ section: 'Full Song', text: text.trim() });

      for (const section of sections) {
        await supabase.from('song_lyrics').insert({
          song_id: songRecord.id, title: payload.title, artist: payload.artist || 'Unknown', section: section.section, text: section.text, tenant_id: tenantId
        });
      }

      const { data: songs } = await supabase.from('songs').select('*').eq('tenant_id', tenantId);
      io.to(tenantId).emit('songs_list', songs || []);
      socket.emit('fetch_success', `DOCX imported: "${payload.title}" with ${sections.length} sections.`);
    } catch (e: any) {
      console.error('[Import] DOCX error:', e);
      socket.emit('fetch_error', `Failed to import DOCX: ${e.message}`);
    }
  });

  // ---- File Import: PPTX ----
  socket.on('import_pptx', async (payload: { title: string; artist: string; buffer: ArrayBuffer }) => {
    try {
      console.log(`[Import] Processing PPTX: "${payload.title}"`);
      const buf = Buffer.from(payload.buffer);
      const text = (await parseOffice(buf)).toText();

      const { data: songRecord, error: songErr } = await supabase.from('songs')
        .insert({ title: payload.title, artist: payload.artist || 'Unknown', tenant_id: tenantId })
        .select().single();
      if (songErr || !songRecord) throw new Error('Failed to insert song: ' + songErr?.message);

      // For PPTX, each slide is typically separated by newlines
      const slideTexts = text.split('\n\n').filter((s: string) => s.trim());
      const sections: { section: string; text: string }[] = [];
      slideTexts.forEach((slideText: string, i: number) => {
        sections.push({ section: `Slide ${i + 1}`, text: slideText.trim() });
      });
      if (sections.length === 0) sections.push({ section: 'Full Song', text: text.trim() });

      for (const section of sections) {
        await supabase.from('song_lyrics').insert({
          song_id: songRecord.id, title: payload.title, artist: payload.artist || 'Unknown', section: section.section, text: section.text, tenant_id: tenantId
        });
      }

      const { data: songs } = await supabase.from('songs').select('*').eq('tenant_id', tenantId);
      io.to(tenantId).emit('songs_list', songs || []);
      socket.emit('fetch_success', `PPTX imported: "${payload.title}" with ${sections.length} slides.`);
    } catch (e: any) {
      console.error('[Import] PPTX error:', e);
      socket.emit('fetch_error', `Failed to import PPTX: ${e.message}`);
    }
  });

  // ---- Lightning Fast Exact Scripture Match ----
  socket.on('fast_fetch_scripture', async (payload: any) => {
    // Legacy support: if a string is passed
    let p = payload;
    if (typeof payload === 'string') {
      const parts = payload.match(/^(.+?)\s+(\d+):(\d+)$/);
      if (parts) p = { book: parts[1], chapter: parseInt(parts[2]), verseStart: parseInt(parts[3]), verseEnd: null, originalRef: payload };
      else return; // unparseable legacy string
    }

    console.log(`[FAST-FETCH] Scripture triggered early via regex: "${p.originalRef}"`);
    try {
      const settings = tenantSettings.get(tenantId) || {};
      const version = settings.defaultBibleVersion || 'kjv';
      
      // Fetch the FULL chapter to allow prefetching
      const fetchRef = `${p.book} ${p.chapter}`;
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(fetchRef)}?translation=${version}`);
      
      if (res.ok) {
        const data = await res.json();
        
        let initialVerse = p.verseStart;
        if (!initialVerse) initialVerse = 1;
        
        const verses = data.verses || [];
        const startIdx = verses.findIndex((v: any) => v.verse === initialVerse);
        
        if (startIdx !== -1) {
          const mainVerse = verses[startIdx];
          // Pre-fetch the rest of the verses up to the end of the range, or the end of the chapter
          let maxPrefetch = p.verseEnd ? (p.verseEnd - initialVerse) : 20; // limit to 20 verses ahead if no explicit range
          // For chapter-only triggers, still limit to 20 for auto-advance (not the entire chapter)
          
          const nextVerses = [];
          for (let i = 1; i <= maxPrefetch; i++) {
            if (startIdx + i < verses.length) {
              const nv = verses[startIdx + i];
              if (p.verseEnd && nv.verse > p.verseEnd) break;
              nextVerses.push({
                verse: nv.verse,
                text: nv.text.trim()
              });
            }
          }

          const card = {
            id: `card-${cardIdCounter++}`,
            type: 'scripture' as const,
            content: `${p.book} ${p.chapter}:${mainVerse.verse} (${data.translation_id.toUpperCase()}) — ${mainVerse.text.trim()}`,
            preset: 'full-screen' as const,
            scriptureReference: `${p.book} ${p.chapter}:${mainVerse.verse}`,
            activeScriptureContext: {
              book: p.book,
              chapter: p.chapter,
              currentVerse: mainVerse.verse,
              nextVerses: nextVerses,
              translation: data.translation_id.toUpperCase()
            }
          };
          console.log(`[FAST-FETCH] Emitting scripture card instantly: ${card.content.substring(0, 50)}...`);
          io.to(tenantId).emit('staging_card', card);
        }
      }
    } catch (e) {
      console.error('[FAST-FETCH] Error fetching scripture from api:', e);
    }
  });

  // ---- Bolls Bible Book Number -> Name Mapping ----
  const BOLLS_BOOK_MAP: Record<number, string> = {
    1:'Genesis',2:'Exodus',3:'Leviticus',4:'Numbers',5:'Deuteronomy',6:'Joshua',7:'Judges',8:'Ruth',
    9:'1 Samuel',10:'2 Samuel',11:'1 Kings',12:'2 Kings',13:'1 Chronicles',14:'2 Chronicles',
    15:'Ezra',16:'Nehemiah',17:'Esther',18:'Job',19:'Psalms',20:'Proverbs',21:'Ecclesiastes',
    22:'Song of Solomon',23:'Isaiah',24:'Jeremiah',25:'Lamentations',26:'Ezekiel',27:'Daniel',
    28:'Hosea',29:'Joel',30:'Amos',31:'Obadiah',32:'Jonah',33:'Micah',34:'Nahum',35:'Habakkuk',
    36:'Zephaniah',37:'Haggai',38:'Zechariah',39:'Malachi',
    40:'Matthew',41:'Mark',42:'Luke',43:'John',44:'Acts',45:'Romans',
    46:'1 Corinthians',47:'2 Corinthians',48:'Galatians',49:'Ephesians',50:'Philippians',
    51:'Colossians',52:'1 Thessalonians',53:'2 Thessalonians',54:'1 Timothy',55:'2 Timothy',
    56:'Titus',57:'Philemon',58:'Hebrews',59:'James',60:'1 Peter',61:'2 Peter',
    62:'1 John',63:'2 John',64:'3 John',65:'Jude',66:'Revelation'
  };

  // ---- Lightning Fast PHRASE-BASED Scripture Search ----
  socket.on('phrase_search_scripture', async (phrase: string) => {
    if (!phrase || phrase.length < 15) return; // too short to be meaningful
    
    console.log(`[PHRASE-SEARCH] Searching for: "${phrase.substring(0, 60)}..."`);
    try {
      const settings = tenantSettings.get(tenantId) || {};
      const version = (settings.defaultBibleVersion || 'NKJV').toUpperCase();
      
      const res = await fetch(`https://bolls.life/search/${version}/?search=${encodeURIComponent(phrase)}`);
      if (!res.ok) {
        console.error(`[PHRASE-SEARCH] Bolls API returned ${res.status}`);
        return;
      }
      
      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) return;
      
      // Take only the #1 result — if the phrase is a real quote, the correct verse will always be #1
      const topResult = results[0];
      
      // Strip HTML tags (<mark>, <S>, <sup>, <i>, <br/>) from the text
      const cleanText = topResult.text
        .replace(/<mark>|<\/mark>/g, '')
        .replace(/<S>\d+<\/S>/g, '')
        .replace(/<sup>.*?<\/sup>/g, '')
        .replace(/<i>|<\/i>/g, '')
        .replace(/<br\/?>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Confidence check: count how many words from the spoken phrase appear in the verse (in order)
      const spokenWords = phrase.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
      const verseWords = cleanText.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
      
      let matchCount = 0;
      let verseIdx = 0;
      for (const word of spokenWords) {
        for (let j = verseIdx; j < verseWords.length; j++) {
          if (verseWords[j] === word || verseWords[j].includes(word)) {
            matchCount++;
            verseIdx = j + 1;
            break;
          }
        }
      }
      
      const confidence = spokenWords.length > 0 ? matchCount / spokenWords.length : 0;
      console.log(`[PHRASE-SEARCH] Top result: ${BOLLS_BOOK_MAP[topResult.book] || '?'} ${topResult.chapter}:${topResult.verse} (confidence: ${(confidence * 100).toFixed(0)}%)`);
      
      // Only push if confidence is >= 60% (most spoken words found in order in the verse)
      if (confidence < 0.60) {
        console.log(`[PHRASE-SEARCH] Confidence too low (${(confidence * 100).toFixed(0)}%), skipping.`);
        return;
      }
      
      const bookName = BOLLS_BOOK_MAP[topResult.book] || `Book ${topResult.book}`;
      const reference = `${bookName} ${topResult.chapter}:${topResult.verse}`;
      
      const card = {
        id: `card-${cardIdCounter++}`,
        type: 'scripture' as const,
        content: `${reference} (${version}) — ${cleanText}`,
        preset: 'full-screen' as const,
        scriptureReference: reference,
        phraseMatched: true // Flag so frontend knows this came from phrase search
      };
      
      console.log(`[PHRASE-SEARCH] ✅ Pushing phrase-matched scripture: ${reference}`);
      io.to(tenantId).emit('staging_card', card);
      
    } catch (e) {
      console.error('[PHRASE-SEARCH] Error:', e);
    }
  });

  // ---- Real-time transcript from browser Web Speech API ----
  socket.on('transcript_text', async (text: string) => {
    console.log(`[STT-Live] "${text}"`);
    io.to(tenantId).emit('transcript_line', text);

    const settings = tenantSettings.get(tenantId) || {};

    if (settings.spokenWordMode) {
      const liveCaptionCard = {
        id: `caption-${Date.now()}`,
        type: 'caption' as const,
        content: text,
        preset: settings.spokenWordPosition || 'subtitle',
      };
      
      // Update memory state
      tenantLiveCards[tenantId] = liveCaptionCard;
      
      // Broadcast to all clients for this tenant (including the output page)
      io.to(tenantId).emit('live_card', liveCaptionCard);
      
      // Instantly push to ProPresenter/vMix if enabled
      socket.emit('trigger_local_api', {
        action: 'push_live',
        content: text,
        holyrics: { enabled: settings.holyricsEnabled, ip: settings.holyricsIp, port: settings.holyricsPort, token: settings.holyricsToken },
        proPresenter: { enabled: settings.proPresenterEnabled, ip: settings.proPresenterIp, port: settings.proPresenterPort },
        vmix: { enabled: settings.vmixEnabled, ip: settings.vmixIp, input: settings.vmixInput }
      });
    }

    if (activeSessionId) {
      try {
        await supabase.from('transcription_logs').insert({
          session_id: activeSessionId,
          timestamp: new Date().toISOString(),
          type: 'transcript',
          content: text,
          tenant_id: tenantId
        });
      } catch (e) {
        console.error('[Session] Error logging transcript:', e);
      }
    }

    let keywords: string[] = [];
    try {
      const { data: rows } = await supabase.from('knowledge_cards').select('keyword').eq('tenant_id', tenantId);
      if (rows) keywords = rows.map((row: any) => row.keyword);
    } catch (e) {
      console.error('[NLP] Error fetching keywords:', e);
    }

    let cardFound = false;

    // 1. Check for manual Knowledge Base Keywords
    if (!cardFound && keywords.length > 0) {
      const lowerText = text.toLowerCase();
      for (const kw of keywords) {
        if (lowerText.includes(kw.toLowerCase())) {
          try {
            const { data: row } = await supabase.from('knowledge_cards').select('*').eq('keyword', kw).eq('tenant_id', tenantId).single();
            if (row) {
              const card = {
                id: `card-${cardIdCounter++}`,
                type: 'knowledge' as const,
                content: `**${row.keyword}**\n${row.summary}`,
                preset: settings.scripturePosition || 'full-screen',
              };
              io.to(tenantId).emit('staging_card', card);
              cardFound = true;
              break;
            }
          } catch (e) {
            console.error('[NLP] Error fetching knowledge card:', e);
          }
        }
      }
    }

    if (!cardFound && settings.lyricsModeEnabled) {
      try {
        const { data: lyricsRows } = await supabase.from('song_lyrics').select('*').eq('tenant_id', tenantId);
        if (lyricsRows && lyricsRows.length > 0) {
          const lowerText = text.toLowerCase();
          let bestMatch: any = null;
          let highestScore = 0;
          
          const textTokens = lowerText.split(/\s+/).filter(w => w.length > 2);
          
          if (textTokens.length >= 3) {
            for (const row of lyricsRows) {
              const lowerLyric = row.text.toLowerCase();
              let matchedWords = 0;
              for (const token of textTokens) {
                if (lowerLyric.includes(token)) matchedWords++;
              }
              const score = matchedWords / textTokens.length;
              if (score > highestScore) {
                highestScore = score;
                bestMatch = row;
              }
            }
          }

          if (bestMatch && highestScore >= 0.70) {
            console.log(`[Music] Fuzzy match found! Score: ${highestScore.toFixed(2)}, Song: ${bestMatch.title}`);
            const songSections = lyricsRows
              .filter((r: any) => r.song_id === bestMatch.song_id)
              .map((r: any) => ({ name: r.section, text: r.text }));

            const card = {
              id: `card-${cardIdCounter++}`,
              type: 'lyric' as const,
              content: bestMatch.text,
              preset: settings.lyricsPosition || 'lower-third',
              songSections: songSections
            };
            io.to(tenantId).emit('staging_card', card);
            cardFound = true;
          }
        }
      } catch (e) {
        console.error('[Music] Error in fuzzy matching lyrics:', e);
      }
    }

    const scripture = !cardFound ? detectScripture(text) : null;
    if (scripture) {
      try {
        const cardContent = await fetchScriptureLocalOrRemote(scripture.book, scripture.chapter, scripture.verse, tenantId, settings);
        
        if (cardContent) {
          const card = {
            id: `card-${cardIdCounter++}`,
            type: 'scripture' as const,
            content: cardContent,
            preset: settings.scripturePosition || 'full-screen',
          };
          io.to(tenantId).emit('staging_card', card);
          cardFound = true;
        }
      } catch (e) {
        console.error('[NLP-Live] Error fetching scripture:', e);
      }
    }

    // AI Semantic fallback
    if (!cardFound && settings.aiExtractionEnabled) {
      try {
        let aiProvider = 'openai';
        let aiModel = 'gpt-4o-mini';
        let masterKey = '';
        const { data: globalSettings } = await supabase.from('global_settings').select('*').single();
        if (globalSettings) {
          aiProvider = (globalSettings.ai_provider || 'openai').toLowerCase();
          aiModel = globalSettings.ai_model || 'gpt-4o-mini';
          masterKey = globalSettings.api_key || globalSettings.openai_api_key || '';
        }
        if (!masterKey) masterKey = process.env.OPENAI_API_KEY || '';

        const apiKeyToUse = masterKey || settings.openAIApiKey;
        
        if (apiKeyToUse) {
          const prompt = `You are a Live Broadcast Context Engine. Extract key information from the following transcript text. 
1. SCRIPTURE (Highest Priority): If the text contains ANY Bible verse, Bible quote, or Bible reference (e.g. "Genesis 1:3", "Let there be light"), you MUST extract it as type="scripture". Provide the standard reference string (e.g. "Genesis 1:3") as the 'content'. Also provide 2-3 related cross-reference verse strings in a 'crossReferences' array.
2. SONG: If the text contains people singing lyrics, reciting worship lyrics, or explicitly mentioning a song title, you MUST extract the best guess of the song title as type="song" (e.g. "Way Maker"). Even if it's just a few lines of a known worship song, extract it!
Return a JSON object with a single key 'data' containing an array of these objects. DO NOT extract general knowledge, facts, or definitions, ONLY extract Scriptures and Songs.

Example JSON output:
{
  "data": [
    {
      "type": "scripture",
      "content": "John 1:1",
      "crossReferences": ["Genesis 1:1", "1 John 1:1"]
    },
    {
      "type": "song",
      "content": "Way Maker"
    }
  ]
}

Target mode: ${settings.aiExtractionTarget || 'all'}.

Text: "${text}"`;

          let jsonResponse = "[]";

          if (aiProvider === 'gemini') {
            const genAI = new GoogleGenAI({ apiKey: apiKeyToUse });
            const response = await genAI.models.generateContent({
              model: aiModel,
              contents: prompt,
            });
            jsonResponse = response.text?.trim() || "[]";
          } else {
            // Default: OpenAI or compatible API
            const openai = new OpenAI({ apiKey: apiKeyToUse });
            const completion = await openai.chat.completions.create({
              messages: [{ role: "user", content: prompt }],
              model: aiModel,
              response_format: { type: "json_object" }
            });
            // We asked for an array, but response_format json_object forces an object.
            // So we just parse whatever comes back and extract the array if wrapped.
            jsonResponse = completion.choices[0]?.message?.content?.trim() || "[]";
          }

          let parsed = [];
          try {
            // Strip markdown formatting if any
            jsonResponse = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(jsonResponse);
            if (!Array.isArray(parsed) && parsed.results) parsed = parsed.results;
            if (!Array.isArray(parsed) && parsed.data) parsed = parsed.data;
            if (!Array.isArray(parsed)) parsed = [];
          } catch (e) {
            console.error('[NLP-Live] Failed to parse AI JSON:', jsonResponse);
          }

          for (const item of parsed) {
            if (item.type === 'scripture') {
              // Try to resolve the scripture locally, fallback to bible-api
              // The AI returns content like "Matthew 18:32" or sometimes just "John 5"
              const match = item.content.match(/([1-3]?\s?[A-Za-z]+)\s+(\d+):(\d+)/);
              // Also try to match chapter-only references like "John 5"
              const chapterOnlyMatch = !match ? item.content.match(/([1-3]?\s?[A-Za-z]+)\s+(\d+)$/) : null;
              let cardContent = null;
              if (match) {
                cardContent = await fetchScriptureLocalOrRemote(match[1].trim(), parseInt(match[2]), parseInt(match[3]), tenantId, settings);
              } else if (chapterOnlyMatch) {
                // AI returned a chapter-only reference (e.g. "John 5"), default to verse 1
                cardContent = await fetchScriptureLocalOrRemote(chapterOnlyMatch[1].trim(), parseInt(chapterOnlyMatch[2]), 1, tenantId, settings);
                // Override item.content for the scriptureReference below
                item.content = `${chapterOnlyMatch[1].trim()} ${chapterOnlyMatch[2]}:1`;
              } else {
                 // Last resort fallback — but guard against dumping entire chapters
                 // Only call bible-api if the content looks like a valid reference
                 const looksLikeRef = /[a-zA-Z]+\s+\d+/.test(item.content);
                 if (looksLikeRef) {
                   // Append :1 to force a single verse instead of the whole chapter
                   const safeRef = item.content.includes(':') ? item.content : `${item.content}:1`;
                   const version = settings.defaultBibleVersion || 'kjv';
                   const res = await fetch(`https://bible-api.com/${encodeURIComponent(safeRef)}?translation=${version}`);
                   if (res.ok) {
                     const data = await res.json();
                     cardContent = `${data.reference} (${data.translation_id.toUpperCase()}) — ${data.text.trim()}`;
                   }
                 }
              }

              // If fetch fails, at least show the reference
              if (!cardContent) {
                cardContent = item.content;
              }

              if (item.crossReferences && Array.isArray(item.crossReferences) && item.crossReferences.length > 0) {
                cardContent += `\n\n[Cross Refs: ${item.crossReferences.join(', ')}]`;
              }
              const card = {
                id: `card-${cardIdCounter++}`,
                type: 'scripture' as const,
                content: cardContent,
                preset: settings.scripturePosition || 'full-screen',
                scriptureReference: match ? `${match[1].trim()} ${match[2]}:${match[3]}` : item.content
              };
              io.to(tenantId).emit('staging_card', card);
            } else if (item.type === 'knowledge') {
              const card = {
                id: `card-${cardIdCounter++}`,
                type: 'knowledge' as const,
                content: item.content,
                preset: settings.scripturePosition || 'full-screen',
              };
              io.to(tenantId).emit('staging_card', card);
            } else if (item.type === 'song') {
              console.log(`[NLP-Live] AI detected song lyrics: ${item.content}`);
              // Use the helper to automatically fetch lyrics from Genius!
              handleAutoFetchSong(item.content, tenantId, socket);
            }
          }
        }
      } catch (e: any) {
        console.error('[NLP-Live] AI Extraction Error:', e);
        socket.emit('toast_error', `AI Extraction Failed: ${e.message || 'Rate limit or connection error'}`);
      }
    }
  });

  socket.on('push_live', async (cardData: any) => {
    let aiProvider = 'openai';
    let aiModel = 'gpt-4o-mini';
    let masterKey = process.env.OPENAI_API_KEY || '';
    try {
      const { data: globalSettings } = await supabase.from('global_settings').select('*').single();
      if (globalSettings) {
        aiProvider = (globalSettings.ai_provider || 'openai').toLowerCase();
        aiModel = globalSettings.ai_model || getDefaultModelForProvider(aiProvider);
        masterKey = globalSettings.api_key || globalSettings.openai_api_key || masterKey;
      }
    } catch (e: any) {
      console.error('[Global Settings] Error fetching settings (might not exist):', e.message);
    }
    
    // Use master key instead of cardData.settings.openAIApiKey
    const apiKeyToUse = masterKey || (cardData.settings ? cardData.settings.openAIApiKey : '');
    if (cardData.settings) {
      cardData.settings.openAIApiKey = apiKeyToUse;
    }

    const settings = tenantSettings.get(tenantId) || {};
    
    // Live Translation Engine (Dynamic Provider & Model)
    if (settings.translationEnabled && settings.translationTarget && cardData.content && apiKeyToUse) {
      try {
        console.log(`[Translation] Translating to ${settings.translationTarget} via ${aiProvider} (${aiModel})...`);
        const prompt = `Translate the following text to ${settings.translationTarget}. Provide ONLY the translation and nothing else:\n\n${cardData.content}`;
        let translatedText = "";

        if (aiProvider === 'gemini') {
          const genAI = new GoogleGenAI({ apiKey: apiKeyToUse });
          const response = await genAI.models.generateContent({
            model: aiModel,
            contents: prompt,
          });
          translatedText = response.text?.trim() || "";
        } else if (aiProvider === 'claude' || aiProvider === 'anthropic') {
          const anthropic = new Anthropic({ apiKey: apiKeyToUse });
          const msg = await anthropic.messages.create({
            model: aiModel,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
          });
          // @ts-ignore
          translatedText = msg.content[0]?.text || "";
        } else if (aiProvider === 'openrouter') {
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKeyToUse}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [{ role: "user", content: prompt }]
            })
          });
          const json = await res.json();
          translatedText = json.choices[0]?.message?.content?.trim() || "";
        } else {
          // Default: OpenAI
          const openai = new OpenAI({ apiKey: apiKeyToUse });
          const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: aiModel,
          });
          translatedText = completion.choices[0]?.message?.content?.trim() || "";
        }

        if (translatedText) {
          cardData.content = `${cardData.content}\n\n[${settings.translationTarget}] ${translatedText}`;
        }
      } catch (e: any) {
        console.error('[Translation Error]:', e);
        socket.emit('toast_error', `Translation failed via ${aiProvider}: ${e.message}`);
      }
    }

    // Update memory state
    tenantLiveCards[tenantId] = cardData;

    io.to(tenantId).emit('live_card', cardData);

    // Emit local API triggers back to the specific client's browser!
    socket.emit('trigger_local_api', {
      action: 'push_live',
      type: cardData.type,
      content: cardData.content,
      scriptureReference: cardData.scriptureReference,
      holyrics: { enabled: settings.holyricsEnabled, ip: settings.holyricsIp, port: settings.holyricsPort, token: settings.holyricsToken },
      proPresenter: { enabled: settings.proPresenterEnabled, ip: settings.proPresenterIp, port: settings.proPresenterPort },
      vmix: { enabled: settings.vmixEnabled, ip: settings.vmixIp, input: settings.vmixInput }
    });

    if (activeSessionId) {
      try {
        await supabase.from('transcription_logs').insert({
          session_id: activeSessionId,
          timestamp: new Date().toISOString(),
          type: 'card',
          content: `[CARD PUSHED] ${cardData.content}`,
          tenant_id: tenantId
        });
      } catch (e) {
        console.error('[Session] Error logging card:', e);
      }
    }
  });

  // Clear Live
  socket.on('clear_live', async () => {
    delete tenantLiveCards[tenantId];
    io.to(tenantId).emit('clear_live');
    const settings = tenantSettings.get(tenantId) || {};

    // Emit local API triggers back to the specific client's browser!
    socket.emit('trigger_local_api', {
      action: 'clear_live',
      holyrics: { enabled: settings.holyricsEnabled, ip: settings.holyricsIp, port: settings.holyricsPort, token: settings.holyricsToken },
      proPresenter: { enabled: settings.proPresenterEnabled, ip: settings.proPresenterIp, port: settings.proPresenterPort },
      vmix: { enabled: settings.vmixEnabled, ip: settings.vmixIp, input: settings.vmixInput }
    });
  });

  // ---- Bible Browser Events ----
  socket.on('get_bible_books', () => {
    socket.emit('bible_books', BIBLE_BOOKS);
  });

  socket.on('get_bible_chapter', async ({ book, chapter, version }) => {
    version = version || 'KJV';
    let results: any[] = [];

    try {
      const { data } = await supabase.from('bible_verses')
        .select('*').eq('tenant_id', tenantId)
        .ilike('book', book).eq('chapter', chapter)
        .eq('version', version.toUpperCase()) // Filter by version in local DB too
        .order('verse', { ascending: true });
      if (data && data.length > 0) {
        results = data;
      }
    } catch (err) {
      console.error('[Bible] Local fetch error:', err);
    }

    if (results.length === 0) {
      // First try bible-api.com with a 5-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const query = `${book} ${chapter}`;
        const res = await fetch(`https://bible-api.com/${encodeURIComponent(query)}?translation=${version}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            if (data.verses && Array.isArray(data.verses)) {
              results = data.verses.map((v: any) => ({
                book: data.reference.split(' ')[0], // Approximate
                chapter: v.chapter,
                verse: v.verse,
                text: v.text.trim(),
                version: version
              }));
            }
          } catch (e) {
            console.error('[Bible] bible-api.com returned non-JSON:', text.substring(0, 50));
          }
        }
      } catch (e: any) {
        clearTimeout(timeoutId);
        console.error('[Bible] bible-api.com Remote API error:', e.message);
      }
    }

    if (results.length === 0) {
      // Fallback to bolls.life API (supports NIV, ESV, etc)
      try {
        const bookIdx = BIBLE_BOOKS.findIndex(b => b.book.toLowerCase() === book.toLowerCase());
        if (bookIdx >= 0) {
          const bookId = bookIdx + 1;
          const res = await fetch(`https://bolls.life/get-chapter/${version}/${bookId}/${chapter}/`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              results = data.map((v: any) => ({
                book: book,
                chapter: chapter,
                verse: v.verse,
                // Strip HTML tags like <br/> that Bolls includes
                text: v.text.replace(/<[^>]+>/g, '').trim(),
                version: version
              }));
            }
          }
        }
      } catch (e: any) {
        console.error('[Bible] bolls.life Remote API error:', e.message);
      }
    }
    // Deduplicate verses by verse number in case DB has duplicates
    const uniqueVerses = [];
    const seen = new Set();
    for (const v of results) {
      if (!seen.has(v.verse)) {
        seen.add(v.verse);
        uniqueVerses.push(v);
      }
    }

    socket.emit('bible_chapter_data', { book, chapter, verses: uniqueVerses });
  });

  socket.on('bible_search', async ({ query }) => {
    try {
      const { data } = await supabase.from('bible_verses')
        .select('*').eq('tenant_id', tenantId)
        .ilike('text', `%${query}%`).limit(50);
      socket.emit('bible_search_results', data || []);
    } catch (e) {
      console.error('[Bible] Search error:', e);
      socket.emit('bible_search_results', []);
    }
  });

  socket.on('update_settings', async (settings: any) => {
    tenantSettings.set(tenantId, settings);
    io.to(tenantId).emit('settings_updated', settings);
    
    try {
      // Upsert into system_settings
      const { data: existing } = await supabase.from('system_settings').select('id').eq('tenant_id', tenantId).single();
      if (existing) {
        await supabase.from('system_settings').update({ settings, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId);
      } else {
        await supabase.from('system_settings').insert({ tenant_id: tenantId, settings });
      }
    } catch (e) {
      console.error('[Settings] Failed to save settings to DB:', e);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ---- REST API ----
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Context Engine Backend Running' });
});

app.get('/api/verses/:book/:chapter/:verse', async (req, res) => {
  const { book, chapter, verse } = req.params;
  const version = (req.query.version as string) || 'KJV';
  const tenantId = req.headers['x-tenant-id']; // Example way to pass tenantId to REST
  
  if (!tenantId) {
    return res.status(401).json({ error: 'Missing x-tenant-id header' });
  }

  try {
    const { data: row } = await supabase.from('bible_verses')
      .select('*')
      .ilike('book', `%${book}%`)
      .eq('chapter', parseInt(chapter))
      .eq('verse', parseInt(verse))
      .eq('version', version)
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'Verse not found' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/knowledge/:keyword', async (req, res) => {
  const { keyword } = req.params;
  const tenantId = req.headers['x-tenant-id'];
  
  if (!tenantId) {
    return res.status(401).json({ error: 'Missing x-tenant-id header' });
  }

  try {
    const { data: row } = await supabase.from('knowledge_cards')
      .select('*')
      .ilike('keyword', `%${keyword}%`)
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'Keyword not found' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Paystack Payment Verification Endpoint
app.post('/api/verify_payment', async (req, res) => {
  const { reference } = req.body;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing auth token' });
  
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  // Verify the reference with Paystack's API using the Secret Key.
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) return res.status(500).json({ error: 'Server missing Paystack secret' });

  try {
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` }
    });
    const verifyData = await verifyRes.json();
    
    if (!verifyData.status || verifyData.data.status !== 'success') {
      return res.status(400).json({ error: 'Payment verification failed' });
    }
    
    // Check if the amount matches what we expect (e.g. 15000 NGN = 1500000 kobo)
    // if (verifyData.data.amount < 1500000) return res.status(400).json({ error: 'Insufficient amount' });

  } catch (e) {
    return res.status(500).json({ error: 'Error connecting to Paystack' });
  }
  try {
    const { error: dbError } = await supabase
      .from('user_profiles')
      .update({ subscription_status: 'active' })
      .eq('id', user.id);
    
    if (dbError) throw dbError;
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database update failed' });
  }
});

// ---- Admin Middleware ----
const adminCheck = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    if (user.email !== 'ronimationstudios@gmail.com') return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

function getDefaultModelForProvider(provider: string) {
  if (provider === 'gemini') return 'gemini-2.5-flash';
  if (provider === 'claude') return 'claude-3-5-sonnet-20240620';
  if (provider === 'openrouter') return 'openai/gpt-4o-mini';
  return 'gpt-4o-mini';
}

// ---- Admin Endpoints ----
app.get('/api/admin/users', adminCheck, async (req, res) => {
  try {
    const { data, error } = await supabase.from('user_profiles').select('*');
    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/update_user', adminCheck, async (req, res) => {
  const { userId, subscription_status, trial_ends_at } = req.body;
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ subscription_status, trial_ends_at })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/settings', adminCheck, async (req, res) => {
  const { openai_api_key, ai_provider, ai_model, api_key } = req.body;
  try {
    const payload: any = {};
    if (ai_provider !== undefined) payload.ai_provider = ai_provider;
    if (ai_model !== undefined) payload.ai_model = ai_model;
    if (api_key !== undefined) payload.api_key = api_key;
    if (openai_api_key !== undefined) payload.openai_api_key = openai_api_key;

    // First fetch the existing row to get its UUID
    const { data: existingRow, error: fetchErr } = await supabase
      .from('global_settings')
      .select('*')
      .limit(1)
      .single();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      throw fetchErr;
    }

    let result;
    if (existingRow) {
      // Update using actual UUID
      const { data, error } = await supabase
        .from('global_settings')
        .update(payload)
        .eq('id', existingRow.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Insert new row
      const { data, error } = await supabase
        .from('global_settings')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json(result);
  } catch (e: any) {
    console.error("Settings Update Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/settings', adminCheck, async (req, res) => {
  try {
    const { data, error } = await supabase.from('global_settings').select('*').single();
    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/update_user', adminCheck, async (req, res) => {
  const { userId, subscription_status, trial_ends_at } = req.body;
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ 
        subscription_status, 
        trial_ends_at: trial_ends_at ? new Date(trial_ends_at).toISOString() : null 
      })
      .eq('id', userId)
      .select();
    
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// User Trial Initialization
app.post('/api/user/init_trial', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    
    // Check if profile exists
    const { data: existing, error: existingErr } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) {
      // If they have a church name in metadata but it's missing in the profile, update it
      if (user.user_metadata?.church_name && !existing.church_name) {
        await supabase.from('user_profiles').update({ church_name: user.user_metadata.church_name }).eq('id', user.id);
      }
      return res.json({ success: true, message: 'Profile already exists', data: existing });
    }

    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 7);

    const { data, error: insertErr } = await supabase.from('user_profiles').insert({
      id: user.id,
      email: user.email,
      subscription_status: 'trial',
      trial_ends_at: trialEnds.toISOString(),
      church_name: user.user_metadata?.church_name || null
    }).select().single();

    if (insertErr) throw insertErr;
    res.json({ success: true, data });
  } catch (e: any) {
    console.error("Trial Init Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Admin Analytics Endpoint
app.get('/api/admin/analytics', adminCheck, async (req, res) => {
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    
    const count = users.users.length;

    // io.engine.clientsCount provides the number of active raw socket connections.
    const activeConnections = io.engine.clientsCount;

    res.json({ totalUsers: count || 0, activeConnections });
  } catch (e: any) {
    console.error("Admin Analytics Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Serve frontend static files (from Docker container)
const frontendPath = path.join(__dirname, '../../frontend/out');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
server.listen(Number(PORT), HOST, () => {
  console.log(`[Backend] Context Engine server listening on http://${HOST}:${PORT}`);
});

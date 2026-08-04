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

dotenv.config();

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
  try {
    const { data: verses } = await supabase.from('bible_verses')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('book', `%${book}%`)
      .eq('chapter', chapter)
      .eq('verse', verse)
      .limit(1);
    
    if (verses && verses.length > 0) {
      const v = verses[0];
      return `${v.book} ${v.chapter}:${v.verse} (${v.version.toUpperCase()}) — ${v.text}`;
    }
  } catch (e) {
    console.error('[NLP] Error querying local bible_verses:', e);
  }

  try {
    const version = settings.defaultBibleVersion || 'kjv';
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

  // Handle get_live_card request from output screen
  socket.on('get_live_card', () => {
    if (tenantLiveCards[tenantId]) {
      socket.emit('live_card', tenantLiveCards[tenantId]);
    } else {
      socket.emit('clear_live');
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
      
      const { data: songRecord, error: songErr } = await supabase.from('songs')
        .insert({ title: songData.title, artist: songData.artist || 'Unknown', tenant_id: tenantId })
        .select()
        .single();
      
      if (songErr || !songRecord) throw new Error("Failed to insert song: " + songErr?.message);

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
      socket.emit('song_lyrics_data', { title: song.title, artist: song.artist, lyrics: combinedLyrics });
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
                content: `**${row.keyword}**\n${row.fact}`,
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
1. If the user is quoting a scripture directly (e.g. "Who comforted us in all tribulations") OR referencing one (e.g. "1 Timothy 3:4"), identify the correct biblical reference and extract it as type="scripture". Do NOT extract the quoted words, ONLY extract the formal Book Chapter:Verse reference (e.g. "2 Corinthians 1:4").
2. If the user states an important fact, deep quote, or general knowledge point, extract a concise summary of it as type="knowledge". This applies to ALL fields of study (history, science, business, tech, sports, medicine), not just religion! Be highly aggressive in extracting general knowledge concepts.
3. If they mention they are going to sing a song, or they start singing/reciting lyrics to a known worship song, extract the title of the song as type="song" (e.g. "Way Maker").
Return a JSON object with a single key 'data' containing an array of objects with 'type' ('scripture', 'knowledge', or 'song') and 'content' (the extracted text/reference or song title). If nothing important, return {"data": []}.
Target mode: ${settings.aiExtractionTarget || 'all'} (if 'scriptures', ONLY extract scriptures. if 'knowledge', ONLY extract knowledge. if 'all', extract everything).

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
              // The AI returns content like "Matthew 18:32"
              const match = item.content.match(/([1-3]?\s?[A-Za-z]+)\s+(\d+):(\d+)/);
              let cardContent = null;
              if (match) {
                cardContent = await fetchScriptureLocalOrRemote(match[1].trim(), parseInt(match[2]), parseInt(match[3]), tenantId, settings);
              } else {
                 // Fallback if regex fails to parse AI format
                 const version = settings.defaultBibleVersion || 'kjv';
                 const res = await fetch(`https://bible-api.com/${encodeURIComponent(item.content)}?translation=${version}`);
                 if (res.ok) {
                   const data = await res.json();
                   cardContent = `${data.reference} (${data.translation_id.toUpperCase()}) — ${data.text.trim()}`;
                 }
              }

              if (cardContent) {
                const card = {
                  id: `card-${cardIdCounter++}`,
                  type: 'scripture' as const,
                  content: cardContent,
                  preset: settings.scripturePosition || 'full-screen',
                };
                io.to(tenantId).emit('staging_card', card);
              }
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
      content: cardData.content,
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

  socket.on('update_settings', (settings: any) => {
    tenantSettings.set(tenantId, settings);
    io.to(tenantId).emit('settings_updated', settings);
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

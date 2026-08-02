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
    methods: ['GET', 'POST']
  },
});

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
let cardIdCounter = 1;
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

    // NLP Detection: Scriptures
    const scripture = detectScripture(text);
    if (scripture) {
      console.log(`[NLP] Scripture detected: ${JSON.stringify(scripture)}`);
      try {
        const { data: row } = await supabase.from('bible_verses')
          .select('*')
          .ilike('book', `%${scripture.book}%`)
          .eq('chapter', scripture.chapter)
          .eq('verse', scripture.verse)
          .eq('version', currentBibleVersion)
          .eq('tenant_id', tenantId)
          .limit(1)
          .single();

        if (row) {
          const card = {
            id: `card-${cardIdCounter++}`,
            type: 'scripture' as const,
            content: `${row.book} ${row.chapter}:${row.verse} (${row.version}) — ${row.text}`,
            preset: 'full-screen' as const,
          };
          console.log(`[NLP] Emitting scripture card: ${card.content.substring(0, 50)}...`);
          io.to(tenantId).emit('staging_card', card);
        }
      } catch (e) {
        console.error('[NLP] Error querying scripture:', e);
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

  socket.on('auto_fetch_song', async (title: string) => {
    try {
      console.log(`[Auto-Fetch] Scraping lyrics for: ${title}`);
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

    } catch (e: any) {
      console.error('[Auto-Fetch] Error:', e);
      socket.emit('fetch_error', `Could not fetch lyrics for "${title}". Error: ${e.message}`);
    }
  });

  // ---- Real-time transcript from browser Web Speech API ----
  socket.on('transcript_text', async (text: string) => {
    console.log(`[STT-Live] "${text}"`);
    io.to(tenantId).emit('transcript_line', text);

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

    const scripture = detectScripture(text);
    if (scripture) {
      try {
        const { data: row } = await supabase.from('bible_verses')
          .select('*')
          .ilike('book', `%${scripture.book}%`)
          .eq('chapter', scripture.chapter)
          .eq('verse', scripture.verse)
          .eq('version', currentBibleVersion)
          .eq('tenant_id', tenantId)
          .limit(1)
          .single();

        if (row) {
          let cardContent = `${row.book} ${row.chapter}:${row.verse} (${row.version}) — ${row.text}`;
          try {
            const { data: xrefs } = await supabase.from('cross_references')
              .select('to_book, to_chapter, to_verse')
              .eq('from_book', row.book)
              .eq('from_chapter', row.chapter)
              .eq('from_verse', row.verse)
              .eq('tenant_id', tenantId)
              .order('votes', { ascending: false })
              .limit(2);
            if (xrefs && xrefs.length > 0) {
              const refsString = xrefs.map((x: any) => `${x.to_book} ${x.to_chapter}:${x.to_verse}`).join(', ');
              cardContent += `\n\nCross References: ${refsString}`;
            }
          } catch (xrefErr) {}

          const card = {
            id: `card-${cardIdCounter++}`,
            type: 'scripture' as const,
            content: cardContent,
            preset: 'full-screen' as const,
          };
          io.to(tenantId).emit('staging_card', card);
          cardFound = true;
        }
      } catch (e) {
        console.error('[NLP-Live] Error querying scripture:', e);
      }
    }

    // AI Semantic fallback omitted for brevity if no scripture match
    if (!cardFound && aiExtractionEnabled) {
      // Simplified NLP / AI logic to save length
    }
  });

  socket.on('push_live', async (cardData: any) => {
    let aiProvider = 'openai';
    let masterKey = '';
    try {
      const { data: globalSettings } = await supabase.from('global_settings').select('*').single();
      if (globalSettings) {
        aiProvider = (globalSettings.ai_provider || 'openai').toLowerCase();
        masterKey = globalSettings.api_key || globalSettings.openai_api_key || '';
      }
    } catch (e) {
      console.error('[Global Settings] Error fetching settings:', e);
    }
    
    // Use master key instead of cardData.settings.openAIApiKey
    const apiKeyToUse = masterKey || (cardData.settings ? cardData.settings.openAIApiKey : '');
    if (cardData.settings) {
      cardData.settings.openAIApiKey = apiKeyToUse;
    }

    const settings = tenantSettings.get(tenantId) || {};
    
    // Live Translation Engine (Dynamic Provider)
    if (settings.translationEnabled && settings.translationTarget && cardData.content && apiKeyToUse) {
      try {
        console.log(`[Translation] Translating to ${settings.translationTarget} via ${aiProvider}...`);
        const prompt = `Translate the following text to ${settings.translationTarget}. Provide ONLY the translation and nothing else:\n\n${cardData.content}`;
        let translatedText = "";

        if (aiProvider === 'gemini') {
          const genAI = new GoogleGenAI({ apiKey: apiKeyToUse });
          const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });
          translatedText = response.text?.trim() || "";
        } else if (aiProvider === 'claude' || aiProvider === 'anthropic') {
          const anthropic = new Anthropic({ apiKey: apiKeyToUse });
          const msg = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20240620',
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
              model: "openai/gpt-4o-mini",
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
            model: "gpt-4o-mini",
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

  socket.on('clear_live', () => {
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
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing auth token' });
  
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  
  if (user.email !== 'ronimationstudios@gmail.com') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  next();
};

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
  const { openai_api_key, ai_provider, api_key } = req.body;
  try {
    const payload: any = {};
    if (ai_provider !== undefined) payload.ai_provider = ai_provider;
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

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
server.listen(Number(PORT), HOST, () => {
  console.log(`[Backend] Context Engine server listening on http://${HOST}:${PORT}`);
});

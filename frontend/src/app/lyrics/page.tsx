"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { GraphicsSettings, StagingCard } from "../page";
import { supabase } from "../../lib/supabaseClient";

export default function LyricsBrowser() {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  const [socketConnected, setSocketConnected] = useState(false);
  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings | null>(null);

  const [session, setSession] = useState<any>(null);

  const [songs, setSongs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSong, setSelectedSong] = useState<string | null>(null);

  const [songSections, setSongSections] = useState<{name: string, text: string}[]>([]);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  const [liveCard, setLiveCard] = useState<any>(null);
  
  const sectionsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const storedSettings = localStorage.getItem("contextEngineSettings");
    if (storedSettings) {
      setGraphicsSettings(JSON.parse(storedSettings));
    }
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://context-engine-production-51a1.up.railway.app";
    
    socketRef.current = io(backendUrl, {
      auth: { token: session.access_token }
    });

    socketRef.current.on("connect", () => {
      setSocketConnected(true);
      
      const storedSettings = localStorage.getItem("contextEngineSettings");
      if (storedSettings) {
        socketRef.current?.emit("update_settings", JSON.parse(storedSettings));
      }
    });

    socketRef.current.on("disconnect", () => setSocketConnected(false));

    socketRef.current.on("songs_list", (data: string[]) => {
      setSongs(data || []);
    });

    socketRef.current.on("song_lyrics_result", (data) => {
      setLoadingLyrics(false);
      if (data && data.lyrics) {
        // Parse the lyrics
        const parts = data.lyrics.split(/\n\n+/);
        const sections = [];
        for (const part of parts) {
          const lines = part.trim().split('\n');
          if (lines[0] && lines[0].startsWith('[') && lines[0].endsWith(']')) {
            const name = lines[0].slice(1, -1);
            const text = lines.slice(1).join('\n');
            sections.push({ name, text });
          } else {
            sections.push({ name: 'Section', text: part.trim() });
          }
        }
        setSongSections(sections);
        setSelectedSectionIndex(null);
      } else {
        setSongSections([]);
        setSelectedSectionIndex(null);
      }
    });

    socketRef.current.on("live_card", (cardData) => {
      setLiveCard(cardData);
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
    });

    const BIBLE_BOOKS = [
      "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
      "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
      "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
      "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
      "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
      "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
      "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
      "Zephaniah", "Haggai", "Zechariah", "Malachi",
      "Matthew", "Mark", "Luke", "John", "Acts",
      "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
      "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
      "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
      "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
      "Jude", "Revelation"
    ];

    function getHolyricsVerseId(reference: string) {
      const match = reference.match(/^(\d?\s*[a-zA-Z\s]+)\s+(\d+):(\d+)/);
      if (!match) return null;
      const bookName = match[1].trim();
      const chapter = parseInt(match[2], 10);
      const verse = parseInt(match[3], 10);
      
      const bookIndex = BIBLE_BOOKS.findIndex(b => b.toLowerCase() === bookName.toLowerCase());
      if (bookIndex === -1) return null;
      
      const bb = String(bookIndex + 1).padStart(2, '0');
      const ccc = String(chapter).padStart(3, '0');
      const vvv = String(verse).padStart(3, '0');
      return `${bb}${ccc}${vvv}`;
    }

    // Cloud-to-Local Bridge: Execute local network requests from the browser
    socketRef.current.on("trigger_local_api", (data: any) => {
      console.log("[Bridge] Triggering Local API:", data.action);
      
      if (data.action === 'push_live') {
        if (data.holyrics && data.holyrics.enabled) {
          // 1. Send to Stage Monitor (Communication Panel)
          const stageUrl = `http://${data.holyrics.ip}:${data.holyrics.port}/api/SetTextCP`;
          const stagePayload = { text: data.content, show: true, display_ahead: true };
          fetch(stageUrl + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stagePayload)
          }).catch(e => console.error('[Bridge] Holyrics Stage Monitor Error:', e.message));

          // 2. Send to Main Screen
          if (data.type === 'scripture' && data.scriptureReference) {
            const verseId = getHolyricsVerseId(data.scriptureReference);
            if (verseId) {
              const mainUrl = `http://${data.holyrics.ip}:${data.holyrics.port}/api/ShowVerse`;
              const mainPayload = { id: verseId, references: data.scriptureReference };
              fetch(mainUrl + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mainPayload)
              }).then(async (res) => {
                if (!res.ok) {
                  const text = await res.text();
                  console.error('[Bridge] Holyrics ShowVerse HTTP Error:', res.status, text);
                  throw new Error("ShowVerse failed");
                }
              }).catch(e => {
                console.error('[Bridge] Holyrics ShowVerse Error:', e.message);
                const fallbackUrl = `http://${data.holyrics.ip}:${data.holyrics.port}/api/CreateText`;
                fetch(fallbackUrl + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: data.content, show: true, display_ahead: true })
                });
              });
            } else {
              console.warn('[Bridge] Failed to map scripture reference to Holyrics ID:', data.scriptureReference);
              const fallbackUrl = `http://${data.holyrics.ip}:${data.holyrics.port}/api/CreateText`;
              fetch(fallbackUrl + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: data.content, show: true, display_ahead: true })
              });
            }
          } else {
            // Use CreateText for Lyrics & Knowledge
            const mainUrl = `http://${data.holyrics.ip}:${data.holyrics.port}/api/CreateText`;
            const mainPayload = { text: data.content, show: true, display_ahead: true };
            fetch(mainUrl + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mainPayload)
            }).then(async (res) => {
              if (!res.ok) {
                const text = await res.text();
                console.error('[Bridge] Holyrics HTTP Error:', res.status, text);
              }
            }).catch(e => console.error('[Bridge] Holyrics Network Error:', e.message));
          }
        }
        if (data.proPresenter && data.proPresenter.enabled) {
          const proUrl = `http://${data.proPresenter.ip}:${data.proPresenter.port}/v1/message/1/trigger`;
          const payload = [{ name: 'Message', text: { text: data.content } }];
          fetch(proUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(e => console.error('[Bridge] ProPresenter Error:', e.message));
        }
        if (data.vmix && data.vmix.enabled) {
          const vmixUrl = `http://${data.vmix.ip}:8088/api/?Function=SetText&Input=${encodeURIComponent(data.vmix.input)}&Value=${encodeURIComponent(data.content)}`;
          fetch(vmixUrl, { mode: 'no-cors' }).catch(e => console.error('[Bridge] vMix Error:', e.message));
        }
      } else if (data.action === 'clear_live') {
        if (data.holyrics && data.holyrics.enabled) {
          const stageUrl = `http://${data.holyrics.ip}:${data.holyrics.port}/api/SetTextCP`;
          fetch(stageUrl + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: "", show: false })
          }).catch(e => console.error('[Bridge] Holyrics Stage Error:', e.message));

          const mainUrl = `http://${data.holyrics.ip}:${data.holyrics.port}/api/ShowText`;
          fetch(mainUrl + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: "", quick_presentation: true })
          }).catch(e => console.error('[Bridge] Holyrics Main Error:', e.message));
        }
        if (data.proPresenter && data.proPresenter.enabled) {
          fetch(`http://${data.proPresenter.ip}:${data.proPresenter.port}/v1/message/1/clear`, {
            method: 'GET'
          }).catch(e => console.error('[Bridge] ProPresenter Error:', e.message));
        }
        if (data.vmix && data.vmix.enabled) {
          const vmixUrl = `http://${data.vmix.ip}:8088/api/?Function=SetText&Input=${encodeURIComponent(data.vmix.input)}&Value=`;
          fetch(vmixUrl, { mode: 'no-cors' }).catch(e => console.error('[Bridge] vMix Error:', e.message));
        }
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [session?.access_token]);

  // Keyboard navigation & Shortcuts
  const pushLiveSection = useCallback((index: number) => {
    if (!selectedSong) return;
    const section = songSections[index];
    if (!section) return;

    socketRef.current?.emit("push_live", {
      id: `card-${Date.now()}`,
      type: "lyric",
      content: `${selectedSong} - ${section.name}\n\n${section.text}`,
      preset: graphicsSettings?.lyricsPosition || "lower-third",
      songSections: songSections
    });
  }, [selectedSong, songSections, graphicsSettings]);

  const clearLive = useCallback(() => {
    socketRef.current?.emit("clear_live");
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        setSelectedSectionIndex(prev => {
          const next = prev === null ? 0 : Math.min(prev + 1, songSections.length - 1);
          pushLiveSection(next);
          return next;
        });
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        setSelectedSectionIndex(prev => {
          const next = prev === null ? 0 : Math.max(prev - 1, 0);
          pushLiveSection(next);
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSectionIndex !== null) {
          pushLiveSection(selectedSectionIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        clearLive();
        break;
      case 'b':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          router.push('/');
        }
        break;
    }
  }, [songSections, selectedSectionIndex, pushLiveSection, clearLive, router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll active section into view
  useEffect(() => {
    if (selectedSectionIndex !== null && sectionsListRef.current) {
      const el = sectionsListRef.current.children[selectedSectionIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedSectionIndex]);

  const filteredSongs = songs.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="hb-page" style={{ display: 'flex', flexDirection: 'row', width: '100vw' }}>
      {/* ── LEFT: The Song List ── */}
      <div className="hb-reading-pane" style={{ width: '300px', flexShrink: 0 }}>
        <div className="hb-reading-header">
          <div className="hb-reading-ref">🎵 Lyrics Browser</div>
          <div className="hb-connection-dot" style={{ background: socketConnected ? '#22c55e' : '#ef4444' }} />
        </div>
        
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <input 
            type="text" 
            placeholder="Search songs..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              background: 'rgba(255,255,255,0.1)', 
              border: '1px solid rgba(255,255,255,0.2)', 
              color: 'white', 
              padding: '8px 12px', 
              borderRadius: '6px', 
              outline: 'none',
              fontSize: '0.85rem'
            }}
          />
        </div>

        <div className="hb-verse-list" style={{ flex: 1, overflowY: 'auto' }}>
          {songs.length === 0 && (
            <div className="hb-loading">No songs found...</div>
          )}
          {filteredSongs.map((song, i) => (
            <div
              key={i}
              className={`hb-verse-line ${selectedSong === song ? 'active' : ''}`}
              onClick={() => {
                setSelectedSong(song);
                setLoadingLyrics(true);
                setSongSections([]);
                setSelectedSectionIndex(null);
                socketRef.current?.emit('get_song_lyrics', song);
              }}
            >
              <span className="hb-verse-text" style={{ fontWeight: 500 }}>{song}</span>
            </div>
          ))}
        </div>

        <div className="hb-action-bar">
          <button className="hb-action-btn" onClick={() => router.push('/')} data-tooltip="Ctrl + B">🎛️ Dashboard</button>
        </div>
      </div>

      {/* ── MIDDLE: The Song Sections ── */}
      <div className="hb-grids-panel" style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="hb-section">
          <div className="hb-section-label" style={{ fontSize: '1rem', padding: '10px 0', color: '#fff' }}>
            {selectedSong ? selectedSong : 'Select a song to view lyrics'}
          </div>
        </div>

        <div className="hb-verse-list" ref={sectionsListRef} style={{ padding: 0, gap: '10px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {loadingLyrics && <div className="hb-loading">Loading lyrics...</div>}
          {!loadingLyrics && songSections.map((sec, i) => (
            <div
              key={i}
              className={`hb-verse-line ${selectedSectionIndex === i ? 'active' : ''}`}
              style={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '16px',
                background: selectedSectionIndex === i ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                borderLeft: `4px solid ${selectedSectionIndex === i ? '#8b5cf6' : 'transparent'}`,
                cursor: 'pointer'
              }}
              onClick={() => {
                setSelectedSectionIndex(i);
                pushLiveSection(i);
              }}
            >
              <span style={{ fontWeight: 'bold', color: '#c4b5fd', marginBottom: '8px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {sec.name}
              </span>
              <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.95rem' }}>
                {sec.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: The Live Output Preview ── */}
      <div className="hb-reading-pane" style={{ width: '400px', flexShrink: 0 }}>
        <div className="hb-reading-header" style={{ justifyContent: 'space-between' }}>
          <div className="hb-reading-ref" style={{ color: '#fff' }}>Live Output Preview</div>
          <button className="hb-action-btn danger" onClick={clearLive} style={{ maxWidth: '80px', padding: '4px 12px' }}>✕ Clear</button>
        </div>

        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            flex: 1,
            background: '#000',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '30px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
          }}>
            {liveCard && liveCard.content ? (
              <div style={{
                color: '#fff',
                fontSize: '1.4rem',
                fontWeight: 600,
                whiteSpace: 'pre-wrap',
                textAlign: 'center',
                textShadow: '0 4px 12px rgba(0,0,0,0.8)',
                lineHeight: 1.5,
                zIndex: 2
              }}>
                {liveCard.content}
              </div>
            ) : (
              <div style={{ color: '#555', fontSize: '0.9rem' }}>No active content</div>
            )}
          </div>
          
          {liveCard && liveCard.content && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.7rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Current Status</div>
              <div style={{ fontSize: '0.85rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#34d399', borderRadius: '50%', boxShadow: '0 0 8px #34d399' }}></span>
                ON AIR
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

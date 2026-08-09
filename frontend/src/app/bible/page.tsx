"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { GraphicsSettings, StagingCard } from "../page";
import { supabase } from "../../lib/supabaseClient";

/* ── Book Metadata with abbreviations & color groups ── */
const BOOK_META: { abbr: string; name: string; group: string }[] = [
  // Old Testament
  { abbr: "Gn", name: "Genesis", group: "pentateuch" },
  { abbr: "Ex", name: "Exodus", group: "pentateuch" },
  { abbr: "Lv", name: "Leviticus", group: "pentateuch" },
  { abbr: "Nm", name: "Numbers", group: "pentateuch" },
  { abbr: "Dt", name: "Deuteronomy", group: "pentateuch" },
  { abbr: "Js", name: "Joshua", group: "history" },
  { abbr: "Jg", name: "Judges", group: "history" },
  { abbr: "Rt", name: "Ruth", group: "history" },
  { abbr: "1Sm", name: "1 Samuel", group: "history" },
  { abbr: "2Sm", name: "2 Samuel", group: "history" },
  { abbr: "1Rs", name: "1 Kings", group: "history" },
  { abbr: "2Rs", name: "2 Kings", group: "history" },
  { abbr: "1Cr", name: "1 Chronicles", group: "history" },
  { abbr: "2Cr", name: "2 Chronicles", group: "history" },
  { abbr: "Ed", name: "Ezra", group: "history" },
  { abbr: "Ne", name: "Nehemiah", group: "history" },
  { abbr: "Et", name: "Esther", group: "history" },
  { abbr: "Jb", name: "Job", group: "poetry" },
  { abbr: "Ps", name: "Psalms", group: "poetry" },
  { abbr: "Pv", name: "Proverbs", group: "poetry" },
  { abbr: "Ec", name: "Ecclesiastes", group: "poetry" },
  { abbr: "Ct", name: "Song of Solomon", group: "poetry" },
  { abbr: "Is", name: "Isaiah", group: "major-prophet" },
  { abbr: "Jr", name: "Jeremiah", group: "major-prophet" },
  { abbr: "Lm", name: "Lamentations", group: "major-prophet" },
  { abbr: "Ez", name: "Ezekiel", group: "major-prophet" },
  { abbr: "Dn", name: "Daniel", group: "major-prophet" },
  { abbr: "Os", name: "Hosea", group: "minor-prophet" },
  { abbr: "Jl", name: "Joel", group: "minor-prophet" },
  { abbr: "Am", name: "Amos", group: "minor-prophet" },
  { abbr: "Ob", name: "Obadiah", group: "minor-prophet" },
  { abbr: "Jn", name: "Jonah", group: "minor-prophet" },
  { abbr: "Mc", name: "Micah", group: "minor-prophet" },
  { abbr: "Na", name: "Nahum", group: "minor-prophet" },
  { abbr: "Hc", name: "Habakkuk", group: "minor-prophet" },
  { abbr: "Sf", name: "Zephaniah", group: "minor-prophet" },
  { abbr: "Ag", name: "Haggai", group: "minor-prophet" },
  { abbr: "Zc", name: "Zechariah", group: "minor-prophet" },
  { abbr: "Ml", name: "Malachi", group: "minor-prophet" },
  // New Testament
  { abbr: "Mt", name: "Matthew", group: "gospel" },
  { abbr: "Mk", name: "Mark", group: "gospel" },
  { abbr: "Lk", name: "Luke", group: "gospel" },
  { abbr: "Jo", name: "John", group: "gospel" },
  { abbr: "At", name: "Acts", group: "acts" },
  { abbr: "Rm", name: "Romans", group: "pauline" },
  { abbr: "1Co", name: "1 Corinthians", group: "pauline" },
  { abbr: "2Co", name: "2 Corinthians", group: "pauline" },
  { abbr: "Gl", name: "Galatians", group: "pauline" },
  { abbr: "Ef", name: "Ephesians", group: "pauline" },
  { abbr: "Fp", name: "Philippians", group: "pauline" },
  { abbr: "Cl", name: "Colossians", group: "pauline" },
  { abbr: "1Ts", name: "1 Thessalonians", group: "pauline" },
  { abbr: "2Ts", name: "2 Thessalonians", group: "pauline" },
  { abbr: "1Tm", name: "1 Timothy", group: "pauline" },
  { abbr: "2Tm", name: "2 Timothy", group: "pauline" },
  { abbr: "Tt", name: "Titus", group: "pauline" },
  { abbr: "Fm", name: "Philemon", group: "pauline" },
  { abbr: "Hb", name: "Hebrews", group: "general" },
  { abbr: "Tg", name: "James", group: "general" },
  { abbr: "1Pe", name: "1 Peter", group: "general" },
  { abbr: "2Pe", name: "2 Peter", group: "general" },
  { abbr: "1Jo", name: "1 John", group: "general" },
  { abbr: "2Jo", name: "2 John", group: "general" },
  { abbr: "3Jo", name: "3 John", group: "general" },
  { abbr: "Jd", name: "Jude", group: "general" },
  { abbr: "Ap", name: "Revelation", group: "apocalyptic" },
];

const GROUP_COLORS: Record<string, string> = {
  "pentateuch": "#4ade80",
  "history": "#f472b6",
  "poetry": "#60a5fa",
  "major-prophet": "#c084fc",
  "minor-prophet": "#a78bfa",
  "gospel": "#fb923c",
  "acts": "#f87171",
  "pauline": "#facc15",
  "general": "#2dd4bf",
  "apocalyptic": "#e879f9",
};

export default function BibleBrowser() {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  const [socketConnected, setSocketConnected] = useState(false);
  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings | null>(null);

  const [bibleBooks, setBibleBooks] = useState<{book: string, chapters: number}[]>([]);
  const [selectedBook, setSelectedBook] = useState<string>("John");
  const [selectedChapter, setSelectedChapter] = useState<number>(3);
  const [bibleVerses, setBibleVerses] = useState<any[]>([]);
  const [selectedVerseIndex, setSelectedVerseIndex] = useState<number | null>(null);
  const [loadingVerses, setLoadingVerses] = useState(false);

  const [version, setVersion] = useState("KJV");

  const [session, setSession] = useState<any>(null);
  const verseListRef = useRef<HTMLDivElement>(null);
  const numberBufferRef = useRef<string>("");
  const numberBufferTimeout = useRef<NodeJS.Timeout | null>(null);

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
      socketRef.current?.emit("get_bible_books");
    });

    socketRef.current.on("disconnect", () => setSocketConnected(false));

    socketRef.current.on("bible_books", (books) => {
      setBibleBooks(books);
    });

    socketRef.current.on("bible_chapter_data", (data) => {
      setBibleVerses(data.verses || []);
      setLoadingVerses(false);
      if (data.verses && data.verses.length > 0) {
        setSelectedVerseIndex(0);
      } else {
        setSelectedVerseIndex(null);
      }
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Bible Socket connection error:", err);
    });

    // Local API Trigger Listener (for Holyrics, ProPresenter, vMix)
    socketRef.current.on("trigger_local_api", (data: any) => {
      console.log("[Bridge] Triggering Local API:", data.action);
      
      if (data.action === 'push_live') {
        if (data.holyrics.enabled) {
          const url = `http://${data.holyrics.ip}:${data.holyrics.port}/api/SetTextCommunicationPanel`;
          const payload = { text: data.content, show: true, display_ahead: true };
          fetch(url + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(async (res) => {
            if (!res.ok) {
              const text = await res.text();
              console.error('[Bridge] Holyrics HTTP Error:', res.status, text);
              alert(`Holyrics Error: ${res.status} - ${text}`);
            }
          }).catch(e => {
            console.error('[Bridge] Holyrics Network Error:', e.message);
            alert(`Holyrics Network Error: ${e.message}`);
          });
        }
      } else if (data.action === 'clear_live') {
        if (data.holyrics.enabled) {
          const url = `http://${data.holyrics.ip}:${data.holyrics.port}/api/SetTextCommunicationPanel`;
          fetch(url + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: "", show: false })
          }).catch(e => console.error('[Bridge] Holyrics Network Error:', e.message));
        }
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [session?.access_token]);

  // Fetch chapter when book, chapter or version changes
  useEffect(() => {
    if (selectedBook && selectedChapter) {
      setLoadingVerses(true);
      setBibleVerses([]);
      setSelectedVerseIndex(null);
      socketRef.current?.emit("get_bible_chapter", { book: selectedBook, chapter: selectedChapter, version });
    }
  }, [selectedBook, selectedChapter, version]);

  // Scroll to selected verse in reading pane
  useEffect(() => {
    if (selectedVerseIndex !== null && verseListRef.current) {
      const el = verseListRef.current.children[selectedVerseIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedVerseIndex]);

  // Keyboard Shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        setSelectedVerseIndex(prev =>
          prev === null ? 0 : Math.min(prev + 1, bibleVerses.length - 1)
        );
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        setSelectedVerseIndex(prev =>
          prev === null ? 0 : Math.max(prev - 1, 0)
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedVerseIndex !== null && bibleVerses[selectedVerseIndex]) {
          pushLive(bibleVerses[selectedVerseIndex]);
        }
        break;
      case ' ':
        e.preventDefault();
        if (selectedVerseIndex !== null && bibleVerses[selectedVerseIndex]) {
          stageVerse(bibleVerses[selectedVerseIndex]);
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
      default:
        // Handle number typing for quick verse jump
        if (/[0-9]/.test(e.key)) {
          numberBufferRef.current += e.key;
          if (numberBufferTimeout.current) clearTimeout(numberBufferTimeout.current);
          
          numberBufferTimeout.current = setTimeout(() => {
            const targetVerse = parseInt(numberBufferRef.current, 10);
            if (!isNaN(targetVerse) && targetVerse >= 1 && targetVerse <= bibleVerses.length) {
              setSelectedVerseIndex(targetVerse - 1);
            }
            numberBufferRef.current = "";
          }, 600); // 600ms window to type multi-digit numbers
        }
        break;
    }
  }, [bibleVerses, selectedVerseIndex, router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getBookChapters = (bookName: string) => {
    const found = bibleBooks.find(b => b.book === bookName);
    return found ? found.chapters : 0;
  };

  const nextChapter = () => {
    const chapters = getBookChapters(selectedBook);
    if (selectedChapter < chapters) {
      setSelectedChapter(selectedChapter + 1);
    } else {
      const bookMeta = BOOK_META.find(b => b.name === selectedBook);
      if (bookMeta) {
        const idx = BOOK_META.indexOf(bookMeta);
        if (idx < BOOK_META.length - 1) {
          setSelectedBook(BOOK_META[idx + 1].name);
          setSelectedChapter(1);
        }
      }
    }
  };

  const prevChapter = () => {
    if (selectedChapter > 1) {
      setSelectedChapter(selectedChapter - 1);
    } else {
      const bookMeta = BOOK_META.find(b => b.name === selectedBook);
      if (bookMeta) {
        const idx = BOOK_META.indexOf(bookMeta);
        if (idx > 0) {
          const prevBookName = BOOK_META[idx - 1].name;
          setSelectedBook(prevBookName);
          setSelectedChapter(getBookChapters(prevBookName) || 1);
        }
      }
    }
  };

  const formatVerseContent = (v: any) => {
    return `${v.book} ${v.chapter}:${v.verse} (${v.version || version}) — ${v.text}`;
  };

  const stageVerse = (v: any) => {
    const content = formatVerseContent(v);
    const card: StagingCard = {
      id: `card-${Date.now()}`,
      type: 'scripture',
      content: content,
      preset: graphicsSettings?.scripturePosition || 'full-screen'
    };
    const stored = localStorage.getItem("ce_stagingQueue");
    const queue = stored ? JSON.parse(stored) : [];
    queue.push(card);
    localStorage.setItem("ce_stagingQueue", JSON.stringify(queue));
    socketRef.current?.emit('staging_card', card);
  };

  const pushLive = (v: any) => {
    const content = formatVerseContent(v);
    const card: StagingCard = {
      id: `card-${Date.now()}`,
      type: 'scripture',
      content: content,
      preset: graphicsSettings?.scripturePosition || 'full-screen'
    };
    socketRef.current?.emit("push_live", card);
  };

  const clearLive = () => {
    socketRef.current?.emit("clear_live");
  };

  const activeBookMeta = BOOK_META.find(b => b.name === selectedBook);
  const chaptersCount = getBookChapters(selectedBook);
  const versesCount = bibleVerses.length;

  return (
    <div className="hb-page">
      {/* ── LEFT: Reading Pane ── */}
      <div className="hb-reading-pane">
        {/* Header */}
        <div className="hb-reading-header">
          <div className="hb-reading-ref">{selectedBook} {selectedChapter}</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <select className="hb-version-select" value={version} onChange={(e) => setVersion(e.target.value)}>
              <option value="KJV">KJV</option>
              <option value="NIV">NIV</option>
              <option value="ESV">ESV</option>
              <option value="NKJV">NKJV</option>
              <option value="ASV">ASV</option>
              <option value="WEB">WEB</option>
              <option value="BBE">BBE</option>
            </select>
            <div className="hb-connection-dot" style={{ background: socketConnected ? '#22c55e' : '#ef4444' }} />
          </div>
        </div>

        {/* Verse List */}
        <div className="hb-verse-list" ref={verseListRef}>
          {loadingVerses && (
            <div className="hb-loading">Loading...</div>
          )}
          {!loadingVerses && bibleVerses.length === 0 && (
            <div className="hb-loading">No verses found for this version.</div>
          )}
          {bibleVerses.map((v, i) => (
            <div
              key={`${v.chapter}-${v.verse}`}
              className={`hb-verse-line ${selectedVerseIndex === i ? 'active' : ''}`}
              onClick={() => setSelectedVerseIndex(i)}
            >
              <span className="hb-verse-num">{v.verse}</span>
              <span className="hb-verse-text">{v.text}</span>
            </div>
          ))}
        </div>

        {/* Action Bar */}
        <div className="hb-action-bar">
          <button className="hb-action-btn" onClick={() => router.push('/')} data-tooltip="Ctrl + B">🎛️ Dashboard</button>
          <button className="hb-action-btn accent" onClick={() => selectedVerseIndex !== null && bibleVerses[selectedVerseIndex] && pushLive(bibleVerses[selectedVerseIndex])} disabled={selectedVerseIndex === null} data-tooltip="Enter">▶ Push Live</button>
          <button className="hb-action-btn" onClick={() => selectedVerseIndex !== null && bibleVerses[selectedVerseIndex] && stageVerse(bibleVerses[selectedVerseIndex])} disabled={selectedVerseIndex === null} data-tooltip="Space">📋 Stage</button>
          <button className="hb-action-btn danger" onClick={clearLive} data-tooltip="Escape">✕ Clear</button>
        </div>
      </div>

      {/* ── RIGHT: Grids Panel ── */}
      <div className="hb-grids-panel">
        {/* Books Grid (Periodic Table Style) */}
        <div className="hb-section">
          <div className="hb-section-label">Books</div>
          <div className="hb-books-grid">
            {BOOK_META.map((bm) => {
              const color = GROUP_COLORS[bm.group] || '#888';
              const isActive = selectedBook === bm.name;
              return (
                <div
                  key={bm.name}
                  className={`hb-book-cell ${isActive ? 'active' : ''}`}
                  style={{
                    '--book-color': color,
                    borderColor: isActive ? color : 'transparent',
                    background: isActive ? `${color}22` : undefined,
                  } as React.CSSProperties}
                  onClick={() => {
                    setSelectedBook(bm.name);
                    setSelectedChapter(1);
                  }}
                  title={bm.name}
                >
                  <span className="hb-book-abbr">{bm.abbr}</span>
                  <span className="hb-book-full">{bm.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chapters Grid */}
        <div className="hb-section">
          <div className="hb-section-label">Chapters — {selectedBook}</div>
          <div className="hb-num-grid">
            {Array.from({ length: chaptersCount }, (_, i) => i + 1).map(c => (
              <div
                key={c}
                className={`hb-num-cell ${selectedChapter === c ? 'active' : ''}`}
                onClick={() => setSelectedChapter(c)}
              >
                {c}
              </div>
            ))}
          </div>
        </div>

        {/* Verses Grid */}
        <div className="hb-section">
          <div className="hb-section-label">Verses — {selectedBook} {selectedChapter}</div>
          <div className="hb-num-grid verses">
            {loadingVerses ? (
              <div style={{ color: '#71717a', padding: '10px', gridColumn: '1 / -1' }}>Loading...</div>
            ) : (
              Array.from({ length: versesCount }, (_, i) => i + 1).map(v => (
                <div
                  key={v}
                  className={`hb-num-cell verse ${selectedVerseIndex === v - 1 ? 'active' : ''}`}
                  onClick={() => setSelectedVerseIndex(v - 1)}
                >
                  {v}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

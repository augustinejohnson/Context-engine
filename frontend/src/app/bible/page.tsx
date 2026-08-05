"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { GraphicsSettings, StagingCard } from "../page";
import { supabase } from "../lib/supabaseClient";

export default function BibleBrowser() {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  const [socketConnected, setSocketConnected] = useState(false);
  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings | null>(null);

  const [bibleBooks, setBibleBooks] = useState<{book: string, chapters: number}[]>([]);
  const [selectedBook, setSelectedBook] = useState<string>("Genesis");
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [bibleVerses, setBibleVerses] = useState<any[]>([]);
  const [selectedVerseIndex, setSelectedVerseIndex] = useState<number | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [version, setVersion] = useState("KJV");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<any>(null);

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
    // Hydrate settings
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
      if (books.length > 0) {
        setSelectedBook(books[0].book);
      }
    });

    socketRef.current.on("bible_chapter_data", (data) => {
      setBibleVerses(data.verses || []);
      if (data.verses && data.verses.length > 0) {
        setSelectedVerseIndex(0);
      } else {
        setSelectedVerseIndex(null);
      }
    });

    socketRef.current.on("bible_search_results", (results) => {
      setSearchResults(results || []);
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Bible Socket connection error:", err);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [session?.access_token]);

  // Fetch chapter when book, chapter or version changes
  useEffect(() => {
    if (selectedBook && selectedChapter && !isSearching) {
      socketRef.current?.emit("get_bible_chapter", { book: selectedBook, chapter: selectedChapter, version });
    }
  }, [selectedBook, selectedChapter, version, isSearching]);

  // Search effect
  useEffect(() => {
    if (isSearching && searchQuery.trim().length > 2) {
      const debounce = setTimeout(() => {
        socketRef.current?.emit("bible_search", { query: searchQuery });
      }, 500);
      return () => clearTimeout(debounce);
    }
  }, [searchQuery, isSearching]);

  // Keyboard Shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts if typing in search
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        searchInputRef.current?.blur();
      }
      return;
    }

    const currentList = isSearching ? searchResults : bibleVerses;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedVerseIndex(prev => 
          prev === null ? 0 : Math.min(prev + 1, currentList.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedVerseIndex(prev => 
          prev === null ? 0 : Math.max(prev - 1, 0)
        );
        break;
      case 'ArrowRight':
        if (!isSearching) {
          e.preventDefault();
          nextChapter();
        }
        break;
      case 'ArrowLeft':
        if (!isSearching) {
          e.preventDefault();
          prevChapter();
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedVerseIndex !== null && currentList[selectedVerseIndex]) {
          pushLive(currentList[selectedVerseIndex]);
        }
        break;
      case ' ': // Space
        e.preventDefault();
        if (selectedVerseIndex !== null && currentList[selectedVerseIndex]) {
          stageVerse(currentList[selectedVerseIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        clearLive();
        break;
      case 'f':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
        break;
      case 'b':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          router.push('/');
        }
        break;
    }
  }, [bibleVerses, searchResults, isSearching, selectedVerseIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const nextChapter = () => {
    const bookData = bibleBooks.find(b => b.book === selectedBook);
    if (!bookData) return;
    if (selectedChapter < bookData.chapters) {
      setSelectedChapter(selectedChapter + 1);
    } else {
      // Go to next book
      const idx = bibleBooks.findIndex(b => b.book === selectedBook);
      if (idx < bibleBooks.length - 1) {
        setSelectedBook(bibleBooks[idx + 1].book);
        setSelectedChapter(1);
      }
    }
  };

  const prevChapter = () => {
    if (selectedChapter > 1) {
      setSelectedChapter(selectedChapter - 1);
    } else {
      // Go to previous book
      const idx = bibleBooks.findIndex(b => b.book === selectedBook);
      if (idx > 0) {
        const prevBook = bibleBooks[idx - 1];
        setSelectedBook(prevBook.book);
        setSelectedChapter(prevBook.chapters);
      }
    }
  };

  const nextVerse = () => {
    const list = isSearching ? searchResults : bibleVerses;
    if (selectedVerseIndex === null) {
      setSelectedVerseIndex(0);
      return;
    }
    if (selectedVerseIndex < list.length - 1) {
      setSelectedVerseIndex(selectedVerseIndex + 1);
    } else if (!isSearching) {
      nextChapter();
    }
  };

  const prevVerse = () => {
    if (selectedVerseIndex === null) {
      setSelectedVerseIndex(0);
      return;
    }
    if (selectedVerseIndex > 0) {
      setSelectedVerseIndex(selectedVerseIndex - 1);
    } else if (!isSearching) {
      prevChapter();
      // It will load the prev chapter and automatically select index 0. 
      // Ideally we would select the last verse, but it's loaded async.
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
    
    // Save to local storage staging queue so it's there when switching back
    const stored = localStorage.getItem("ce_stagingQueue");
    const queue = stored ? JSON.parse(stored) : [];
    queue.push(card);
    localStorage.setItem("ce_stagingQueue", JSON.stringify(queue));
    
    // Also emit to socket so other connected clients (like Dashboard) update in real-time
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

  const activeBookData = bibleBooks.find(b => b.book === selectedBook);

  const displayedList = isSearching ? searchResults : bibleVerses;

  return (
    <div className="bible-page">
      {/* Top Bar */}
      <header className="bible-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button className="glass-btn primary" onClick={() => router.push('/')} title="Shortcut: Ctrl + B">
            🎛️ Dashboard
          </button>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#c4b5fd' }}>📖 BIBLE BROWSER</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: socketConnected ? '#22c55e' : '#ef4444', display: 'inline-block' }}></span>
            <span style={{ color: socketConnected ? '#22c55e' : '#ef4444' }}>{socketConnected ? 'Connected' : 'Reconnecting...'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <select 
            className="input-field" 
            style={{ width: '100px' }} 
            value={version} 
            onChange={(e) => setVersion(e.target.value)}
          >
            <option value="KJV">KJV</option>
            <option value="NIV">NIV</option>
            <option value="ESV">ESV</option>
            <option value="ASV">ASV</option>
            <option value="WEB">WEB</option>
            <option value="BBE">BBE</option>
          </select>

          <input 
            ref={searchInputRef}
            type="text" 
            className="bible-search-input" 
            placeholder="Search verses (Ctrl+F)..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearching(e.target.value.length > 0);
            }}
          />
        </div>
      </header>

      {/* 3 Columns */}
      <div className="bible-columns">
        {/* Books Column */}
        <div className="bible-books-col">
          <div className="bible-testament-header">Books</div>
          {bibleBooks.map((b, i) => (
            <div 
              key={b.book} 
              className={`bible-book-item ${selectedBook === b.book ? 'active' : ''}`}
              onClick={() => {
                setSelectedBook(b.book);
                setSelectedChapter(1);
                setIsSearching(false);
                setSearchQuery("");
              }}
            >
              <span>{b.book}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{b.chapters}</span>
            </div>
          ))}
        </div>

        {/* Chapters Column */}
        <div className="bible-chapters-col">
          {!isSearching && activeBookData && (
            <>
              <div style={{ marginBottom: '15px', color: '#c4b5fd', fontWeight: 'bold' }}>{activeBookData.book}</div>
              <div className="bible-chapter-grid">
                {Array.from({ length: activeBookData.chapters }, (_, i) => i + 1).map(c => (
                  <div 
                    key={c}
                    className={`bible-chapter-btn ${selectedChapter === c ? 'active' : ''}`}
                    onClick={() => setSelectedChapter(c)}
                  >
                    {c}
                  </div>
                ))}
              </div>
            </>
          )}
          {isSearching && (
            <div style={{ padding: '10px', color: '#a1a1aa' }}>
              Showing search results for "{searchQuery}"
            </div>
          )}
        </div>

        {/* Verses Column */}
        <div className="bible-verses-col">
          {!isSearching && (
            <div className="bible-nav-arrows">
              <button className="glass-btn" onClick={prevChapter} title="Shortcut: ←">◀ Prev Chap</button>
              <button className="glass-btn" onClick={nextChapter} title="Shortcut: →">Next Chap ▶</button>
            </div>
          )}

          {displayedList.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '50px', color: '#a1a1aa' }}>
              {isSearching ? "No results found." : "Loading verses..."}
            </div>
          )}

          {displayedList.map((v, i) => (
            <div 
              key={`${v.book}-${v.chapter}-${v.verse}`}
              className={`bible-verse-row ${selectedVerseIndex === i ? 'selected' : ''}`}
              onClick={() => setSelectedVerseIndex(i)}
            >
              <div className="bible-verse-num">
                {selectedVerseIndex === i ? '► ' : ''}
                {isSearching ? `${v.book} ${v.chapter}:${v.verse}` : v.verse}
              </div>
              <div style={{ flex: 1 }}>{v.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Staging Strip */}
      <div className="bible-staging-strip">
        <div style={{ flex: 1, marginRight: '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedVerseIndex !== null && displayedList[selectedVerseIndex] ? (
            <span style={{ fontSize: '1.2rem' }}>
              <span style={{ color: '#c4b5fd', fontWeight: 'bold', marginRight: '10px' }}>
                {displayedList[selectedVerseIndex].book} {displayedList[selectedVerseIndex].chapter}:{displayedList[selectedVerseIndex].verse} ({displayedList[selectedVerseIndex].version || version})
              </span>
              "{displayedList[selectedVerseIndex].text}"
            </span>
          ) : (
            <span style={{ color: '#a1a1aa' }}>Select a verse...</span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="glass-btn" onClick={prevVerse} disabled={selectedVerseIndex === null} title="Shortcut: ↑">
            ◀ Prev
          </button>
          <button className="glass-btn" onClick={nextVerse} disabled={selectedVerseIndex === null} title="Shortcut: ↓">
            Next ▶
          </button>
          <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.2)', margin: '0 10px' }}></div>
          <button className="glass-btn" style={{ borderColor: '#8b5cf6', color: '#c4b5fd' }} onClick={() => clearLive()} title="Shortcut: Esc">
            Clear Live
          </button>
          <button 
            className="glass-btn" 
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={() => selectedVerseIndex !== null && stageVerse(displayedList[selectedVerseIndex])}
            disabled={selectedVerseIndex === null}
            title="Shortcut: Space"
          >
            STAGE
          </button>
          <button 
            className="glass-btn primary"
            onClick={() => selectedVerseIndex !== null && pushLive(displayedList[selectedVerseIndex])}
            disabled={selectedVerseIndex === null}
            title="Shortcut: Enter"
          >
            ▶ PUSH LIVE
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { GraphicsSettings, StagingCard } from "../page";
import { supabase } from "../../lib/supabaseClient";

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

  // NEW STATE for verse popup
  const [versePopupOpen, setVersePopupOpen] = useState(false);
  const [versePopupChapter, setVersePopupChapter] = useState<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

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

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setVersePopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        if (versePopupOpen) {
          setVersePopupOpen(false);
        } else {
          clearLive();
        }
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
  }, [bibleVerses, searchResults, isSearching, selectedVerseIndex, versePopupOpen, router]);

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

      {/* Layout - Now 2 Columns */}
      <div className="bible-columns" style={{ display: 'flex' }}>
        {/* Books Column */}
        <div className="bible-books-col" style={{ width: '220px', flexShrink: 0 }}>
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
                setVersePopupOpen(false);
              }}
            >
              <span>{b.book}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{b.chapters}</span>
            </div>
          ))}
        </div>

        {/* Chapters & Verses Area */}
        <div className="bible-chapters-col" style={{ flex: 1, position: 'relative', paddingRight: '20px' }}>
          {!isSearching && activeBookData && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ color: '#c4b5fd', fontWeight: 'bold', fontSize: '1.2rem' }}>{activeBookData.book}</div>
                <div className="bible-nav-arrows">
                  <button className="glass-btn" onClick={prevChapter} title="Shortcut: ←">◀ Prev Chap</button>
                  <button className="glass-btn" onClick={nextChapter} title="Shortcut: →">Next Chap ▶</button>
                </div>
              </div>
              
              <div className="bible-chapter-grid" style={{ position: 'relative' }}>
                {Array.from({ length: activeBookData.chapters }, (_, i) => i + 1).map(c => (
                  <div 
                    key={c}
                    className={`bible-chapter-btn ${selectedChapter === c ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedChapter(c);
                      setVersePopupChapter(c);
                      setVersePopupOpen(true);
                    }}
                  >
                    {c}
                  </div>
                ))}

                {versePopupOpen && (
                  <div ref={popupRef} className="verse-popup" style={{
                    position: 'absolute',
                    top: '60px',
                    left: '0px',
                    right: '0px',
                    zIndex: 100,
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    padding: '20px',
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}>
                    <div className="verse-popup-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#c4b5fd' }}>{selectedBook} {versePopupChapter}</span>
                      <button onClick={() => setVersePopupOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                    </div>
                    <div className="verse-popup-list">
                      {bibleVerses.length === 0 ? (
                        <div style={{ color: '#a1a1aa' }}>Loading verses...</div>
                      ) : (
                        bibleVerses.map((v, i) => (
                          <div
                            key={v.verse}
                            className={`verse-popup-item ${selectedVerseIndex === i ? 'selected' : ''}`}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: selectedVerseIndex === i ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
                              display: 'flex',
                              gap: '10px',
                              marginBottom: '4px'
                            }}
                            onClick={() => {
                              setSelectedVerseIndex(i);
                            }}
                          >
                            <span className="verse-popup-num" style={{ color: '#8b5cf6', minWidth: '25px', fontWeight: 'bold' }}>{v.verse}</span>
                            <span>{v.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Area Below Chapters */}
              <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', flex: 1 }}>
                <h3 style={{ marginTop: 0, color: '#c4b5fd', marginBottom: '15px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Selection</h3>
                {selectedVerseIndex !== null && bibleVerses[selectedVerseIndex] ? (
                  <div style={{ fontSize: '1.3rem', lineHeight: '1.6' }}>
                    <strong style={{ color: '#8b5cf6', marginRight: '10px' }}>{bibleVerses[selectedVerseIndex].verse}</strong>
                    {bibleVerses[selectedVerseIndex].text}
                  </div>
                ) : (
                  <div style={{ color: '#a1a1aa' }}>Select a verse to preview</div>
                )}
              </div>
            </div>
          )}

          {isSearching && (
            <div style={{ padding: '10px', color: '#a1a1aa', height: '100%', overflowY: 'auto' }}>
              <div style={{ marginBottom: '20px', fontSize: '1.1rem' }}>Showing search results for <span style={{color: '#fff'}}>"{searchQuery}"</span></div>
              
              {searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '50px' }}>No results found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {searchResults.map((v, i) => (
                    <div 
                      key={`${v.book}-${v.chapter}-${v.verse}`}
                      className={`bible-verse-row ${selectedVerseIndex === i ? 'selected' : ''}`}
                      onClick={() => setSelectedVerseIndex(i)}
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: selectedVerseIndex === i ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                        display: 'flex',
                        gap: '15px',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div className="bible-verse-num" style={{ color: '#8b5cf6', minWidth: '100px', fontWeight: 'bold' }}>
                        {selectedVerseIndex === i ? '► ' : ''}
                        {v.book} {v.chapter}:{v.verse}
                      </div>
                      <div style={{ flex: 1, lineHeight: '1.5' }}>{v.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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

"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "../lib/supabaseClient";
import AuthScreen from "../components/AuthScreen";
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
const SubscriptionScreen = dynamic(() => import("../components/SubscriptionScreen"), { ssr: false });

/* ── Types ─────────────────────────────────────────────── */
type CardType = "scripture" | "knowledge" | "lyric";
type PresetType = "lower-third" | "full-screen" | "subtitle" | "top-left" | "top-center" | "top-right" | "middle-left" | "middle-right" | "bottom-right";

export interface StagingCard {
  id: string;
  type: CardType;
  content: string;
  preset: PresetType;
  translation?: string; // Dual-Language Output
  songSections?: { name: string, text: string }[]; // For Lyric quick jumps
  activeSectionIndex?: number;
  activeScriptureContext?: {
    book: string;
    chapter: number;
    currentVerse: number;
    translation: string;
    nextVerses: { verse: number; text: string }[];
  };
}

export interface GraphicsSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  bgOpacity: number;
  strokeWidth: number;
  strokeColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
  animationEnabled: boolean;
  entranceAnimation: string;
  exitAnimation: string;
  animationSpeed: number;
  defaultBibleVersion: string;
  outputBgType: "solid" | "transparent" | "chroma-green" | "chroma-blue" | "image" | "video";
  outputBgColor1: string;
  outputBgColor2: string;
  speechLanguage: string;
  aiExtractionTarget: "all" | "scriptures" | "knowledge";
  aiExtractionEnabled: boolean;
  lyricsModeEnabled: boolean;
  translationEnabled: boolean;
  translationTarget: string;
  holyricsEnabled: boolean;
  holyricsIp: string;
  holyricsPort: string;
  holyricsToken: string;
  proPresenterEnabled: boolean;
  proPresenterIp: string;
  proPresenterPort: string;
  vmixEnabled: boolean;
  vmixIp: string;
  vmixInput: string;
  spokenWordMode: boolean;
  spokenWordPosition: PresetType;
  lyricsPosition: PresetType;
  scripturePosition: PresetType;
  bibleBgType: "solid" | "transparent" | "parchment" | "gradient";
  bibleBgColor1: string;
  bibleBgColor2: string;
}

/* ── Web Speech API types ──────────────────────────────── */
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

/* ── Fallback fonts if Local Font Access API is unavailable ── */
const FALLBACK_FONTS = [
  "Inter", "Montserrat", "Cinzel", "Playfair Display",
  "Arial", "Helvetica", "Times New Roman", "Georgia",
  "Tahoma", "Verdana", "Trebuchet MS", "Impact",
  "Courier New", "Comic Sans MS", "Segoe UI",
];

/* ── Component ─────────────────────────────────────────── */
export default function ContextEngineDashboard() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [subStatus, setSubStatus] = useState<string>("loading");
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [autoPush, setAutoPush] = useState(false);

  const [transcript, setTranscript] = useState<string[]>([]);
  const [interimText, setInterimText] = useState("");
  const [stagingQueue, setStagingQueue] = useState<StagingCard[]>([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(0);

  const activeScriptureContextRef = useRef<StagingCard['activeScriptureContext'] | null>(null);

  const [liveContent, setLiveContent] = useState<{ content: string; preset: PresetType } | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availableFonts, setAvailableFonts] = useState<string[]>(FALLBACK_FONTS);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "graphics" | "integrations">("settings");

  const [importSong, setImportSong] = useState({ title: "", artist: "", lyrics: "" });
  const [isFetchingSong, setIsFetchingSong] = useState(false);
  const [editingSong, setEditingSong] = useState<{ title: string, lyrics: string } | null>(null);

  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings>({
    fontFamily: "Inter",
    fontSize: 48,
    lineHeight: 1.5,
    textColor: "#ffffff",
    bgOpacity: 0,
    strokeWidth: 2,
    strokeColor: "#000000",
    shadowX: 2,
    shadowY: 2,
    shadowBlur: 8,
    shadowColor: "rgba(0,0,0,0.8)",
    animationEnabled: true,
    entranceAnimation: "slide-up",
    exitAnimation: "fade-out",
    animationSpeed: 400,
    defaultBibleVersion: "KJV",
    outputBgType: "solid",
    outputBgColor1: "#000000",
    outputBgColor2: "#1a1a2e",
    speechLanguage: "en-NG",
    aiExtractionTarget: "all",
    aiExtractionEnabled: false,
    lyricsModeEnabled: false,
    translationEnabled: false,
    translationTarget: "Spanish",
    holyricsEnabled: false,
    holyricsIp: "127.0.0.1",
    holyricsPort: "8090",
    holyricsToken: "",
    proPresenterEnabled: false,
    proPresenterIp: "127.0.0.1",
    proPresenterPort: "20562",
    vmixEnabled: false,
    vmixIp: "127.0.0.1",
    vmixInput: "Title",
    spokenWordMode: false,
    spokenWordPosition: "subtitle",
    lyricsPosition: "lower-third",
    scripturePosition: "full-screen",
    bibleBgType: "parchment",
    bibleBgColor1: "#f4ebd8",
    bibleBgColor2: "#e6d5b8",
  });
  
  const [songsList, setSongsList] = useState<{id: number, title: string, artist: string}[]>([]);
  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [isSongsListExpanded, setIsSongsListExpanded] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(true);
  const [apiStatuses, setApiStatuses] = useState({ holyrics: 'offline', proPresenter: 'offline', vmix: 'offline' });
  const [showSubscription, setShowSubscription] = useState(false);
  const [serverBuildId, setServerBuildId] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [screens, setScreens] = useState<any[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');

  const socketRef = useRef<Socket | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastFastFetchedRef = useRef<string>("");
  const autoPushRef = useRef(autoPush);
  
  useEffect(() => {
    autoPushRef.current = autoPush;
  }, [autoPush]);

  const handleLaunchOutput = async () => {
    let screenDetails = null;
    if (typeof window !== "undefined" && "getScreenDetails" in window) {
      try {
        screenDetails = await (window as any).getScreenDetails();
        setScreens(screenDetails.screens);
      } catch (e) {
        console.warn("Screen details permission denied.", e);
      }
    }
    
    let targetScreen = screenDetails?.screens?.[0];
    if (screenDetails && selectedScreenId) {
       targetScreen = screenDetails.screens.find((s:any) => s.id === selectedScreenId) || targetScreen;
    } else if (screenDetails && screenDetails.screens.length > 1) {
       targetScreen = screenDetails.screens.find((s:any) => s.isExtended) || screenDetails.screens[1];
       if (targetScreen) setSelectedScreenId(targetScreen.id);
    }

    let features = 'width=1280,height=720,popup=yes,menubar=no,toolbar=no,location=no,status=no';
    if (targetScreen) {
       features += `,left=${targetScreen.availLeft},top=${targetScreen.availTop}`;
    }

    window.open('/output', 'LiveOutput', features);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "getScreenDetails" in window) {
      navigator.permissions.query({name: "window-management" as any}).then(p => {
        if (p.state === "granted") {
          (window as any).getScreenDetails().then((details: any) => {
            setScreens(details.screens);
            if (details.screens.length > 1) {
              const extended = details.screens.find((s:any) => s.isExtended) || details.screens[1];
              if (extended) setSelectedScreenId(extended.id);
            }
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    const fetchSub = async (userId: string, token: string) => {
      let { data, error } = await supabase.from('user_profiles').select('subscription_status, trial_ends_at').eq('id', userId).single();
      
      if (!data) {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://context-engine-production-51a1.up.railway.app";
        const res = await fetch(`${backendUrl}/api/user/init_trial`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const initData = await res.json();
          if (initData.data) data = initData.data;
        }
      }

      if (data) {
        let status = data.subscription_status || "inactive";
        
        // Trial logic
        if (data.trial_ends_at) {
          const trialEnds = new Date(data.trial_ends_at);
          if (trialEnds > new Date()) {
            setSubStatus(`trial_${data.trial_ends_at}`); // Encode trial date in status string for SubscriptionScreen to parse
            return;
          } else if (status === 'trial') {
            status = 'expired';
          }
        }
        setSubStatus(status);
      } else {
        setSubStatus("inactive");
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) fetchSub(session.user.id, session.access_token);
      else setSubStatus("inactive");
    });
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) fetchSub(session.user.id, session.access_token);
      else setSubStatus("inactive");
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ── Load local fonts via Local Font Access API ── */
  const loadLocalFonts = useCallback(async () => {
    if (fontsLoaded) return;
    try {
      // @ts-ignore — Local Font Access API (Chromium only)
      if (typeof window !== "undefined" && "queryLocalFonts" in window) {
        // @ts-ignore
        const fonts = await window.queryLocalFonts();
        const familySet = new Set<string>();
        for (const font of fonts) {
          familySet.add(font.family);
        }
        const sorted = Array.from(familySet).sort((a, b) => a.localeCompare(b));
        if (sorted.length > 0) {
          setAvailableFonts(sorted);
        }
        setFontsLoaded(true);
        console.log(`[Fonts] Loaded ${sorted.length} local fonts.`);
      } else {
        console.log("[Fonts] Local Font Access API not available. Using fallback list.");
        setFontsLoaded(true);
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        console.log("[Fonts] User denied font access permission. Using fallback list.");
      } else {
        console.error("[Fonts] Error loading local fonts:", err);
      }
      setFontsLoaded(true);
    }
  }, [fontsLoaded]);



  /* ── Load/Save Settings from LocalStorage ── */
  useEffect(() => {
    const saved = localStorage.getItem('contextEngineSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGraphicsSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse saved settings', e);
      }
    }
    
    // Restore stagingQueue and transcript
    const savedQueue = localStorage.getItem('ce_stagingQueue');
    if (savedQueue) {
      try { setStagingQueue(JSON.parse(savedQueue)); } catch(e){}
    }
    const savedTranscript = localStorage.getItem('ce_transcript');
    if (savedTranscript) {
      try { setTranscript(JSON.parse(savedTranscript)); } catch(e){}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ce_stagingQueue', JSON.stringify(stagingQueue));
  }, [stagingQueue]);

  useEffect(() => {
    localStorage.setItem('ce_transcript', JSON.stringify(transcript));
  }, [transcript]);

  /* ── Socket.io setup ── */
  useEffect(() => {
    if (!session?.access_token) return;

    const fallbackHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://context-engine-production-51a1.up.railway.app";
    
    socketRef.current = io(backendUrl, {
      auth: { token: session.access_token }
    });

    socketRef.current.on("connect", () => {
      setSocketConnected(true);
      socketRef.current?.emit("get_songs");
      
      // Ensure the backend syncs the settings from localStorage on reload
      const saved = localStorage.getItem('contextEngineSettings');
      if (saved) {
        socketRef.current?.emit("update_settings", JSON.parse(saved));
      } else {
        // Fallback to sending the current state if nothing is in local storage
        socketRef.current?.emit("update_settings", graphicsSettings);
      }
    });
    socketRef.current.on("disconnect", () => {
      setSocketConnected(false);
    });

    socketRef.current.on("server_info", (info) => {
      if (info.buildId) {
        setServerBuildId((prevId) => {
          if (prevId !== null && prevId !== info.buildId) {
            setUpdateAvailable(true);
          }
          return info.buildId;
        });
      }
    });
    
    socketRef.current.on("session_status", (sessionId) => {
      setActiveSessionId(sessionId);
    });
    
    socketRef.current.on("session_ended", (sessionId) => {
      const fallbackHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://context-engine-production-51a1.up.railway.app";
      window.location.href = `${backendUrl}/export-session/${sessionId}`;
    });
    
    socketRef.current.on("api_status", (statuses) => {
      setApiStatuses(statuses);
    });
    
    socketRef.current.on("toast_error", (msg) => {
      alert(`[SYSTEM ERROR]\n${msg}`);
    });
    
    socketRef.current.on("songs_list", (songs) => {
      setSongsList(songs);
    });

    socketRef.current.on("transcript_line", (line: string) => {
      setTranscript((prev) => [...prev, line]);
    });

    socketRef.current.on("fetch_success", (msg) => {
      setIsFetchingSong(false);
      alert(msg);
      setImportSong({ title: "", artist: "", lyrics: "" });
    });

    socketRef.current.on("fetch_error", (msg) => {
      setIsFetchingSong(false);
      alert(msg);
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
        if (data.holyrics.enabled) {
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
              // Send BOTH id and references just in case one works better than the other
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
                // Fallback to CreateText if ShowVerse fails
                console.log("[Bridge] Falling back to CreateText for Scripture");
                const fallbackUrl = `http://${data.holyrics.ip}:${data.holyrics.port}/api/CreateText`;
                fetch(fallbackUrl + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: data.content, show: true, display_ahead: true })
                }).catch(err => console.error('[Bridge] Fallback CreateText also failed:', err.message));
              });
            } else {
              console.warn('[Bridge] Failed to map scripture reference to Holyrics ID:', data.scriptureReference);
              // Fallback to CreateText since we don't have a valid ID
              const fallbackUrl = `http://${data.holyrics.ip}:${data.holyrics.port}/api/CreateText`;
              fetch(fallbackUrl + (data.holyrics.token ? `?token=${data.holyrics.token}` : ''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: data.content, show: true, display_ahead: true })
              }).catch(err => console.error('[Bridge] Fallback CreateText failed:', err.message));
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
        if (data.proPresenter.enabled) {
          fetch(`http://${data.proPresenter.ip}:${data.proPresenter.port}/v1/message/1/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: data.content })
          }).catch(e => console.error('[Bridge] ProPresenter Error:', e.message));
        }
        if (data.vmix.enabled) {
          const vmixUrl = `http://${data.vmix.ip}:8088/api/?Function=SetText&Input=${encodeURIComponent(data.vmix.input)}&Value=${encodeURIComponent(data.content)}`;
          fetch(vmixUrl, { mode: 'no-cors' }).catch(e => console.error('[Bridge] vMix Error:', e.message));
        }
      } 
      else if (data.action === 'clear_live') {
        if (data.holyrics.enabled) {
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
        if (data.proPresenter.enabled) {
          fetch(`http://${data.proPresenter.ip}:${data.proPresenter.port}/v1/message/1/clear`, {
            method: 'GET'
          }).catch(e => console.error('[Bridge] ProPresenter Error:', e.message));
        }
        if (data.vmix.enabled) {
          const vmixUrl = `http://${data.vmix.ip}:8088/api/?Function=SetText&Input=${encodeURIComponent(data.vmix.input)}&Value=`;
          fetch(vmixUrl, { mode: 'no-cors' }).catch(e => console.error('[Bridge] vMix Error:', e.message));
        }
      }
    });

    socketRef.current.on("staging_card", (card: StagingCard) => {
      // Prevent duplicate AI scriptures from breaking auto-advance
      if (card.type === 'scripture' && !card.activeScriptureContext && activeScriptureContextRef.current) {
        const ctx = activeScriptureContextRef.current;
        if (card.content.toLowerCase().includes(`${ctx.book.toLowerCase()} ${ctx.chapter}`)) {
          console.log("[AUTO-ADVANCE] Ignoring AI duplicate scripture to preserve tracking:", card.content);
          return;
        }
      }

      setStagingQueue((prev) => [...prev, card]);
      
      // Instantly push to live if Auto-Push is enabled
      if (autoPushRef.current && socketRef.current) {
        console.log("[AUTO-PUSH] Instantly pushing card live:", card.content);
        socketRef.current.emit("push_live", card);
      }
    });

    socketRef.current.on("song_lyrics_result", (data: { title: string, lyrics: string }) => {
      setEditingSong(data);
    });

    socketRef.current.on("live_card", (cardData: StagingCard) => {
      setLiveContent({ content: cardData.content, preset: cardData.preset });
      if (cardData.activeScriptureContext) {
        activeScriptureContextRef.current = cardData.activeScriptureContext;
      } else if (cardData.type === 'scripture') {
        // If it's a new scripture without context, clear the old context
        activeScriptureContextRef.current = null;
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [session?.access_token]);

  /* ── Keyboard Shortcuts ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCardIndex((prev) => Math.min(prev + 1, stagingQueue.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCardIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "ArrowRight") {
        // Move to NEXT lyric part and push live
        const card = stagingQueue[selectedCardIndex];
        if (card && card.type === "lyric" && card.songSections && card.songSections.length > 0) {
           e.preventDefault();
           let currentIndex = card.activeSectionIndex ?? card.songSections.findIndex(s => s.text === card.content);
           if (currentIndex < 0) currentIndex = 0;
           const nextIndex = Math.min(currentIndex + 1, card.songSections.length - 1);
           
           const nextText = card.songSections[nextIndex].text;
           const newCard = { ...card, content: nextText, activeSectionIndex: nextIndex };
           
           setStagingQueue(prev => prev.map((c, i) => i === selectedCardIndex ? newCard : c));
           socketRef.current?.emit("push_live", newCard);
           setLiveContent({ content: newCard.content, preset: newCard.preset });
        }
      } else if (e.key === "ArrowLeft") {
        // Move to PREVIOUS lyric part and push live
        const card = stagingQueue[selectedCardIndex];
        if (card && card.type === "lyric" && card.songSections && card.songSections.length > 0) {
           e.preventDefault();
           let currentIndex = card.activeSectionIndex ?? card.songSections.findIndex(s => s.text === card.content);
           if (currentIndex < 0) currentIndex = 0;
           const nextIndex = Math.max(currentIndex - 1, 0);
           
           const nextText = card.songSections[nextIndex].text;
           const newCard = { ...card, content: nextText, activeSectionIndex: nextIndex };
           
           setStagingQueue(prev => prev.map((c, i) => i === selectedCardIndex ? newCard : c));
           socketRef.current?.emit("push_live", newCard);
           setLiveContent({ content: newCard.content, preset: newCard.preset });
        }
      } else if (e.key === "Enter" && stagingQueue.length > 0 && stagingQueue[selectedCardIndex]) {
        e.preventDefault();
        // Push live
        const card = stagingQueue[selectedCardIndex];
        socketRef.current?.emit("push_live", card);
        
        // If it's a lyric card, we don't necessarily delete it from the queue immediately so they can keep navigating it
        if (card.type !== "lyric") {
          setStagingQueue((prev) => prev.filter((_, idx) => idx !== selectedCardIndex));
          setSelectedCardIndex((prev) => Math.max(0, Math.min(prev, stagingQueue.length - 2)));
        }
      } else if ((e.key === "Backspace" || e.key === "Delete") && stagingQueue.length > 0) {
        e.preventDefault();
        // Discard
        setStagingQueue((prev) => prev.filter((_, idx) => idx !== selectedCardIndex));
        setSelectedCardIndex((prev) => Math.max(0, Math.min(prev, stagingQueue.length - 2)));
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Clear Live
        socketRef.current?.emit("clear_live");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stagingQueue, selectedCardIndex]);

  /* ── Auto-scroll transcript ── */
  useEffect(() => {
    setTimeout(() => {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [transcript, interimText]);

  /* ── Sync placement settings to Staging Queue ── */
  useEffect(() => {
    setStagingQueue((prev) => 
      prev.map(card => {
        if (card.type === 'scripture' && card.preset !== graphicsSettings.scripturePosition) {
          return { ...card, preset: graphicsSettings.scripturePosition };
        }
        if (card.type === 'lyric' && card.preset !== graphicsSettings.lyricsPosition) {
          return { ...card, preset: graphicsSettings.lyricsPosition };
        }
        if (card.type === 'knowledge' && card.preset !== graphicsSettings.scripturePosition) {
          // Knowledge uses scripture position
          return { ...card, preset: graphicsSettings.scripturePosition };
        }
        return card;
      })
    );
  }, [graphicsSettings.scripturePosition, graphicsSettings.lyricsPosition]);

  /* ── Broadcast settings changes ── */
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit("update_settings", graphicsSettings);
    }
  }, [graphicsSettings]);

  /* ── Web Speech API: Start/Stop recognition ── */
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Web Speech API is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = graphicsSettings.speechLanguage || "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          // Send final text to backend for NLP processing
          if (socketRef.current && text.trim()) {
            socketRef.current.emit("transcript_text", text.trim());
          }
          setInterimText("");
        } else {
          interim += text;
        }
      }
      if (interim) {
        setInterimText(interim);
        
        // --- SPEED OPTIMIZATION: Fast Fetch Scripture ---
        const BIBLE_BOOKS_REGEX = "Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation|First Samuel|Second Samuel|First Kings|Second Kings|First Chronicles|Second Chronicles|First Corinthians|Second Corinthians|First Thessalonians|Second Thessalonians|First Timothy|Second Timothy|First Peter|Second Peter|First John|Second John|Third John";
        
        // Matches: "John 3 16", "John 3:16", "John 3:16 to 18"
        const verseRegex = new RegExp(`(${BIBLE_BOOKS_REGEX})\\s*(?:chapter\\s*|chap\\s*)?(\\d+)[\\s\\w,]{0,40}?(?:[:v]|verses?\\s*|and\\s*verses?\\s*|\\s+)(\\d+)(?:\\s*(?:to|-|and|and\\s*verses?)\\s*(\\d+))?`, "i");
        // Matches: "John chapter 3"
        const chapterRegex = new RegExp(`(${BIBLE_BOOKS_REGEX})\\s*(?:chapter\\s*|chap\\s*)(\\d+)`, "i");
        
        let targetRef = null;
        let fetchPayload = null;

        const match = interim.match(verseRegex);
        if (match) {
          if (match[4]) {
            targetRef = `${match[1]} ${match[2]}:${match[3]}-${match[4]}`;
            fetchPayload = { book: match[1], chapter: parseInt(match[2]), verseStart: parseInt(match[3]), verseEnd: parseInt(match[4]), originalRef: targetRef };
          } else {
            targetRef = `${match[1]} ${match[2]}:${match[3]}`;
            fetchPayload = { book: match[1], chapter: parseInt(match[2]), verseStart: parseInt(match[3]), verseEnd: null, originalRef: targetRef };
          }
        } else {
          const cMatch = interim.match(chapterRegex);
          if (cMatch) {
            targetRef = `${cMatch[1]} ${cMatch[2]}`;
            fetchPayload = { book: cMatch[1], chapter: parseInt(cMatch[2]), verseStart: 1, verseEnd: null, originalRef: targetRef, isChapterOnly: true };
          }
        }

        if (targetRef && socketRef.current) {
          if (targetRef !== lastFastFetchedRef.current) {
             lastFastFetchedRef.current = targetRef;
             console.log("[FAST-FETCH] Detected verse in interim:", targetRef);
             socketRef.current.emit("fast_fetch_scripture", fetchPayload);
             // Clear context so we don't accidentally auto-advance while fetching
             activeScriptureContextRef.current = null;
          }
        }

        // --- SPEED OPTIMIZATION: Auto-Advance Scriptures ---
        if (activeScriptureContextRef.current && activeScriptureContextRef.current.nextVerses.length > 0) {
          const ctx = activeScriptureContextRef.current;
          const nextVerse = ctx.nextVerses[0];
          
          // 1. Explicit triggers: "next verse", "verse 17"
          const explicitRegex = new RegExp(`(?:next\\s*verse|verse\\s*${nextVerse.verse})`, 'i');
          
          // 2. Implicit triggers: matching the first 4-5 words of the next verse
          const words = nextVerse.text.replace(/[^\w\s]/g, '').toLowerCase().split(/\s+/).slice(0, 5).join(' ');
          const implicitRegex = new RegExp(`\\b${words}\\b`, 'i');
          
          const cleanInterim = interim.replace(/[^\w\s]/g, '').toLowerCase();
          
          if (explicitRegex.test(interim) || (words.length > 10 && implicitRegex.test(cleanInterim))) {
            console.log("[AUTO-ADVANCE] Triggered next verse:", nextVerse.verse);
            const nextRef = `${ctx.book} ${ctx.chapter}:${nextVerse.verse}`;
            
            ctx.currentVerse = nextVerse.verse;
            ctx.nextVerses.shift(); 
            
            const newCard: StagingCard = {
              id: `card-auto-${Date.now()}`,
              type: 'scripture',
              content: `${nextRef} (${ctx.translation}) — ${nextVerse.text}`,
              preset: 'full-screen',
              activeScriptureContext: ctx
            };
            
            setStagingQueue((prev) => [...prev, newCard]);
            if (autoPushRef.current && socketRef.current) {
              socketRef.current.emit("push_live", newCard);
            }
            
            setInterimText("");
            interim = ""; 
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      // no-speech is a normal timeout event when there is silence. We can safely ignore it.
      // aborted occurs when we manually stop the recognition by toggling audio off.
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      
      console.error("[Speech] Recognition error:", event.error);
      if (event.error === "not-allowed") {
        alert("Microphone access was denied. Please allow microphone permissions in your browser.");
        setAudioEnabled(false);
        recognitionRef.current = null;
      } else if (event.error === "network") {
        console.warn("[Speech] Network error detected. The API will silently retry in the background.");
        // We purposefully DO NOT turn off audioEnabled here.
        // We let the `onend` handler automatically try to restart the connection.
      }
    };

    recognition.onend = () => {
      // Auto-restart if still enabled. Chrome can block immediate restarts, so we add a tiny delay.
      if (recognitionRef.current) {
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error("[Speech] Failed to auto-restart, creating fresh instance:", e);
              // Instead of toggling state (which doesn't trigger a restart), call the function again to build a new instance.
              startSpeechRecognition();
            }
          }
        }, 250);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    console.log("[Speech] Recognition started.");
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setInterimText("");
      console.log("[Speech] Recognition stopped.");
    }
  }, []);

  /* ── Toggle audio ── */
  const toggleAudio = useCallback(() => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    if (next) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }
  }, [audioEnabled, startSpeechRecognition, stopSpeechRecognition]);

  /* ── Card actions ── */
  const handleCardContentChange = (id: string, newContent: string) => {
    setStagingQueue((prev) => prev.map((card) => (card.id === id ? { ...card, content: newContent } : card)));
  };

  const handleCardPresetChange = (id: string, newPreset: PresetType) => {
    setStagingQueue((prev) => prev.map((card) => (card.id === id ? { ...card, preset: newPreset } : card)));
  };

  const pushLive = (card: StagingCard) => {
    setLiveContent({ content: card.content, preset: card.preset });
    if (socketRef.current) {
      socketRef.current.emit("push_live", card);
    }
    setStagingQueue((prev) => prev.filter((c) => c.id !== card.id));
  };

  const discardCard = (id: string) => {
    setStagingQueue((prev) => prev.filter((c) => c.id !== id));
  };

  const clearLive = () => {
    setLiveContent(null);
    socketRef.current?.emit("clear_live");
  };

  const handleImportSong = () => {
    if (!importSong.title || !importSong.lyrics) return;
    socketRef.current?.emit("add_song", importSong);
    alert(`Song "${importSong.title}" imported successfully!`);
    setImportSong({ title: "", artist: "", lyrics: "" });
  };

  const handleAutoFetchSong = () => {
    if (!importSong.title) {
      alert("Please enter a song title to Auto-Fetch.");
      return;
    }
    setIsFetchingSong(true);
    socketRef.current?.emit("auto_fetch_song", importSong.title);
  };

  /* ── Animation helpers ── */
  const getEntranceClass = () => {
    if (!graphicsSettings.animationEnabled) return "";
    switch (graphicsSettings.entranceAnimation) {
      case "slide-up": return "entrance-slide-up";
      case "fade-in": return "entrance-fade-in";
      case "zoom-in": return "entrance-zoom-in";
      case "typewriter": return "entrance-typewriter";
      default: return "entrance-slide-up";
    }
  };

  const getPresetClass = (preset: string) => {
    switch (preset) {
      case "top-left": return "preset-top-left";
      case "top-center": return "preset-top-center";
      case "top-right": return "preset-top-right";
      case "middle-left": return "preset-middle-left";
      case "full-screen": return "preset-full-screen";
      case "middle-right": return "preset-middle-right";
      case "lower-third": return "preset-lower-third";
      case "subtitle": return "preset-subtitle";
      case "bottom-right": return "preset-bottom-right";
      default: return "preset-lower-third";
    }
  };

  const generateStars = (count: number) => {
    let shadow = "";
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * 2000);
      const y = Math.floor(Math.random() * 2000);
      shadow += `${x}px ${y}px #FFF${i === count - 1 ? "" : ", "}`;
    }
    return shadow;
  };
  
  const [starsSmall, setStarsSmall] = useState("");
  const [starsMedium, setStarsMedium] = useState("");

  useEffect(() => {
    setStarsSmall(generateStars(700));
    setStarsMedium(generateStars(200));
  }, []);

  if (!isMounted) {
    return null;
  }

  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#09090b',
        color: '#f8fafc',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Mesh */}
        <div className="bg-particles" />

        {/* Navigation */}
        <nav style={{
          position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between',
          padding: '24px 48px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, background: 'linear-gradient(135deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Corpus
            </h1>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 500 }}>Home</Link>
            <Link href="/about" style={{ color: '#a1a1aa', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}>About</Link>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a 
              href="mailto:johnson@ronimationstudios.com" 
              style={{
                background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '10px', borderRadius: '50%', textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', width: '40px', height: '40px'
              }}
              title="Email Support"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586zm3.436-.586L16 11.801V4.697z"/>
              </svg>
            </a>
            <a 
              href="https://wa.me/2348124580183" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)',
                padding: '10px', borderRadius: '50%', textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', width: '40px', height: '40px'
              }}
              title="WhatsApp Support"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
              </svg>
            </a>
          </div>
        </nav>

        {/* Hero Section */}
        <main style={{
          position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 100px)',
          textAlign: 'center', padding: '0 24px'
        }}>
          <h2 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '24px', maxWidth: '800px', lineHeight: 1.1 }}>
            Live Broadcasting for <span className="gradient-text">Modern Ministries</span>
          </h2>
          <p style={{ fontSize: '1.25rem', color: '#a1a1aa', marginBottom: '40px', maxWidth: '600px', lineHeight: 1.6 }}>
            Automatically transcribe spoken word, stage scripture references, and sync lyrics—all in real-time using Corpus AI.
          </p>
          <button 
            onClick={() => setShowAuthModal(true)}
            className="glass-btn primary"
            style={{ fontSize: '1.2rem', padding: '16px 32px', borderRadius: '32px', fontWeight: 600 }}
          >
            Start Your 7-Day Free Trial
          </button>
        </main>

        {/* Auth Modal */}
        {showAuthModal && (
          <AuthScreen onLogin={() => setShowAuthModal(false)} onClose={() => setShowAuthModal(false)} />
        )}
      </div>
    );
  }

  if (subStatus === "loading") {
    return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white'}}>Loading...</div>;
  }

  if (subStatus === "expired") {
    return <SubscriptionScreen email={session?.user?.email || ""} onSubscribeSuccess={() => setSubStatus("active")} isExpired={true} />;
  }

  if (subStatus !== "active" && subStatus !== "lifetime" && !subStatus.startsWith("trial_")) {
    return <SubscriptionScreen email={session?.user?.email || ""} onSubscribeSuccess={() => setSubStatus("active")} />;
  }

  if (showSubscription) {
    const trialEndsAt = subStatus.startsWith("trial_") ? subStatus.split("trial_")[1] : undefined;
    return <SubscriptionScreen email={session?.user?.email || ""} onSubscribeSuccess={() => { setSubStatus("active"); setShowSubscription(false); }} trialEndsAt={trialEndsAt} onBack={() => setShowSubscription(false)} />;
  }

  return (
    <>
      <style>{`
        /* Creative Animated Backgrounds (No Gradients) */
        @keyframes animGrid {
          0% { background-position: 0px 0px; }
          100% { background-position: 40px 40px; }
        }
        @keyframes animScanlines {
          0% { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }
        @keyframes animStars {
          from { transform: translateY(0px); }
          to { transform: translateY(-2000px); }
        }

        .bg-solid {
          background-color: ${graphicsSettings.outputBgColor1};
        }
        
        .bg-transparent {
          background-color: transparent !important;
          background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1)), repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1));
          background-position: 0 0, 10px 10px;
          background-size: 20px 20px;
        }

        .bg-chroma-green {
          background-color: #00FF00 !important;
        }

        /* Tech Grid */
        .bg-tech-grid {
          background-color: ${graphicsSettings.outputBgColor1};
          background-image: 
            linear-gradient(to right, ${graphicsSettings.outputBgColor2} 1px, transparent 1px),
            linear-gradient(to bottom, ${graphicsSettings.outputBgColor2} 1px, transparent 1px);
          background-size: 40px 40px;
          animation: animGrid 4s linear infinite;
        }

        /* Scanlines */
        .bg-scanlines {
          background-color: ${graphicsSettings.outputBgColor1};
          position: relative;
        }
        .bg-scanlines::after {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: repeating-linear-gradient(to bottom, transparent 0%, transparent 50%, ${graphicsSettings.outputBgColor2} 50%, ${graphicsSettings.outputBgColor2} 100%);
          background-size: 100% 4px;
          z-index: 1;
          pointer-events: none;
          opacity: 0.5;
        }

        /* Starfield */
        .bg-starfield {
          background-color: ${graphicsSettings.outputBgColor1};
          position: relative;
          overflow: hidden;
        }
        .stars1 {
          width: 1px; height: 1px; background: transparent;
          box-shadow: ${starsSmall};
          animation: animStars 50s linear infinite;
        }
        .stars1:after {
          content: " "; position: absolute; top: 2000px;
          width: 1px; height: 1px; background: transparent;
          box-shadow: ${starsSmall};
        }
        .stars2 {
          width: 2px; height: 2px; background: transparent;
          box-shadow: ${starsMedium};
          animation: animStars 100s linear infinite;
        }
        .stars2:after {
          content: " "; position: absolute; top: 2000px;
          width: 2px; height: 2px; background: transparent;
          box-shadow: ${starsMedium};
        }
      `}</style>
      
      {updateAvailable && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999999,
          background: 'linear-gradient(90deg, #ef4444, #f97316)', color: 'white',
          padding: '12px 20px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px'
        }} onClick={() => window.location.reload()}>
          ⚠️ An update is available! Click here to refresh and apply the update. Your queued items are safely saved.
        </div>
      )}

      <div className="app-container">
        {/* Settings Overlay */}
        <div className={`settings-overlay ${settingsOpen ? "open" : ""}`} onClick={() => setSettingsOpen(false)} />

      {/* Settings Drawer */}
      <div className={`settings-drawer ${settingsOpen ? "open" : ""}`}>
        <div className="settings-header">
          <h2>System Settings</h2>
          <button className="close-settings" onClick={() => setSettingsOpen(false)}>×</button>
        </div>
        <div className="settings-content">
          {/* AI Settings */}
          <div className="settings-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>AI Extraction</h3>
              <button
                className={`toggle-btn ${graphicsSettings.aiExtractionEnabled ? "active" : ""}`}
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                onClick={() => setGraphicsSettings({ ...graphicsSettings, aiExtractionEnabled: !graphicsSettings.aiExtractionEnabled })}
              >
                {graphicsSettings.aiExtractionEnabled ? "ON" : "OFF"}
              </button>
            </div>

            <div className="setting-item">
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input 
                  type="checkbox" 
                  checked={graphicsSettings.aiExtractionEnabled} 
                  onChange={(e) => setGraphicsSettings({ ...graphicsSettings, aiExtractionEnabled: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                Enable AI Extraction Engine
              </label>
            </div>
            <div className="setting-item" style={{ fontSize: "0.8rem", color: "#aaa" }}>
              Leave the AI Extraction Toggle OFF if you do not want to use API credits.
            </div>
            {graphicsSettings.aiExtractionEnabled && (
              <div className="setting-item">
                <label>Extraction Target</label>
                <select
                  value={graphicsSettings.aiExtractionTarget}
                  onChange={(e) => setGraphicsSettings({ ...graphicsSettings, aiExtractionTarget: e.target.value as any })}
                >
                  <option value="all">Both (Knowledge & Scriptures)</option>
                  <option value="scriptures">Scriptures Only</option>
                  <option value="knowledge">Knowledge Only</option>
                </select>
              </div>
            )}
          </div>
            {/* Spoken Word (Live Captions) Mode Toggle */}
            <div className="settings-section" style={{ marginTop: "20px" }}>
              <h3>Spoken Word Mode</h3>
              <div className="setting-item">
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={graphicsSettings.spokenWordMode} 
                    onChange={(e) => setGraphicsSettings({ ...graphicsSettings, spokenWordMode: e.target.checked })}
                    style={{ width: "16px", height: "16px" }}
                  />
                  Enable Live Captions (Instantly push all speech to screens)
                </label>
              </div>
            </div>

              {/* Translation Toggle */}
          <div className="settings-section">
            <h3>Music & Translation Engine</h3>
            <div className="setting-item">
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input 
                  type="checkbox" 
                  checked={graphicsSettings.lyricsModeEnabled} 
                  onChange={(e) => setGraphicsSettings({ ...graphicsSettings, lyricsModeEnabled: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                Enable Lyrics Mode (Worship)
              </label>
            </div>
            <div className="setting-item">
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginTop: "10px" }}>
                <input 
                  type="checkbox" 
                  checked={graphicsSettings.translationEnabled} 
                  onChange={(e) => setGraphicsSettings({ ...graphicsSettings, translationEnabled: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                Enable Live Translation (Dual Output)
              </label>
            </div>
            {graphicsSettings.translationEnabled && (
              <div className="setting-item">
                <label>Translation Target</label>
                <input
                  type="text"
                  placeholder="e.g. Spanish, French, German"
                  value={graphicsSettings.translationTarget}
                  onChange={(e) => setGraphicsSettings({ ...graphicsSettings, translationTarget: e.target.value })}
                />
              </div>
            )}
            
            <div style={{ marginTop: "20px", padding: "15px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#60a5fa" }}>Import Database Song</h4>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <input type="text" placeholder="Song Title" value={importSong.title} onChange={(e) => setImportSong({ ...importSong, title: e.target.value })} style={{ flex: 1, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px", borderRadius: "4px" }} />
                <button onClick={handleAutoFetchSong} disabled={isFetchingSong} style={{ background: "#8b5cf6", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: isFetchingSong ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                  {isFetchingSong ? "⏳ Fetching..." : "🤖 Auto-Fetch via AI"}
                </button>
              </div>
              <textarea placeholder="Paste full lyrics here... (Double-space between sections) Or click Auto-Fetch to use AI." value={importSong.lyrics} onChange={(e) => setImportSong({ ...importSong, lyrics: e.target.value })} style={{ width: "100%", height: "80px", marginBottom: "8px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px", borderRadius: "4px", resize: "vertical" }} />
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={handleImportSong} style={{ flex: 1, background: "#3b82f6", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer" }}>Save Manual Lyrics to DB</button>
                <button onClick={() => { if(confirm('Are you sure you want to clear ALL songs from the database?')) socketRef.current?.emit('clear_songs'); }} style={{ background: "#ef4444", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer" }}>Clear DB</button>
              </div>
              <div style={{ marginTop: "10px", padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "4px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem", color: "#e2e8f0" }}>Import from CSV (Holyrics), Word (.docx) or PowerPoint (.pptx)</label>
                <input 
                  type="file" 
                  accept=".csv,.txt,.docx,.pptx,.ppt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const extension = file.name.split('.').pop()?.toLowerCase();
                      
                      let title = file.name;
                      const lastDotIndex = title.lastIndexOf('.');
                      if (lastDotIndex !== -1) title = title.substring(0, lastDotIndex);
                      
                      let artist = "Unknown Artist";
                      if (title.includes(' - ')) {
                        const parts = title.split(' - ');
                        title = parts[0].trim();
                        artist = parts[1].trim();
                      }
                      
                      if (extension === 'docx' || extension === 'pptx' || extension === 'ppt') {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          if (ev.target?.result) {
                            if (extension === 'docx') {
                              socketRef.current?.emit('import_docx', { title, artist, buffer: ev.target.result });
                            } else {
                              socketRef.current?.emit('import_pptx', { title, artist, buffer: ev.target.result });
                            }
                          }
                        };
                        reader.readAsArrayBuffer(file);
                      } else {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          if (ev.target?.result) {
                            socketRef.current?.emit('import_csv', ev.target.result);
                          }
                        };
                        reader.readAsText(file);
                      }
                    }
                  }}
                  style={{ width: "100%", fontSize: "0.85rem" }} 
                />
              </div>
              {/* Songs List */}
              {songsList && songsList.length > 0 && (
                <div style={{ marginTop: "15px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "10px" }}>
                  <div 
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    onClick={() => setIsSongsListExpanded(!isSongsListExpanded)}
                  >
                    <h5 style={{ margin: "0", color: "#a78bfa" }}>Songs in Database ({songsList.length})</h5>
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{isSongsListExpanded ? "▲ Collapse" : "▼ Expand"}</span>
                  </div>
                  
                  {isSongsListExpanded && (
                    <div style={{ marginTop: "10px" }}>
                      <input 
                        type="text" 
                        placeholder="Search songs..." 
                        value={songSearchQuery}
                        onChange={(e) => setSongSearchQuery(e.target.value)}
                        style={{ width: "100%", padding: "6px", marginBottom: "8px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "4px", fontSize: "0.85rem" }}
                      />
                      <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "5px", paddingRight: "5px" }}>
                        {songsList.filter(song => song.title.toLowerCase().includes(songSearchQuery.toLowerCase()) || song.artist.toLowerCase().includes(songSearchQuery.toLowerCase())).map(song => (
                          <div key={song.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)", padding: "6px 10px", borderRadius: "4px", fontSize: "0.85rem" }}>
                            <span style={{ color: "#e2e8f0" }}>{song.title} <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>({song.artist})</span></span>
                            <div style={{ display: "flex", gap: "5px" }}>
                              <button 
                                onClick={() => socketRef.current?.emit('get_song_lyrics', song.title)}
                                style={{ background: "transparent", color: "#3b82f6", border: "1px solid #3b82f6", borderRadius: "3px", padding: "2px 6px", cursor: "pointer", fontSize: "0.75rem" }}
                              >
                                View
                              </button>
                              <button 
                                onClick={() => { if(confirm(`Delete "${song.title}"?`)) socketRef.current?.emit('delete_song', song.title); }}
                                style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "3px", padding: "2px 6px", cursor: "pointer", fontSize: "0.75rem" }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                        {songsList.filter(song => song.title.toLowerCase().includes(songSearchQuery.toLowerCase()) || song.artist.toLowerCase().includes(songSearchQuery.toLowerCase())).length === 0 && (
                           <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic", textAlign: "center", marginTop: "10px" }}>No songs match your search.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Universal API Bedrock */}
          <div className="settings-section">
            <h3>Integrations (API Bedrock)</h3>
            
            <div className="setting-item" style={{ marginBottom: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "#4ade80" }}>
                <input type="checkbox" checked={graphicsSettings.holyricsEnabled} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, holyricsEnabled: e.target.checked })} />
                Holyrics Connection
                <span title={`API Status: ${apiStatuses.holyrics}`} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: apiStatuses.holyrics === 'online' ? '#22c55e' : '#ef4444', display: 'inline-block', marginLeft: 'auto' }}></span>
              </label>
              {graphicsSettings.holyricsEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input type="text" placeholder="IP Address" value={graphicsSettings.holyricsIp} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, holyricsIp: e.target.value })} style={{ flex: 1 }} />
                    <input type="text" placeholder="Port" style={{ width: "70px" }} value={graphicsSettings.holyricsPort} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, holyricsPort: e.target.value })} />
                  </div>
                  <input type="text" placeholder="API Token (Optional)" value={graphicsSettings.holyricsToken || ''} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, holyricsToken: e.target.value })} />
                </div>
              )}
            </div>

            <div className="setting-item" style={{ marginBottom: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "#60a5fa" }}>
                <input type="checkbox" checked={graphicsSettings.proPresenterEnabled} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, proPresenterEnabled: e.target.checked })} />
                ProPresenter 7 Connection
                <span title={`API Status: ${apiStatuses.proPresenter}`} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: apiStatuses.proPresenter === 'online' ? '#22c55e' : '#ef4444', display: 'inline-block', marginLeft: 'auto' }}></span>
              </label>
              {graphicsSettings.proPresenterEnabled && (
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <input type="text" placeholder="IP Address" value={graphicsSettings.proPresenterIp} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, proPresenterIp: e.target.value })} />
                  <input type="text" placeholder="Port" style={{ width: "70px" }} value={graphicsSettings.proPresenterPort} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, proPresenterPort: e.target.value })} />
                </div>
              )}
            </div>

            <div className="setting-item" style={{ marginBottom: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "#f87171" }}>
                <input type="checkbox" checked={graphicsSettings.vmixEnabled} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, vmixEnabled: e.target.checked })} />
                vMix Connection
                <span title={`API Status: ${apiStatuses.vmix}`} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: apiStatuses.vmix === 'online' ? '#22c55e' : '#ef4444', display: 'inline-block', marginLeft: 'auto' }}></span>
              </label>
              {graphicsSettings.vmixEnabled && (
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <input type="text" placeholder="IP Address" value={graphicsSettings.vmixIp} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, vmixIp: e.target.value })} />
                  <input type="text" placeholder="Input Name" value={graphicsSettings.vmixInput} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, vmixInput: e.target.value })} />
                </div>
              )}
            </div>

            <div className="setting-item">
              <label style={{ color: "#fbbf24", marginBottom: "8px", display: "block", fontWeight: "bold" }}>
                OBS Studio & EasyWorship
              </label>
              <div style={{ fontSize: "0.85rem", color: "#ccc", lineHeight: "1.4", marginBottom: "8px" }}>
                These do not require API IP settings. Instead, add a <strong>Browser Source</strong> in your software and paste this local overlay URL:
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  readOnly 
                  value="http://localhost:3000/output" 
                  style={{ background: "rgba(0,0,0,0.5)", color: "#4ade80", cursor: "text", flex: 1, padding: "10px", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: "4px" }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button 
                  onClick={handleLaunchOutput}
                  style={{ background: "#7c3aed", color: "white", border: "none", padding: "0 15px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Pop Out
                </button>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div className="settings-section">
            <h3>Output Background</h3>
            <div className="setting-item">
              <label>Animation Style</label>
              <select
                value={graphicsSettings.outputBgType}
                onChange={(e) => setGraphicsSettings({ ...graphicsSettings, outputBgType: e.target.value })}
              >
                <option value="solid">Solid Color</option>
                <option value="transparent">Transparent (OBS Browser Source)</option>
                <option value="chroma-green">Chroma Key (Green Screen)</option>
                <option value="tech-grid">Tech Grid (Moving Cyber Grid)</option>
                <option value="scanlines">Scanlines (Retro CRT Effect)</option>
                <option value="starfield">Starfield (Deep Space Parallax)</option>
              </select>
            </div>
            {graphicsSettings.outputBgType !== "transparent" && graphicsSettings.outputBgType !== "chroma-green" && (
              <div className="setting-item">
                <label>Primary Background</label>
                <input type="color" value={graphicsSettings.outputBgColor1 || "#000000"} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, outputBgColor1: e.target.value })} />
              </div>
            )}
            {graphicsSettings.outputBgType !== "solid" && graphicsSettings.outputBgType !== "starfield" && graphicsSettings.outputBgType !== "transparent" && graphicsSettings.outputBgType !== "chroma-green" && (
              <div className="setting-item">
                <label>Secondary Color (Lines/Patterns)</label>
                <input type="color" value={graphicsSettings.outputBgColor2 || "#1a1a2e"} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, outputBgColor2: e.target.value })} />
              </div>
            )}
          </div>
          
          <div className="settings-section">
            <h3>Content Settings</h3>
            <div className="setting-item">
              <label>Spoken Word Placement</label>
              <select
                value={graphicsSettings.spokenWordPosition}
                onChange={(e) => setGraphicsSettings({ ...graphicsSettings, spokenWordPosition: e.target.value as any })}
              >
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="middle-left">Middle Left</option>
                <option value="full-screen">Middle Center</option>
                <option value="middle-right">Middle Right</option>
                <option value="lower-third">Bottom Left</option>
                <option value="subtitle">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Lyrics Placement</label>
              <select
                value={graphicsSettings.lyricsPosition}
                onChange={(e) => setGraphicsSettings({ ...graphicsSettings, lyricsPosition: e.target.value as any })}
              >
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="middle-left">Middle Left</option>
                <option value="full-screen">Middle Center</option>
                <option value="middle-right">Middle Right</option>
                <option value="lower-third">Bottom Left</option>
                <option value="subtitle">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Scripture Placement</label>
              <select
                value={graphicsSettings.scripturePosition}
                onChange={(e) => setGraphicsSettings({ ...graphicsSettings, scripturePosition: e.target.value as any })}
              >
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="middle-left">Middle Left</option>
                <option value="full-screen">Middle Center</option>
                <option value="middle-right">Middle Right</option>
                <option value="lower-third">Bottom Left</option>
                <option value="subtitle">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Default Bible Version</label>
              <select
                value={graphicsSettings.defaultBibleVersion}
                onChange={(e) => setGraphicsSettings({ ...graphicsSettings, defaultBibleVersion: e.target.value })}
              >
                <option value="kjv">KJV (King James Version)</option>
                <option value="web">WEB (World English Bible)</option>
                <option value="asv">ASV (American Standard Version)</option>
                <option value="bbe">BBE (Bible in Basic English)</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Speech Recognition Language</label>
              <select
                value={graphicsSettings.speechLanguage}
                onChange={(e) => {
                  setGraphicsSettings({ ...graphicsSettings, speechLanguage: e.target.value });
                  // We need to restart audio if it's currently on for changes to take effect
                  if (audioEnabled) {
                     alert("Please turn Audio OFF and then back ON for the language change to take effect.");
                  }
                }}
              >
                <option value="en-NG">English (Nigeria)</option>
                <option value="en-US">English (United States)</option>
                <option value="en-GB">English (United Kingdom)</option>
                <option value="en-ZA">English (South Africa)</option>
              </select>
            </div>
          </div>
          
          <div className="settings-section">
            <h3>Typography</h3>
            <div className="setting-item">
              <label>Font Family</label>
              <select
                value={graphicsSettings.fontFamily}
                onChange={(e) => setGraphicsSettings({ ...graphicsSettings, fontFamily: e.target.value })}
                onClick={loadLocalFonts}
              >
                {availableFonts.map((font) => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
              {!fontsLoaded && (
                <span style={{ fontSize: "0.75rem", color: "var(--accent-blue)", marginTop: "4px" }}>
                  Click to load system fonts...
                </span>
              )}
            </div>
            <div className="setting-item">
              <label>Font Size ({graphicsSettings.fontSize}px)</label>
              <input type="range" min="16" max="120" value={graphicsSettings.fontSize} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, fontSize: Number(e.target.value) })} />
            </div>
            <div className="setting-item">
              <label>Line Height ({graphicsSettings.lineHeight})</label>
              <input type="range" min="1.0" max="3.0" step="0.1" value={graphicsSettings.lineHeight} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, lineHeight: Number(e.target.value) })} />
            </div>
          </div>

          {/* Colors */}
          <div className="settings-section">
            <h3>Colors</h3>
            <div className="setting-item">
              <label>Text Color</label>
              <input type="color" value={graphicsSettings.textColor} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, textColor: e.target.value })} />
            </div>
            <div className="setting-item">
              <label>Background Opacity ({graphicsSettings.bgOpacity}%)</label>
              <input type="range" min="0" max="100" value={graphicsSettings.bgOpacity} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, bgOpacity: Number(e.target.value) })} />
            </div>
          </div>

          {/* Camera Legibility */}
          <div className="settings-section">
            <h3>Camera Legibility</h3>
            <div className="setting-item">
              <label>Stroke Width ({graphicsSettings.strokeWidth}px)</label>
              <input type="range" min="0" max="8" value={graphicsSettings.strokeWidth} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, strokeWidth: Number(e.target.value) })} />
            </div>
            <div className="setting-item">
              <label>Stroke Color</label>
              <input type="color" value={graphicsSettings.strokeColor} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, strokeColor: e.target.value })} />
            </div>
            <div className="setting-item">
              <label>Shadow X ({graphicsSettings.shadowX}px)</label>
              <input type="range" min="-20" max="20" value={graphicsSettings.shadowX} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, shadowX: Number(e.target.value) })} />
            </div>
            <div className="setting-item">
              <label>Shadow Y ({graphicsSettings.shadowY}px)</label>
              <input type="range" min="-20" max="20" value={graphicsSettings.shadowY} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, shadowY: Number(e.target.value) })} />
            </div>
            <div className="setting-item">
              <label>Shadow Blur ({graphicsSettings.shadowBlur}px)</label>
              <input type="range" min="0" max="50" value={graphicsSettings.shadowBlur} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, shadowBlur: Number(e.target.value) })} />
            </div>
            <div className="setting-item">
              <label>Shadow Color</label>
              <input
                type="text"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px", borderRadius: "6px" }}
                value={graphicsSettings.shadowColor}
                onChange={(e) => setGraphicsSettings({ ...graphicsSettings, shadowColor: e.target.value })}
              />
            </div>
          </div>

          {/* Animations */}
          <div className="settings-section">
            <h3>Animations</h3>
            <div className="setting-item" style={{ flexDirection: "row", alignItems: "center" }}>
              <input type="checkbox" checked={graphicsSettings.animationEnabled} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, animationEnabled: e.target.checked })} id="animToggle" />
              <label htmlFor="animToggle">Enable Animations</label>
            </div>
            <div className="setting-item">
              <label>Entrance Animation</label>
              <select value={graphicsSettings.entranceAnimation} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, entranceAnimation: e.target.value })}>
                <option value="slide-up">Slide Up</option>
                <option value="fade-in">Fade In</option>
                <option value="zoom-in">Zoom In</option>
                <option value="typewriter">Typewriter</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Exit Animation</label>
              <select value={graphicsSettings.exitAnimation} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, exitAnimation: e.target.value })}>
                <option value="fade-out">Fade Out</option>
                <option value="slide-down">Slide Down</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Speed ({graphicsSettings.animationSpeed}ms)</label>
              <input type="range" min="200" max="800" step="50" value={graphicsSettings.animationSpeed} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, animationSpeed: Number(e.target.value) })} />
            </div>
          </div>
          <button
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors"
            onClick={() => {
              socketRef.current?.emit("update_settings", graphicsSettings);
              localStorage.setItem('contextEngineSettings', JSON.stringify(graphicsSettings));
              setSettingsOpen(false);
            }}
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* EDIT SONG MODAL */}
      <div className={`drawer-overlay ${editingSong ? 'open' : ''}`} onClick={() => setEditingSong(null)}></div>
      <div className={`settings-drawer ${editingSong ? 'open' : ''}`}>
        <div className="settings-header">
          <h2>Edit Song: {editingSong?.title}</h2>
          <button className="close-btn" onClick={() => setEditingSong(null)}>✕</button>
        </div>
        <div className="settings-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '10px' }}>
            Format sections like <code>[Verse 1]</code> or <code>[Chorus]</code>. Each section must be separated by a double line break.
          </p>
          <textarea 
            value={editingSong?.lyrics || ''} 
            onChange={(e) => setEditingSong(prev => prev ? { ...prev, lyrics: e.target.value } : null)}
            style={{ flex: 1, minHeight: '300px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9rem', resize: 'vertical' }}
          />
          <button
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors"
            onClick={() => {
              if (editingSong) {
                socketRef.current?.emit("edit_song_lyrics", editingSong);
                setEditingSong(null);
              }
            }}
          >
            Save Lyrics
          </button>
        </div>
      </div>

      {/* TOP BAR */}
      <header className="top-bar glass-panel">
        <h1 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div>Corpus</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: socketConnected ? '#22c55e' : '#ef4444', display: 'inline-block' }}></span>
            <span style={{ color: socketConnected ? '#22c55e' : '#ef4444' }}>{socketConnected ? 'Connected' : 'Reconnecting...'}</span>
          </div>
        </h1>
        <div className="toggles-group">
          {screens.length > 0 && (
            <select 
              value={selectedScreenId} 
              onChange={e => setSelectedScreenId(e.target.value)}
              className="toggle-btn"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {screens.map((s, i) => (
                <option key={s.id} value={s.id} style={{background: '#111'}}>
                  {s.label || `Screen ${i + 1}`} {s.isExtended ? '(Ext)' : ''}
                </option>
              ))}
            </select>
          )}
          <button 
            className="toggle-btn" 
            data-tooltip="Launch on Target Screen" 
            style={{ background: "rgba(139, 92, 246, 0.2)", border: "1px solid #8b5cf6", color: "#c4b5fd", fontWeight: "bold" }}
            onClick={handleLaunchOutput}
          >
            🖥️ Launch Output
          </button>
          <button className="toggle-btn bible-nav-btn" onClick={() => router.push('/bible')} title="Shortcut: Ctrl + B" data-tooltip="Ctrl + B">
            📖 Bible
          </button>
          {subStatus.startsWith('trial_') && (
            <button className="toggle-btn" data-tooltip="Upgrade Plan" style={{ background: "rgba(234, 179, 8, 0.2)", border: "1px solid #eab308", color: "#fef08a", fontWeight: "bold" }} onClick={() => setShowSubscription(true)}>
              ⭐ Subscribe
            </button>
          )}
          {!activeSessionId ? (
            <button className="toggle-btn" data-tooltip="Start Recording Session" style={{ background: "rgba(34, 197, 94, 0.2)", border: "1px solid #22c55e", color: "#22c55e" }} onClick={() => socketRef.current?.emit('start_session')}>
              ▶ Start Session
            </button>
          ) : (
            <button className="toggle-btn" data-tooltip="End & Export Session" style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", color: "#ef4444" }} onClick={() => socketRef.current?.emit('end_session')}>
              ⏹ End Session
            </button>
          )}
          <button className={`toggle-btn ${graphicsSettings.lyricsModeEnabled ? "active" : ""}`} data-tooltip="Toggle Lyrics Mode" onClick={() => {
            const newSettings = {...graphicsSettings, lyricsModeEnabled: !graphicsSettings.lyricsModeEnabled};
            setGraphicsSettings(newSettings);
            socketRef.current?.emit("update_settings", newSettings);
            localStorage.setItem('contextEngineSettings', JSON.stringify(newSettings));
          }}>
            🎵 Lyrics {graphicsSettings.lyricsModeEnabled ? "ON" : "OFF"}
          </button>
          <button className={`toggle-btn ${graphicsSettings.translationEnabled ? "active" : ""}`} data-tooltip="Toggle Translation" onClick={() => {
            const newSettings = {...graphicsSettings, translationEnabled: !graphicsSettings.translationEnabled};
            setGraphicsSettings(newSettings);
            socketRef.current?.emit("update_settings", newSettings);
            localStorage.setItem('contextEngineSettings', JSON.stringify(newSettings));
          }}>
            🌐 Translate {graphicsSettings.translationEnabled ? "ON" : "OFF"}
          </button>
          <button className={`toggle-btn ${graphicsSettings.aiExtractionEnabled ? "active" : ""}`} data-tooltip="Toggle AI Extraction" onClick={() => {
            const newSettings = {...graphicsSettings, aiExtractionEnabled: !graphicsSettings.aiExtractionEnabled};
            setGraphicsSettings(newSettings);
            socketRef.current?.emit("update_settings", newSettings);
            localStorage.setItem('contextEngineSettings', JSON.stringify(newSettings));
          }}>
            🤖 AI Extraction {graphicsSettings.aiExtractionEnabled ? "ON" : "OFF"}
          </button>
          <button className={`toggle-btn ${audioEnabled ? "active" : ""}`} data-tooltip="Toggle Microphone" onClick={toggleAudio}>
            {audioEnabled ? "🎙️" : "🔇"} Audio {audioEnabled ? "ON" : "OFF"}
          </button>
          <button className={`toggle-btn ${captionsEnabled ? "active" : ""}`} data-tooltip="Toggle Captions" onClick={() => setCaptionsEnabled(!captionsEnabled)}>
            💬 Captions {captionsEnabled ? "ON" : "OFF"}
          </button>
          <button className={`toggle-btn ${autoPush ? "active" : ""}`} data-tooltip="Auto-Push Cards" onClick={() => setAutoPush(!autoPush)}>
            🚀 Auto-Push {autoPush ? "ON" : "OFF"}
          </button>
          <button className="toggle-btn" data-tooltip="Open Settings" onClick={() => setSettingsOpen(true)}>
            ⚙️ Settings
          </button>
          <button className="toggle-btn" data-tooltip="Sign Out" style={{ color: "#ef4444" }} onClick={async () => {
            await supabase.auth.signOut();
            localStorage.removeItem('ce_stagingQueue');
            localStorage.removeItem('ce_transcript');
            localStorage.removeItem('supabase_user');
            window.location.reload();
          }}>
            🚪 Sign Out
          </button>
        </div>
      </header>

      {/* MAIN PANELS */}
      <main className="main-content">
        {/* LEFT: Live Transcript */}
        <section className="panel-column glass-panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Live Transcript
              {audioEnabled && <div className="pulse-dot" />}
            </div>
            <button 
              onClick={() => {
                if (transcript.length === 0) return alert("Transcript is empty");
                const text = transcript.join("\n");
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `transcript-${new Date().toISOString().slice(0,10)}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              💾 Save
            </button>
          </div>
          <div className="scrollable-content">
            {transcript.map((line, i) => (
              <div key={i} className="transcript-line">{line}</div>
            ))}
            {interimText && (
              <div className="transcript-line transcript-interim">{interimText}</div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </section>

        {/* MIDDLE: Staging Queue */}
        <section className="panel-column glass-panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Staging Queue
              <span className="queue-badge">{stagingQueue.length} items</span>
            </div>
            <button 
              onClick={() => {
                if (confirm('Are you sure you want to clear the queue history?')) {
                  setStagingQueue([]);
                  localStorage.removeItem('ce_stagingQueue');
                }
              }}
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              🗑️ Clear
            </button>
          </div>
          <div className="scrollable-content">
            {stagingQueue.map((card, idx) => (
              <div 
                key={card.id} 
                className="queue-card"
                style={{
                  border: idx === selectedCardIndex ? "2px solid #3b82f6" : "1px solid var(--border-light)",
                  boxShadow: idx === selectedCardIndex ? "0 0 10px rgba(59, 130, 246, 0.5)" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                <div className={`card-type badge-${card.type}`}>
                  {card.type}
                  <span className="edit-icon" title="Edit this card">✏️ Edit</span>
                </div>
                <textarea
                  className="card-textarea"
                  value={card.content}
                  onChange={(e) => handleCardContentChange(card.id, e.target.value)}
                  spellCheck="true"
                  lang="en-NG"
                />
                <select className="card-preset" value={card.preset} onChange={(e) => handleCardPresetChange(card.id, e.target.value as PresetType)}>
                  <option value="top-left">Top Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                  <option value="middle-left">Middle Left</option>
                  <option value="full-screen">Middle Center</option>
                  <option value="middle-right">Middle Right</option>
                  <option value="lower-third">Bottom Left</option>
                  <option value="subtitle">Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
                {card.type === "lyric" && card.songSections && (
                  <div style={{ padding: "10px 15px", display: "flex", gap: "8px", flexWrap: "wrap", background: "rgba(0,0,0,0.2)" }}>
                    <span style={{ fontSize: "0.8rem", color: "#aaa", width: "100%", marginBottom: "5px" }}>Quick Jump:</span>
                    {card.songSections.map((sec, idx) => {
                      const isActive = card.activeSectionIndex === idx || (card.activeSectionIndex === undefined && card.content === sec.text);
                      return (
                        <button
                          key={idx}
                          style={{ 
                            padding: "4px 10px", 
                            background: isActive ? "rgba(59, 130, 246, 0.5)" : "rgba(255,255,255,0.1)", 
                            border: isActive ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.2)", 
                            color: "#fff", 
                            borderRadius: "4px", 
                            fontSize: "0.75rem", 
                            cursor: "pointer",
                            fontWeight: isActive ? "bold" : "normal"
                          }}
                          onClick={() => {
                             const newCard: StagingCard = { ...card, content: sec.text, id: Date.now().toString(), type: "lyric", activeSectionIndex: idx };
                             pushLive(newCard);
                          }}
                        >
                          {sec.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="card-actions">
                  <button className="btn btn-discard" onClick={() => discardCard(card.id)}>Discard</button>
                  <button className="btn btn-push" onClick={() => pushLive(card)}>PUSH LIVE</button>
                </div>
              </div>
            ))}
            {stagingQueue.length === 0 && (
              <div className="empty-queue-msg">
                No items in queue. Toggle Audio ON to start detecting...
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: Program Output */}
        <section className="panel-column glass-panel" style={{ flex: 1.5 }}>
          <div className="panel-header">
            Program Output
            {liveContent && <span className="on-air-badge">ON AIR</span>}
          </div>
          <div className={`live-output-preview bg-${graphicsSettings.outputBgType}`}>
            {graphicsSettings.outputBgType === "starfield" && (
              <>
                <div className="stars1"></div>
                <div className="stars2"></div>
              </>
            )}
            {liveContent && (
              <div className={`live-output-wrapper ${getPresetClass(liveContent.preset)}`}>
                <div
                  className={`live-text ${getEntranceClass()}`}
                  style={{
                    fontFamily: graphicsSettings.fontFamily,
                    fontSize: `${graphicsSettings.fontSize}px`,
                    lineHeight: graphicsSettings.lineHeight,
                    color: graphicsSettings.textColor,
                    WebkitTextStroke: `${graphicsSettings.strokeWidth}px ${graphicsSettings.strokeColor}`,
                    paintOrder: "stroke fill",
                    textShadow: `${graphicsSettings.shadowX}px ${graphicsSettings.shadowY}px ${graphicsSettings.shadowBlur}px ${graphicsSettings.shadowColor}`,
                    "--anim-speed": `${graphicsSettings.animationSpeed}ms`,
                  } as React.CSSProperties}
                >
                  {liveContent.content}
                </div>
              </div>
            )}
            {!liveContent && (
              <div className="screen-clear-msg">Screen is Clear</div>
            )}
            <button className="btn btn-clear" onClick={clearLive}>CLEAR SCREEN</button>
          </div>
        </section>
      </main>
    </div>
    </>
  );
}

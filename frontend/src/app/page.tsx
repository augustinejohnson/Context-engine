"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "../lib/supabaseClient";
import AuthScreen from "../components/AuthScreen";
import dynamic from 'next/dynamic';
const SubscriptionScreen = dynamic(() => import("../components/SubscriptionScreen"), { ssr: false });

/* ── Types ─────────────────────────────────────────────── */
type CardType = "scripture" | "knowledge" | "lyric";
type PresetType = "lower-third" | "full-screen" | "subtitle";

export interface StagingCard {
  id: string;
  type: CardType;
  content: string;
  preset: PresetType;
  translation?: string; // Dual-Language Output
  songSections?: { name: string, text: string }[]; // For Lyric quick jumps
  activeSectionIndex?: number;
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
  openAIApiKey: string;
  aiExtractionEnabled: boolean;
  aiProvider: string;
  aiBaseUrl: string;
  aiModel: string;
  outputBgType: string;
  outputBgColor1: string;
  outputBgColor2: string;
  speechLanguage: string;
  aiExtractionTarget: "all" | "scriptures" | "knowledge";
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
  const [isMounted, setIsMounted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [subStatus, setSubStatus] = useState<string>("loading");
  
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

  const [liveContent, setLiveContent] = useState<{ content: string; preset: PresetType } | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availableFonts, setAvailableFonts] = useState<string[]>(FALLBACK_FONTS);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [availableAiModels, setAvailableAiModels] = useState<{id: string, name: string}[]>([]);

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
    openAIApiKey: "",
    aiExtractionEnabled: false,
    aiProvider: "openrouter",
    aiBaseUrl: "https://openrouter.ai/api/v1",
    aiModel: "google/gemini-1.5-flash",
    outputBgType: "solid",
    outputBgColor1: "#000000",
    outputBgColor2: "#1a1a2e",
    speechLanguage: "en-NG",
    aiExtractionTarget: "all",
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
    vmixInput: "Title 1",
  });
  
  const [songsList, setSongsList] = useState<{id: number, title: string, artist: string}[]>([]);
  const [songSearchQuery, setSongSearchQuery] = useState("");
  const [isSongsListExpanded, setIsSongsListExpanded] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(true);
  const [apiStatuses, setApiStatuses] = useState({ holyrics: 'offline', proPresenter: 'offline', vmix: 'offline' });

  const socketRef = useRef<Socket | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const fetchSub = async (userId: string) => {
      const { data, error } = await supabase.from('user_profiles').select('subscription_status').eq('id', userId).single();
      if (data) setSubStatus(data.subscription_status || "inactive");
      else setSubStatus("inactive");
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) fetchSub(session.user.id);
      else setSubStatus("inactive");
    });
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) fetchSub(session.user.id);
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

  /* ── Fetch OpenRouter Models ── */
  useEffect(() => {
    fetch('https://openrouter.ai/api/v1/models')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          const models = data.data.map((m: any) => ({ id: m.id, name: m.name })).sort((a: any, b: any) => a.name.localeCompare(b.name));
          setAvailableAiModels(models);
        }
      })
      .catch(err => console.error('[OpenRouter] Failed to fetch models:', err));
  }, []);

  /* ── Load/Save Settings from LocalStorage ── */
  useEffect(() => {
    const saved = localStorage.getItem('contextEngineSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.aiModel && parsed.aiModel.includes('gemini') && !parsed.aiModel.includes('gemini-3')) {
          parsed.aiModel = 'gemini-3-flash-preview';
        }
        setGraphicsSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse saved settings', e);
      }
    }
  }, []);

  /* ── Socket.io setup ── */
  useEffect(() => {
    const fallbackHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || `http://${fallbackHost}:3001`;
    
    socketRef.current = io(backendUrl, {
      auth: { token: session?.access_token }
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
    
    socketRef.current.on("session_status", (sessionId) => {
      setActiveSessionId(sessionId);
    });
    
    socketRef.current.on("session_ended", (sessionId) => {
      const fallbackHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || `http://${fallbackHost}:3001`;
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

    // Cloud-to-Local Bridge: Execute local network requests from the browser
    socketRef.current.on("trigger_local_api", (data: any) => {
      console.log("[Bridge] Triggering Local API:", data.action);
      
      if (data.action === 'push_live') {
        if (data.holyrics.enabled) {
          fetch(`http://${data.holyrics.ip}:${data.holyrics.port}/api/v1/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(data.holyrics.token ? {'Authorization': `Bearer ${data.holyrics.token}`} : {}) },
            body: JSON.stringify({ text: data.content })
          }).catch(e => console.error('[Bridge] Holyrics Error:', e.message));
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
          fetch(`http://${data.holyrics.ip}:${data.holyrics.port}/api/v1/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(data.holyrics.token ? {'Authorization': `Bearer ${data.holyrics.token}`} : {}) },
            body: JSON.stringify({ text: "" })
          }).catch(e => console.error('[Bridge] Holyrics Error:', e.message));
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
      setStagingQueue((prev) => [...prev, card]);
    });

    socketRef.current.on("song_lyrics_result", (data: { title: string, lyrics: string }) => {
      setEditingSong(data);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

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
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimText]);

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
        alert("Network error: The browser's speech recognition service could not be reached. Check your internet connection.");
        setAudioEnabled(false);
        recognitionRef.current = null;
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
              console.error("[Speech] Failed to auto-restart:", e);
              // If it fails (e.g., InvalidState), we can force a full re-initialization by simulating a toggle
              setAudioEnabled(false);
              setTimeout(() => setAudioEnabled(true), 500);
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
      case "full-screen": return "preset-full-screen";
      case "lower-third": return "preset-lower-third";
      case "subtitle": return "preset-subtitle";
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
    return <AuthScreen />;
  }

  if (subStatus === "loading") {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', color: 'white' }}>Loading Subscription Status...</div>;
  }

  if (subStatus !== "active") {
    return <SubscriptionScreen email={session.user.email} onSubscribeSuccess={() => setSubStatus("active")} />;
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
              <label>AI Provider</label>
              <select
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px", borderRadius: "6px", width: "100%" }}
                value={graphicsSettings.aiProvider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  let defaultModel = "google/gemini-1.5-flash";
                  let defaultBaseUrl = "https://openrouter.ai/api/v1";
                  if (newProvider === "openai") { defaultModel = "gpt-4o-mini"; defaultBaseUrl = "https://api.openai.com/v1"; }
                  else if (newProvider === "gemini") { defaultModel = "gemini-1.5-flash"; defaultBaseUrl = ""; }
                  else if (newProvider === "anthropic") { defaultModel = "claude-3-5-sonnet-latest"; defaultBaseUrl = ""; }
                  setGraphicsSettings({ ...graphicsSettings, aiProvider: newProvider, aiModel: defaultModel, aiBaseUrl: defaultBaseUrl });
                }}
              >
                <option value="openrouter">OpenRouter (Recommended)</option>
                <option value="openai">OpenAI (Native)</option>
                <option value="gemini">Google Gemini (Native)</option>
                <option value="anthropic">Anthropic Claude (Native)</option>
              </select>
            </div>
            <div className="setting-item">
              <label>API Key</label>
              <input
                type="password"
                placeholder="Enter API Key"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px", borderRadius: "6px", width: "100%" }}
                value={graphicsSettings.openAIApiKey}
                onChange={(e) => setGraphicsSettings({ ...graphicsSettings, openAIApiKey: e.target.value })}
              />
            </div>
            {(graphicsSettings.aiProvider === "openrouter" || graphicsSettings.aiProvider === "openai") && (
              <div className="setting-item">
                <label>API Base URL</label>
                <input
                  type="text"
                  placeholder="https://openrouter.ai/api/v1"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px", borderRadius: "6px", width: "100%" }}
                  value={graphicsSettings.aiBaseUrl}
                  onChange={(e) => setGraphicsSettings({ ...graphicsSettings, aiBaseUrl: e.target.value })}
                />
              </div>
            )}
            <div className="setting-item">
              <label>Model Name (Type or Select)</label>
              {graphicsSettings.aiProvider === 'openrouter' ? (
                <select 
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px", borderRadius: "6px", width: "100%" }}
                  value={graphicsSettings.aiModel} 
                  onChange={(e) => setGraphicsSettings({ ...graphicsSettings, aiModel: e.target.value })}
                >
                  <option value="">Select a model...</option>
                  {availableAiModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <div style={{ display: 'flex', gap: '5px', flexDirection: 'column' }}>
                  <select 
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px", borderRadius: "6px", width: "100%" }}
                    value={
                      graphicsSettings.aiProvider === 'gemini' 
                        ? (['gemini-1.5-flash', 'gemini-1.5-pro'].includes(graphicsSettings.aiModel) ? graphicsSettings.aiModel : 'custom')
                        : graphicsSettings.aiProvider === 'openai'
                        ? (['gpt-4o-mini', 'gpt-4o', 'o1-preview', 'o1-mini'].includes(graphicsSettings.aiModel) ? graphicsSettings.aiModel : 'custom')
                        : graphicsSettings.aiProvider === 'anthropic'
                        ? (['claude-3-5-sonnet-latest', 'claude-3-opus-latest'].includes(graphicsSettings.aiModel) ? graphicsSettings.aiModel : 'custom')
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setGraphicsSettings({ ...graphicsSettings, aiModel: e.target.value });
                      }
                    }}
                  >
                    {graphicsSettings.aiProvider === 'gemini' && (
                      <>
                        <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                        <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                      </>
                    )}
                    {graphicsSettings.aiProvider === 'openai' && (
                      <>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="o1-preview">o1 Preview</option>
                        <option value="o1-mini">o1 Mini</option>
                      </>
                    )}
                    {graphicsSettings.aiProvider === 'anthropic' && (
                      <>
                        <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
                        <option value="claude-3-opus-latest">Claude 3 Opus</option>
                      </>
                    )}
                    <option value="custom">Custom (Type below)</option>
                  </select>
                  <input 
                    type="text" 
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px", borderRadius: "6px", width: "100%" }}
                    value={graphicsSettings.aiModel}
                    onChange={(e) => setGraphicsSettings({ ...graphicsSettings, aiModel: e.target.value })}
                    placeholder="Or type manual model name..."
                  />
                </div>
              )}
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
          
          {/* Music & Translation Engine */}
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
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <input type="text" placeholder="IP Address" value={graphicsSettings.holyricsIp} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, holyricsIp: e.target.value })} />
                  <input type="text" placeholder="Port" style={{ width: "70px" }} value={graphicsSettings.holyricsPort} onChange={(e) => setGraphicsSettings({ ...graphicsSettings, holyricsPort: e.target.value })} />
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
              <input 
                type="text" 
                readOnly 
                value="http://localhost:3000/output" 
                style={{ background: "rgba(0,0,0,0.5)", color: "#4ade80", cursor: "text", width: "100%", padding: "10px", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: "4px" }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
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
              <label>Default Bible Version</label>
              <select
                value={graphicsSettings.defaultBibleVersion}
                onChange={(e) => setGraphicsSettings({ ...graphicsSettings, defaultBibleVersion: e.target.value })}
              >
                <option value="KJV">KJV (King James Version)</option>
                <option value="NIV">NIV (New International Version)</option>
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
          <div>Context Engine <span style={{ fontSize: "1rem", color: "var(--accent-purple)" }}>PRO</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: socketConnected ? '#22c55e' : '#ef4444', display: 'inline-block' }}></span>
            <span style={{ color: socketConnected ? '#22c55e' : '#ef4444' }}>{socketConnected ? 'Connected' : 'Reconnecting...'}</span>
          </div>
        </h1>
        <div className="toggles-group">
          {!activeSessionId ? (
            <button className="toggle-btn" style={{ background: "rgba(34, 197, 94, 0.2)", border: "1px solid #22c55e", color: "#22c55e" }} onClick={() => socketRef.current?.emit('start_session')}>
              ▶ Start Session
            </button>
          ) : (
            <button className="toggle-btn" style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", color: "#ef4444" }} onClick={() => socketRef.current?.emit('end_session')}>
              ⏹ End Session
            </button>
          )}
          <button className={`toggle-btn ${graphicsSettings.lyricsModeEnabled ? "active" : ""}`} onClick={() => {
            const newSettings = {...graphicsSettings, lyricsModeEnabled: !graphicsSettings.lyricsModeEnabled};
            setGraphicsSettings(newSettings);
            socketRef.current?.emit("update_settings", newSettings);
            localStorage.setItem('contextEngineSettings', JSON.stringify(newSettings));
          }}>
            🎵 Lyrics {graphicsSettings.lyricsModeEnabled ? "ON" : "OFF"}
          </button>
          <button className={`toggle-btn ${graphicsSettings.translationEnabled ? "active" : ""}`} onClick={() => {
            const newSettings = {...graphicsSettings, translationEnabled: !graphicsSettings.translationEnabled};
            setGraphicsSettings(newSettings);
            socketRef.current?.emit("update_settings", newSettings);
            localStorage.setItem('contextEngineSettings', JSON.stringify(newSettings));
          }}>
            🌐 Translate {graphicsSettings.translationEnabled ? "ON" : "OFF"}
          </button>
          <button className={`toggle-btn ${audioEnabled ? "active" : ""}`} onClick={toggleAudio}>
            {audioEnabled ? "🎙️" : "🔇"} Audio {audioEnabled ? "ON" : "OFF"}
          </button>
          <button className={`toggle-btn ${captionsEnabled ? "active" : ""}`} onClick={() => setCaptionsEnabled(!captionsEnabled)}>
            💬 Captions {captionsEnabled ? "ON" : "OFF"}
          </button>
          <button className={`toggle-btn ${autoPush ? "active" : ""}`} onClick={() => setAutoPush(!autoPush)}>
            🚀 Auto-Push {autoPush ? "ON" : "OFF"}
          </button>
          <button className="toggle-btn" onClick={() => setSettingsOpen(true)}>
            ⚙️ Settings
          </button>
        </div>
      </header>

      {/* MAIN PANELS */}
      <main className="main-content">
        {/* LEFT: Live Transcript */}
        <section className="panel-column glass-panel">
          <div className="panel-header">
            Live Transcript
            {audioEnabled && <div className="pulse-dot" />}
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
          <div className="panel-header">
            Staging Queue
            <span className="queue-badge">{stagingQueue.length} items</span>
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
                  <option value="lower-third">Lower-Third Banner</option>
                  <option value="full-screen">Full-Screen Centered</option>
                  <option value="subtitle">Subtitle Overlay</option>
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

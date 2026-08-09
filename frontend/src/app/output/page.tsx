"use client";

import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { StagingCard } from "../page";
import { supabase } from "@/lib/supabaseClient";

export default function OutputPage() {
  const [liveContent, setLiveContent] = useState<{ content: string; preset: string; type?: string } | null>(null);
  
  // Settings sync
  const [bgType, setBgType] = useState("solid");
  const [bgColor1, setBgColor1] = useState("#000000");
  const [bgColor2, setBgColor2] = useState("#1a1a2e");

  const [bibleBgType, setBibleBgType] = useState("parchment");
  const [bibleBgColor1, setBibleBgColor1] = useState("#f4ebd8");
  const [bibleBgColor2, setBibleBgColor2] = useState("#e6d5b8");

  const [isMounted, setIsMounted] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setIsMounted(true);
    
    const initSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("[Output] No session found, cannot connect to backend.");
        return;
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://context-engine-production-51a1.up.railway.app";
      socketRef.current = io(backendUrl, {
        auth: { token: session.access_token }
      });

      socketRef.current.on("connect", () => {
        socketRef.current?.emit("get_live_card");
      });

    socketRef.current.on("live_card", (cardData: StagingCard) => {
      setLiveContent({ content: cardData.content, preset: cardData.preset, type: cardData.type });
    });

    socketRef.current.on("clear_live", () => {
      setLiveContent(null);
    });

      socketRef.current.on("settings_updated", (settings: any) => {
        if (settings.outputBgType) setBgType(settings.outputBgType);
        if (settings.outputBgColor1) setBgColor1(settings.outputBgColor1);
        if (settings.outputBgColor2) setBgColor2(settings.outputBgColor2);
        if (settings.bibleBgType) setBibleBgType(settings.bibleBgType);
        if (settings.bibleBgColor1) setBibleBgColor1(settings.bibleBgColor1);
        if (settings.bibleBgColor2) setBibleBgColor2(settings.bibleBgColor2);
      });
    };

    initSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

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
      default: return "preset-full-screen";
    }
  };

  const getEntranceClass = () => {
    return "entrance-fade-in";
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

  if (!isMounted) return null;

  const isBible = liveContent?.type === "scripture";
  const activeBgType = isBible ? bibleBgType : bgType;
  const activeBgColor1 = isBible ? bibleBgColor1 : bgColor1;
  const activeBgColor2 = isBible ? bibleBgColor2 : bgColor2;

  return (
    <>
      <style>{`
        body { margin: 0; padding: 0; overflow: hidden; background: transparent; }
        
        .bg-solid { background-color: ${activeBgColor1}; }
        .bg-transparent { background-color: transparent !important; }
        .bg-chroma-green { background-color: #00FF00 !important; }
        
        /* Bible Specific */
        .bg-parchment {
          background-color: ${activeBgColor1};
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(0,0,0,0.02) 0%, transparent 20%),
            radial-gradient(circle at 80% 90%, rgba(0,0,0,0.03) 0%, transparent 30%);
          box-shadow: inset 0 0 100px rgba(0,0,0,0.1);
        }
        .bg-gradient {
          background: linear-gradient(135deg, ${activeBgColor1}, ${activeBgColor2});
        }
        
        /* Tech Grid */
        .bg-tech-grid {
          background-color: ${activeBgColor1};
          background-image: 
            linear-gradient(to right, ${activeBgColor2} 1px, transparent 1px),
            linear-gradient(to bottom, ${activeBgColor2} 1px, transparent 1px);
          background-size: 40px 40px;
          animation: animGrid 4s linear infinite;
        }

        /* Scanlines */
        .bg-scanlines {
          background-color: ${activeBgColor1};
          position: relative;
        }
        .bg-scanlines::after {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: repeating-linear-gradient(to bottom, transparent 0%, transparent 50%, ${activeBgColor2} 50%, ${activeBgColor2} 100%);
          background-size: 100% 4px;
          z-index: 1;
          pointer-events: none;
          opacity: 0.5;
        }

        /* Starfield */
        .bg-starfield {
          background-color: ${activeBgColor1};
          position: relative;
          overflow: hidden;
        }
      `}</style>
      <div className={`live-output-preview bg-${activeBgType}`} style={{ height: "100vh", borderRadius: 0, border: "none" }}>
        {activeBgType === "starfield" && (
          <>
            <div className="stars1" style={{ boxShadow: starsSmall }}></div>
            <div className="stars2" style={{ boxShadow: starsMedium }}></div>
          </>
        )}
        {liveContent && (
          <div className={`live-output-wrapper ${getPresetClass(liveContent.preset)}`}>
            <div className={`live-text ${getEntranceClass()}`}>
              {liveContent.content.split("\\n").map((line, i) => (
                <div key={i} style={{ marginBottom: line === "" ? "0.8em" : "0" }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

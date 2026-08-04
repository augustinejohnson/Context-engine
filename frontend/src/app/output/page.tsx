"use client";

import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { StagingCard } from "../page";

export default function OutputPage() {
  const [liveContent, setLiveContent] = useState<{ content: string; preset: string } | null>(null);
  
  // Settings sync
  const [bgType, setBgType] = useState("transparent");
  const [bgColor1, setBgColor1] = useState("#000000");
  const [bgColor2, setBgColor2] = useState("#1a1a2e");

  const [isMounted, setIsMounted] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const fallbackHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://context-engine-production-51a1.up.railway.app";
    socketRef.current = io(backendUrl);

    socketRef.current.on("live_card", (cardData: StagingCard) => {
      setLiveContent({ content: cardData.content, preset: cardData.preset });
    });

    socketRef.current.on("clear_live", () => {
      setLiveContent(null);
    });

    socketRef.current.on("settings_updated", (settings: any) => {
      if (settings.outputBgType) setBgType(settings.outputBgType);
      if (settings.outputBgColor1) setBgColor1(settings.outputBgColor1);
      if (settings.outputBgColor2) setBgColor2(settings.outputBgColor2);
    });

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

  return (
    <>
      <style>{`
        body { margin: 0; padding: 0; overflow: hidden; background: transparent; }
        
        .bg-solid { background-color: ${bgColor1}; }
        .bg-transparent { background-color: transparent !important; }
        .bg-chroma-green { background-color: #00FF00 !important; }
        
        /* Tech Grid */
        .bg-tech-grid {
          background-color: ${bgColor1};
          background-image: 
            linear-gradient(to right, ${bgColor2} 1px, transparent 1px),
            linear-gradient(to bottom, ${bgColor2} 1px, transparent 1px);
          background-size: 40px 40px;
          animation: animGrid 4s linear infinite;
        }

        /* Scanlines */
        .bg-scanlines {
          background-color: ${bgColor1};
          position: relative;
        }
        .bg-scanlines::after {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: repeating-linear-gradient(to bottom, transparent 0%, transparent 50%, ${bgColor2} 50%, ${bgColor2} 100%);
          background-size: 100% 4px;
          z-index: 1;
          pointer-events: none;
          opacity: 0.5;
        }

        /* Starfield */
        .bg-starfield {
          background-color: ${bgColor1};
          position: relative;
          overflow: hidden;
        }
      `}</style>
      <div className={`live-output-preview bg-${bgType}`} style={{ height: "100vh", borderRadius: 0, border: "none" }}>
        {bgType === "starfield" && (
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

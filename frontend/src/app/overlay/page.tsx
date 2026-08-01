"use client";

import React, { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import "./overlay.css";

type PresetType = "lower-third" | "full-screen" | "subtitle";

interface LiveCard {
  id: string;
  type: string;
  content: string;
  preset: PresetType;
}

interface GraphicsSettings {
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
}

const DEFAULT_SETTINGS: GraphicsSettings = {
  fontFamily: "Inter",
  fontSize: 48,
  lineHeight: 1.5,
  textColor: "#ffffff",
  bgOpacity: 0,
  strokeWidth: 2,
  strokeColor: "#000000",
  shadowX: 0,
  shadowY: 4,
  shadowBlur: 12,
  shadowColor: "rgba(0,0,0,0.8)",
  animationEnabled: true,
  entranceAnimation: "slide-up",
  exitAnimation: "fade-out",
  animationSpeed: 400,
};

/* ── Animation Variants ────────────────────────────────── */

function getEntranceVariant(animation: string) {
  switch (animation) {
    case "fade-in":
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
    case "zoom-in":
      return { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 } };
    case "typewriter":
      return { initial: { clipPath: "inset(0 100% 0 0)" }, animate: { clipPath: "inset(0 0% 0 0)" } };
    case "slide-up":
    default:
      return { initial: { opacity: 0, y: 80 }, animate: { opacity: 1, y: 0 } };
  }
}

function getExitVariant(animation: string) {
  switch (animation) {
    case "slide-down":
      return { opacity: 0, y: 80 };
    case "fade-out":
    default:
      return { opacity: 0 };
  }
}

/* ── Component ─────────────────────────────────────────── */

export default function OverlayPage() {
  const [liveCard, setLiveCard] = useState<LiveCard | null>(null);
  const [settings, setSettings] = useState<GraphicsSettings>(DEFAULT_SETTINGS);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const backendHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const socket = io(`http://${backendHost}:3001`);
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Overlay] Connected to backend:", socket.id);
    });

    socket.on("live_card", (card: LiveCard) => {
      console.log("[Overlay] Received live_card:", card);
      setLiveCard(card);
    });

    socket.on("clear_live", () => {
      console.log("[Overlay] Screen cleared.");
      setLiveCard(null);
    });

    socket.on("settings_updated", (s: GraphicsSettings) => {
      console.log("[Overlay] Settings updated.");
      setSettings(s);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  /* ── Derived values ── */
  const entrance = getEntranceVariant(settings.entranceAnimation);
  const exit = getExitVariant(settings.exitAnimation);
  const speed = settings.animationEnabled ? settings.animationSpeed / 1000 : 0;

  const textStyle: React.CSSProperties = {
    fontFamily: settings.fontFamily,
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    color: settings.textColor,
    WebkitTextStroke: settings.strokeWidth > 0
      ? `${settings.strokeWidth}px ${settings.strokeColor}`
      : undefined,
    paintOrder: "stroke fill",
    textShadow: `${settings.shadowX}px ${settings.shadowY}px ${settings.shadowBlur}px ${settings.shadowColor}`,
  };

  const bgStyle: React.CSSProperties =
    settings.bgOpacity > 0
      ? {
          backgroundColor: `rgba(0, 0, 0, ${settings.bgOpacity / 100})`,
          backdropFilter: settings.bgOpacity > 30 ? "blur(8px)" : undefined,
        }
      : {};

  return (
    <div className="overlay-root">
      <AnimatePresence mode="wait">
        {liveCard && (
          <motion.div
            key={liveCard.id ?? liveCard.content}
            className={`overlay-container overlay-${liveCard.preset ?? "lower-third"}`}
            initial={entrance.initial}
            animate={entrance.animate}
            exit={exit}
            transition={{
              duration: speed,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="overlay-card" style={bgStyle}>
              {/* Decorative accent bar for lower-third */}
              {(liveCard.preset === "lower-third" || !liveCard.preset) && (
                <div className="overlay-accent-bar" />
              )}

              <p className="overlay-text" style={textStyle}>
                {liveCard.content}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

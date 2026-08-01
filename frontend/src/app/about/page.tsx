"use client";
import React from 'react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#09090b',
      color: '#f8fafc',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflowY: 'auto'
    }}>
      {/* Background Mesh */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
        background: 'radial-gradient(circle at 10% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 40%)'
      }} />

      {/* Navigation */}
      <nav style={{
        position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between',
        padding: '24px 48px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, background: 'linear-gradient(135deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Context Engine PRO
          </h1>
          <Link href="/" style={{ color: '#a1a1aa', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}>Home</Link>
          <Link href="/about" style={{ color: '#fff', textDecoration: 'none', fontWeight: 500 }}>About</Link>
        </div>
        <a 
          href="https://wa.me/2341234567890" 
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
      </nav>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '900px', margin: '60px auto', padding: '0 24px' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>
          What is the Context Engine?
        </h2>
        <p style={{ fontSize: '1.2rem', color: '#a1a1aa', textAlign: 'center', marginBottom: '60px', lineHeight: 1.6 }}>
          A powerful, AI-driven media companion designed for churches and live broadcasts. It listens to your spoken audio in real-time and automatically stages relevant content for your audience.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ padding: '32px', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#38bdf8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>1.</span> Live AI Transcriptions
            </h3>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
              Connect your audio feed, and the Context Engine instantly generates highly accurate, real-time transcripts. Perfect for providing live captions to your audience, ensuring no word is missed.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '32px', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#818cf8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>2.</span> Smart Scripture Staging
            </h3>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
              As the speaker preaches, our AI continuously analyzes the context. When a scripture is referenced or quoted, the Engine automatically pulls the correct verse and stages it on your dashboard, ready to be pushed to the live screen with a single click.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '32px', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#c084fc', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>3.</span> Knowledge Bites & Lyrics
            </h3>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
              Extract key takeaways, powerful quotes, and historical context automatically. Additionally, easily import song lyrics to display beautiful, synchronized lower-thirds during worship sessions.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '32px', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontSize: '1.5rem', color: '#4ade80', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>4.</span> Pro Output Projection
            </h3>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
              No complicated software needed. Simply open the `corpus.vidsyncapp.com/output` page on any second monitor or projector. When you click "Push Live" on your main laptop, it appears instantly on the big screen with beautiful animations and customizable graphics.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

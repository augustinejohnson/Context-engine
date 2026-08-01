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
      overflow: 'hidden'
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
            padding: '8px 20px', borderRadius: '24px', textDecoration: 'none', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
          }}
        >
          WhatsApp Support
        </a>
      </nav>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '900px', margin: '60px auto', padding: '0 24px' }}>
        <h2 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>
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

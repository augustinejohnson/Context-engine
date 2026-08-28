'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Section {
  title: string;
  content: React.ReactNode;
}

function CollapsibleCard({ title, content, index }: { title: string; content: React.ReactNode; index: number }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12,
        padding: 2,
        background: hovered
          ? 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)'
          : 'linear-gradient(135deg, #27272a, #3f3f46)',
        transition: 'background 0.4s ease, box-shadow 0.4s ease',
        boxShadow: hovered ? '0 0 24px rgba(99,102,241,0.25)' : '0 2px 8px rgba(0,0,0,0.3)',
        marginBottom: 16,
      }}
    >
      <div style={{ background: '#18181b', borderRadius: 10, overflow: 'hidden' }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '1.1rem',
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            textAlign: 'left',
            gap: 12,
          }}
        >
          <span style={{ flex: 1 }}>{title}</span>
          <span
            style={{
              fontSize: 20,
              transition: 'transform 0.3s ease',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              color: '#a1a1aa',
              flexShrink: 0,
            }}
          >
            ▼
          </span>
        </button>
        <div
          style={{
            maxHeight: open ? 2000 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.5s ease, opacity 0.4s ease, padding 0.4s ease',
            opacity: open ? 1 : 0,
            padding: open ? '0 16px 16px 16px' : '0 16px 0 16px',
          }}
        >
          <div style={{ borderTop: '1px solid #27272a', paddingTop: 16 }}>
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ marginBottom: 10, lineHeight: 1.7, color: '#d4d4d8', fontSize: 15 }}>
      {children}
    </li>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{ color: '#a78bfa', fontWeight: 600, fontSize: 15, margin: '16px 0 8px 0' }}>
      {children}
    </h4>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: '#f8fafc', fontWeight: 600 }}>{children}</strong>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        background: '#27272a',
        color: '#a78bfa',
        padding: '2px 7px',
        borderRadius: 5,
        fontSize: 13,
        fontFamily: 'monospace',
      }}
    >
      {children}
    </code>
  );
}

export default function GuidePage() {
  const sections: Section[] = [
    {
      title: '🚀 Getting Started: Registration',
      content: (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <Li>🌐 Open your browser (<Strong>Chrome recommended</Strong>) and go to the Context Engine homepage.</Li>
          <Li>🖱️ Click <Strong>&apos;Start Your 7-Day Free Trial&apos;</Strong> or <Strong>&apos;Sign In&apos;</Strong> to get started.</Li>
          <Li>📧 Enter your email and password, then verify your account via the confirmation email.</Li>
          <Li>☁️ Your settings are saved to the cloud — log in from <Strong>any computer</Strong> and pick up right where you left off.</Li>
        </ul>
      ),
    },
    {
      title: '🏠 Understanding the Dashboard',
      content: (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <Li>📝 <Strong>Transcript Area (Left)</Strong> — Live text of the preacher&apos;s words as they speak.</Li>
            <Li>📋 <Strong>Staging Queue (Center)</Strong> — Cards for detected scriptures and songs, ready to push live.</Li>
            <Li>📖 <Strong>Bible Tab (Right)</Strong> — Built-in Bible browser with a History panel for quick access to recent verses.</Li>
          </ul>
          <SubHeading>Top Navigation Bar</SubHeading>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {[
              ['🎙️', 'Audio'],
              ['🤖', 'AI'],
              ['🎵', 'Lyrics'],
              ['🌐', 'Translate'],
              ['⚙️', 'Settings'],
              ['🟢', 'Connected'],
              ['🖥️', 'Screen'],
              ['🚪', 'Logout'],
            ].map(([icon, label]) => (
              <span
                key={label}
                style={{
                  background: '#27272a',
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 14,
                  color: '#d4d4d8',
                }}
              >
                {icon} {label}
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      title: '🎙️ Audio Input',
      content: (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <Li>🔘 Click the <Strong>Audio</Strong> button to turn it <Strong>ON</Strong>.</Li>
          <Li>✅ Allow microphone permission when your browser prompts you.</Li>
          <Li>🎛️ For live services: connect your sound desk <Strong>AUX output</Strong> via an audio interface to the computer running Context Engine.</Li>
          <Li>💡 <Strong>Chrome works best</Strong> for audio recognition — other browsers may have limited support.</Li>
        </ul>
      ),
    },
    {
      title: '⚡ How Scriptures Are Caught (3 Methods)',
      content: (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              {
                tier: 'Tier 1',
                name: 'Lightning Fast Regex',
                speed: 'Instant',
                color: '#22c55e',
                desc: 'Catches explicit references like "John 3:16", "Genesis 1:1-3".',
              },
              {
                tier: 'Tier 2',
                name: 'Phrase-Based Search',
                speed: '~2 seconds',
                color: '#eab308',
                desc: 'Recognizes quoted phrases like "For God so loved the world" and matches them to scripture.',
              },
              {
                tier: 'Tier 3',
                name: 'AI Semantic Fallback',
                speed: '~3 seconds',
                color: '#ef4444',
                desc: 'Understands paraphrased or indirect biblical references using AI analysis.',
              },
            ].map((t) => (
              <div
                key={t.tier}
                style={{
                  background: '#1c1c1f',
                  border: `1px solid ${t.color}33`,
                  borderLeft: `4px solid ${t.color}`,
                  borderRadius: 8,
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: t.color, fontSize: 14 }}>{t.tier}</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 15 }}>{t.name}</span>
                  <span
                    style={{
                      background: `${t.color}22`,
                      color: t.color,
                      padding: '2px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      marginLeft: 'auto',
                    }}
                  >
                    {t.speed}
                  </span>
                </div>
                <p style={{ color: '#a1a1aa', fontSize: 14, margin: 0, lineHeight: 1.6 }}>{t.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#1a1a2e', borderRadius: 8, border: '1px solid #6366f133' }}>
            <p style={{ color: '#a5b4fc', fontSize: 14, margin: 0 }}>
              🔄 <Strong>Auto-Advance:</Strong> The system pre-loads the chapter and automatically advances verses as the preacher reads through a passage.
            </p>
          </div>
        </>
      ),
    },
    {
      title: '🤖 The AI Engine',
      content: (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <Li>🧠 Analyzes sentences in real-time for <Strong>biblical references</Strong>.</Li>
          <Li>🎶 Identifies <Strong>worship songs</Strong> being mentioned or sung.</Li>
          <Li>🔗 Provides helpful <Strong>cross-references</Strong> to related passages.</Li>
          <Li>🎯 Only extracts <Strong>Scriptures and Songs</Strong> — no clutter, no noise.</Li>
          <Li>🔑 Requires an API key from <Strong>OpenAI</Strong>, <Strong>Gemini</Strong>, or <Strong>Anthropic</Strong>. Add it in Settings → AI.</Li>
        </ul>
      ),
    },
    {
      title: '🔗 Connecting to Holyrics (Detailed)',
      content: (
        <>
          {[
            {
              step: 'Step 1: Configure Holyrics',
              items: [
                <>In Holyrics, go to <Strong>File → Settings → API/Web tab</Strong>.</>,
                <>Click <Strong>Edit</Strong> and check <Strong>ALL permission boxes</Strong>.</>,
                <>Note the <Strong>Port</Strong> number (usually <Code>8091</Code>) and <Strong>copy the Token</Strong>.</>,
              ],
            },
            {
              step: 'Step 2: Determine the IP Address',
              items: [
                <>🖥️ <Strong>One Computer:</Strong> Use IP <Code>127.0.0.1</Code> (localhost).</>,
                <>💻 <Strong>Two Computers:</Strong> On Laptop B (running Holyrics), open Command Prompt and type <Code>ipconfig</Code> to find its IP address.</>,
              ],
            },
            {
              step: 'Step 3: Connect in Context Engine',
              items: [
                <>Open <Strong>Settings → Integrations</Strong> in Context Engine.</>,
                <>Toggle <Strong>Holyrics ON</Strong>.</>,
                <>Enter the <Strong>IP</Strong>, <Strong>Port</Strong>, and <Strong>Token</Strong>, then click <Strong>Save</Strong>.</>,
              ],
            },
            {
              step: 'Step 4: Test the Connection',
              items: [
                <>Say <Strong>&quot;John 3:16&quot;</Strong> to trigger a scripture detection.</>,
                <>Push the card to screen and verify it appears in Holyrics.</>,
              ],
            },
          ].map((s) => (
            <div key={s.step} style={{ marginBottom: 16 }}>
              <SubHeading>{s.step}</SubHeading>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {s.items.map((item, i) => (
                  <Li key={i}>{item}</Li>
                ))}
              </ul>
            </div>
          ))}
          <SubHeading>⚠️ Common Errors</SubHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Connection Refused', 'Wrong port number — double-check in Holyrics settings.'],
              ['Unauthorized', 'Wrong token — re-copy it, ensure no extra spaces.'],
              ['Network Error', 'Devices on different WiFi networks — they must be on the same network.'],
            ].map(([err, fix]) => (
              <div key={err} style={{ background: '#1c1c1f', padding: '10px 14px', borderRadius: 8, border: '1px solid #ef444433' }}>
                <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 14 }}>❌ {err}:</span>{' '}
                <span style={{ color: '#a1a1aa', fontSize: 14 }}>{fix}</span>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      title: '🔗 Connecting to vMix & ProPresenter',
      content: (
        <>
          <SubHeading>vMix</SubHeading>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <Li>🔘 Toggle <Strong>vMix ON</Strong> in Settings → Integrations.</Li>
            <Li>🌐 Enter the <Strong>IP address</Strong> and <Strong>Input number</Strong> of your vMix title input.</Li>
          </ul>
          <SubHeading>ProPresenter</SubHeading>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <Li>🔘 Toggle <Strong>ProPresenter ON</Strong> in Settings → Integrations.</Li>
            <Li>🌐 Enter the <Strong>IP address</Strong> and <Strong>Port</Strong> (default: <Code>1025</Code>).</Li>
          </ul>
        </>
      ),
    },
    {
      title: '🎵 Song Lyrics',
      content: (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <Li>🔎 Type a song title in the Lyrics panel and click <Strong>Fetch</Strong>.</Li>
          <Li>💡 <Strong>Tip:</Strong> Use the format <Code>Song Title - Artist Name</Code> for best results.</Li>
          <Li>✏️ Edit the fetched lyrics directly — rearrange sections, fix typos.</Li>
          <Li>📺 Push individual sections live with one click.</Li>
          <Li>⚡ Use <Strong>Quick Jump</Strong> buttons to skip to Chorus, Bridge, etc.</Li>
        </ul>
      ),
    },
    {
      title: '📖 The Bible Tab',
      content: (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <Li>📚 Select a <Strong>Book</Strong>, then a <Strong>Chapter</Strong> to browse the Bible.</Li>
          <Li>👆 Click any <Strong>verse</Strong>, then press <Strong>Enter</Strong> to push it live.</Li>
          <Li>⌨️ Use <Strong>Arrow keys</Strong> to navigate between verses quickly.</Li>
          <Li>🕐 The <Strong>History panel</Strong> keeps track of recently displayed verses for easy re-access.</Li>
        </ul>
      ),
    },
    {
      title: '⚙️ Settings Breakdown',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { cat: '🎨 Graphics', desc: 'Font size, font family, text/background colors, position on screen.' },
            { cat: '📖 Bible', desc: 'Set your default Bible version (KJV, NIV, ESV, etc.).' },
            { cat: '🤖 AI', desc: 'Toggle AI on/off, configure your API key.' },
            { cat: '🔗 Integrations', desc: 'Holyrics, vMix, ProPresenter — IP, Port, and Token settings.' },
            { cat: '🗣️ Spoken Word Mode', desc: 'Enable live captions to display spoken words on screen in real-time.' },
          ].map((s) => (
            <div key={s.cat} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: '#1c1c1f', borderRadius: 8 }}>
              <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>{s.cat}</span>
              <span style={{ color: '#a1a1aa', fontSize: 14, lineHeight: 1.6 }}>{s.desc}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: '🖥️ Going Live on Sunday',
      content: (
        <>
          <p style={{ color: '#a5b4fc', fontSize: 15, marginTop: 0, marginBottom: 16 }}>
            ✅ Use this checklist every Sunday to ensure a smooth broadcast:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Log in to Context Engine',
              'Verify your settings (graphics, Bible version, integrations)',
              'Turn Audio ON and confirm microphone input',
              'Watch the Staging Queue for detected cards',
              'Push cards to screen as the preacher references them',
              'Clear the screen when the reference is done',
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: '#1c1c1f',
                  borderRadius: 8,
                  border: '1px solid #27272a',
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ color: '#d4d4d8', fontSize: 15 }}>{item}</span>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      title: '❓ Troubleshooting',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              problem: '🎤 Mic not working',
              fix: 'Check that you clicked "Allow" on the browser permission prompt. Also verify the correct audio input device is selected in your system settings.',
            },
            {
              problem: '📖 Scriptures not showing',
              fix: 'Ensure Audio is ON (the button should be active). Check your internet connection — AI detection requires connectivity.',
            },
            {
              problem: '🔒 Holyrics "Unauthorized"',
              fix: 'Re-copy the token from Holyrics settings. Make sure there are no extra spaces before or after the token.',
            },
            {
              problem: '🎵 Song not found',
              fix: 'Try using the format "Title - Artist" (e.g., "Amazing Grace - Chris Tomlin"). Check spelling and try alternate titles.',
            },
          ].map((t) => (
            <div
              key={t.problem}
              style={{
                padding: '14px 18px',
                background: '#1c1c1f',
                borderRadius: 8,
                border: '1px solid #27272a',
              }}
            >
              <p style={{ color: '#f8fafc', fontWeight: 600, fontSize: 15, margin: '0 0 6px 0' }}>{t.problem}</p>
              <p style={{ color: '#a1a1aa', fontSize: 14, margin: 0, lineHeight: 1.6 }}>{t.fix}</p>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#09090b',
        color: '#f8fafc',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Nav Bar */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 32px',
          background: 'rgba(9,9,11,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #27272a',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#a5b4fc',
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
            transition: 'color 0.2s',
          }}
        >
          ← Back to Home
        </Link>
        <span style={{ fontSize: 14, color: '#71717a', fontWeight: 500 }}>Context Engine Guide</span>
      </nav>

      {/* Hero Section */}
      <div
        style={{
          textAlign: 'center',
          padding: '72px 24px 48px',
          background: 'linear-gradient(180deg, #0f0f1a 0%, #09090b 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative glow */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 600,
            height: 300,
            background: 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 800,
            margin: '0 0 16px 0',
            background: 'linear-gradient(135deg, #f8fafc 0%, #a5b4fc 50%, #c084fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            position: 'relative',
          }}
        >
          📖 How to Use Context Engine
        </h1>
        <p
          style={{
            fontSize: 'clamp(16px, 2.5vw, 19px)',
            color: '#a1a1aa',
            maxWidth: 600,
            margin: '0 auto',
            lineHeight: 1.6,
            position: 'relative',
          }}
        >
          Your complete guide to setting up and using Context Engine for seamless live broadcast scripture and lyrics display.
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 780,
          margin: '0 auto',
          padding: '32px 20px 80px',
        }}
      >
        {sections.map((section, i) => (
          <CollapsibleCard key={i} index={i} title={section.title} content={section.content} />
        ))}

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 48,
            padding: '32px 20px',
            borderTop: '1px solid #27272a',
          }}
        >
          <p style={{ color: '#71717a', fontSize: 14, margin: 0 }}>
            💬 Need more help? Reach out to the Context Engine support team.
          </p>
        </div>
      </div>
    </div>
  );
}

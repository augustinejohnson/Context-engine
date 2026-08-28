'use client';

import Link from 'next/link';

function ContentSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: 48, background: '#18181b', padding: '32px', borderRadius: '16px', border: '1px solid #27272a', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginBottom: 24, paddingBottom: 12, borderBottom: '1px solid #3f3f46' }}>
        {title}
      </h2>
      <div style={{ color: '#d4d4d8', fontSize: '1.05rem', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#a78bfa', margin: '24px 0 12px 0' }}>{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 16 }}>{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul style={{ marginBottom: 20, paddingLeft: 24, listStyleType: 'disc' }}>{children}</ul>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ marginBottom: 8 }}>{children}</li>;
}

function Bold({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: '#f8fafc', fontWeight: 600 }}>{children}</strong>;
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#c4b5fd', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.9em' }}>{children}</span>;
}

function TipBox({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '24px 0', padding: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '1.1rem' }}>{title}</span>
      </div>
      <div style={{ color: '#94a3b8', fontSize: '0.95rem', margin: 0, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <main style={{ minHeight: '100vh', background: '#09090b', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Nav */}
      <nav style={{ background: '#18181b', borderBottom: '1px solid #27272a', padding: '16px 32px', position: 'sticky', top: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Context Engine
        </div>
        <Link href="/" style={{ background: '#3f3f46', color: '#f8fafc', textDecoration: 'none', padding: '8px 16px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, transition: 'background 0.2s' }}>
          ← Back to App
        </Link>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
        
        <header style={{ textAlign: 'center', marginBottom: 64 }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: 16 }}>📖 The Complete Guide</h1>
          <p style={{ fontSize: '1.2rem', color: '#a1a1aa', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
            Welcome to Context Engine — an AI-powered media assistant for live church broadcasts! Instead of scrambling to type scriptures while the preacher speaks, Context Engine listens, understands, and delivers the right content to your screens in real time.
          </p>
        </header>

        <div style={{ background: '#18181b', padding: 32, borderRadius: 16, border: '1px solid #27272a', marginBottom: 48 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 16 }}>📋 Table of Contents</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#a78bfa', lineHeight: 2 }}>
              <li><a href="#section-1" style={{ color: 'inherit', textDecoration: 'none' }}>1. 🚀 Getting Started: Registration</a></li>
              <li><a href="#section-2" style={{ color: 'inherit', textDecoration: 'none' }}>2. 🏠 Understanding the Dashboard</a></li>
              <li><a href="#section-3" style={{ color: 'inherit', textDecoration: 'none' }}>3. 🎙️ Audio Input: Turning On the Ears</a></li>
              <li><a href="#section-4" style={{ color: 'inherit', textDecoration: 'none' }}>4. ⚡ How Scriptures Are Caught</a></li>
              <li><a href="#section-5" style={{ color: 'inherit', textDecoration: 'none' }}>5. 🤖 The AI Engine</a></li>
              <li><a href="#section-6" style={{ color: 'inherit', textDecoration: 'none' }}>6. 🔗 Connecting to Holyrics</a></li>
            </ul>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#a78bfa', lineHeight: 2 }}>
              <li><a href="#section-7" style={{ color: 'inherit', textDecoration: 'none' }}>7. 🔗 Connecting to vMix & ProPresenter</a></li>
              <li><a href="#section-8" style={{ color: 'inherit', textDecoration: 'none' }}>8. 🎵 Song Lyrics: Fetching & Editing</a></li>
              <li><a href="#section-9" style={{ color: 'inherit', textDecoration: 'none' }}>9. 📖 The Bible Tab</a></li>
              <li><a href="#section-10" style={{ color: 'inherit', textDecoration: 'none' }}>10. ⚙️ Settings: Full Breakdown</a></li>
              <li><a href="#section-11" style={{ color: 'inherit', textDecoration: 'none' }}>11. 🖥️ Going Live on Sunday!</a></li>
              <li><a href="#section-12" style={{ color: 'inherit', textDecoration: 'none' }}>12. ❓ Troubleshooting & FAQ</a></li>
            </ul>
          </div>
        </div>

        <ContentSection id="section-1" title="1. 🚀 Getting Started: Registration">
          <Ul>
            <Li>Open your web browser (Chrome is recommended) and go to the Context Engine homepage.</Li>
            <Li>You will see two buttons:
              <Ul>
                <Li><Bold>🟢 "Start Your 7-Day Free Trial"</Bold> — Click this if you are a brand new user.</Li>
                <Li><Bold>🔵 "Sign In"</Bold> — Click this if you already have an account.</Li>
              </Ul>
            </Li>
            <Li>Enter your email address and create a password.</Li>
            <Li>Check your email inbox for a confirmation link. Click it to verify your account.</Li>
            <Li>You're in! You will be taken directly to your Dashboard.</Li>
          </Ul>
          <TipBox icon="💡" title="Tip">
            Your settings and configuration are saved to your account in the cloud. This means you can log in from any computer and your setup will be exactly the same!
          </TipBox>
        </ContentSection>

        <ContentSection id="section-2" title="2. 🏠 Understanding the Dashboard">
          <P>Once logged in, your Dashboard is the main control center. Here is what each area does:</P>
          
          <Sub>📝 Transcript Area (Left Side)</Sub>
          <P>This is where you see the preacher's words appearing as live text in real-time. Think of it as live subtitles. Every word spoken into the microphone will scroll here as text.</P>
          
          <Sub>📋 Staging Queue (Center)</Sub>
          <P>When the engine detects a Bible verse, song, or important content, it creates a "Card" and places it here. Each card shows:</P>
          <Ul>
            <Li>The scripture reference and full text, OR</Li>
            <Li>The song title and lyrics.</Li>
          </Ul>
          <P>You can then decide whether to push it live to your church screens or dismiss it.</P>
          
          <Sub>📖 Bible Tab (Right Side)</Sub>
          <P>A built-in Bible browser where you can manually search for any verse. It also has a <Bold>🕐 History Panel</Bold> that remembers recently viewed scriptures so you can re-push them with one click.</P>

          <Sub>🔝 Top Navigation Bar</Sub>
          <P>This contains all your controls:</P>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <Li><Bold>🎙️ Audio:</Bold> Turns the microphone listening ON or OFF</Li>
            <Li><Bold>🤖 AI:</Bold> Shows that AI extraction is active</Li>
            <Li><Bold>🎵 Lyrics:</Bold> Green dot = lyrics sync is ON. White = OFF</Li>
            <Li><Bold>🌐 Translate:</Bold> Green dot = translation mode ON. White = OFF</Li>
            <Li><Bold>⚙️ Settings:</Bold> Opens your full configuration panel</Li>
            <Li><Bold>🟢 Connected:</Bold> Shows your connection status to the server</Li>
            <Li><Bold>🖥️ Screen:</Bold> Select which monitor to use for the output display</Li>
            <Li><Bold>🚪 Logout:</Bold> Signs you out of your account</Li>
          </ul>
        </ContentSection>

        <ContentSection id="section-3" title="3. 🎙️ Audio Input: Turning On the Ears">
          <P>The engine needs to "hear" the preacher to work. Here's how:</P>
          <Ul>
            <Li>Click the <Bold>🎙️ Audio button</Bold> at the top of your dashboard. It will change from "OFF" to "ON."</Li>
            <Li>Your browser will show a popup asking: "Allow this site to access your microphone?" — Click Allow.</Li>
            <Li>You should now see live text appearing in the Transcript Area as you speak or as audio plays.</Li>
          </Ul>
          
          <Sub>🔌 Setting Up Your Audio Source</Sub>
          <Ul>
            <Li><Bold>For testing:</Bold> Just use your laptop's built-in microphone.</Li>
            <Li><Bold>For live services:</Bold> Connect your church sound desk's AUX output to your computer using an audio interface (like a Focusrite Scarlett or Behringer UMC). Set that audio interface as your computer's default microphone input in your system settings.</Li>
            <Li><Bold>Virtual audio cable:</Bold> If you want to route software audio (e.g., from a streaming app), you can use a virtual audio cable like VB-Cable to pipe the audio into the browser.</Li>
          </Ul>
          <TipBox icon="⚠️" title="Important">
            Chrome works best for speech recognition. Other browsers may have limited support.
          </TipBox>
        </ContentSection>

        <ContentSection id="section-4" title="4. ⚡ How Scriptures Are Caught (3 Methods)">
          <P>Context Engine uses a three-tier system to make sure you never miss a verse:</P>
          
          <Sub>⚡ Tier 1: Lightning Fast Regex Matching (Instant)</Sub>
          <P>If the preacher explicitly says a reference like:</P>
          <blockquote style={{ borderLeft: '4px solid #a78bfa', paddingLeft: 16, fontStyle: 'italic', margin: '16px 0' }}>"Turn to John chapter 3 verse 16"</blockquote>
          <P>The engine's high-speed pattern detector intercepts the words "John," "3," and "16" from the live speech in milliseconds — before the AI even wakes up. It instantly fetches the verse from the Bible API and stages it for you.</P>
          <P><Bold>Supported formats:</Bold></P>
          <Ul>
            <Li>"Genesis 1:1"</Li>
            <Li>"Genesis chapter 1 verse 1"</Li>
            <Li>"First Corinthians 13 verses 4 through 7"</Li>
            <Li>"Psalm 23" (fetches the entire chapter)</Li>
          </Ul>

          <Sub>🔍 Tier 2: Phrase-Based Bible Search (~2 seconds)</Sub>
          <P>If the preacher quotes a verse without saying the reference, like:</P>
          <blockquote style={{ borderLeft: '4px solid #a78bfa', paddingLeft: 16, fontStyle: 'italic', margin: '16px 0' }}>"For God so loved the world that He gave His only begotten Son..."</blockquote>
          <P>The engine groups the spoken words into a sentence and fires a high-speed text search against the entire Bible database. If the words closely match a specific verse (above 60% confidence), it stages that verse automatically.</P>

          <Sub>🤖 Tier 3: AI Semantic Fallback (~3 seconds)</Sub>
          <P>For subtle, complex, or paraphrased references, the AI uses its deep understanding of scripture to figure out the verse. For example:</P>
          <blockquote style={{ borderLeft: '4px solid #a78bfa', paddingLeft: 16, fontStyle: 'italic', margin: '16px 0' }}>"Remember what Paul told the church at Corinth about love being patient..."</blockquote>
          <P>The AI understands this is referring to 1 Corinthians 13:4 and stages it.</P>

          <Sub>⏩ Auto-Advance Feature</Sub>
          <P>When the preacher is reading through a passage (e.g., Psalm 23:1–6), the system pre-loads the entire chapter. As it hears the preacher finish reading verse 1, it automatically advances to verse 2 on screen — no button clicks needed!</P>
        </ContentSection>

        <ContentSection id="section-5" title="5. 🤖 The AI Engine">
          <P>The AI is the "brain" behind Context Engine. Here's what it does:</P>
          <Ul>
            <Li>Analyzes sentences for biblical references, even when paraphrased.</Li>
            <Li>Identifies worship songs when the worship team starts singing.</Li>
            <Li>Provides cross-references — when it finds a verse, it also suggests 2-3 related verses.</Li>
          </Ul>
          <TipBox icon="💡" title="Note">
            The AI is designed to ONLY extract Scriptures and Songs. It will not clutter your staging queue with random facts or definitions.
          </TipBox>

          <Sub>🔑 API Key</Sub>
          <P>The AI requires an API key to function (from OpenAI, Google Gemini, or Anthropic). Your church admin can enter this key in the Settings panel. Without an API key, Tier 1 (Regex) and Tier 2 (Phrase Search) will still work perfectly — only the semantic AI fallback requires it.</P>
        </ContentSection>

        <ContentSection id="section-6" title="6. 🔗 Connecting to Holyrics (Detailed Setup)">
          <P>This is the most important integration. Follow these steps carefully.</P>
          
          <Sub>📌 Step 1: Configure Holyrics to Accept Connections</Sub>
          <Ul>
            <Li>Open Holyrics on the computer where it's installed.</Li>
            <Li>Go to File → Settings (or press the gear icon).</Li>
            <Li>Navigate to the API / Web tab.</Li>
            <Li>You will see a section called "JavaScript Monitor / Web API" (or similar).</Li>
            <Li>Click "Edit" or "Configure".</Li>
            <Li>Check ALL the boxes in the permissions list. This allows Context Engine to send text, clear screens, and control presentations.</Li>
            <Li>You will see three important pieces of information:
              <Ul>
                <Li><Bold>Port:</Bold> Usually 8091 (don't change this unless you have a reason).</Li>
                <Li><Bold>Token:</Bold> This is your security key. Click "Generate" if you don't have one, then copy the token and save it somewhere safe.</Li>
                <Li><Bold>IP Address:</Bold> Holyrics will show the IP address of the computer it's running on.</Li>
              </Ul>
            </Li>
            <Li>Click Save or OK to close the settings.</Li>
          </Ul>

          <Sub>📌 Step 2: Determine Your Setup (One System or Two?)</Sub>
          <P><Bold>🖥️ Option A: One Computer (Context Engine + Holyrics on the SAME laptop)</Bold></P>
          <Ul>
            <Li>If you are running both Context Engine (in your browser) and Holyrics on the exact same computer:</Li>
            <Li>Your Holyrics IP Address is: <Highlight>127.0.0.1</Highlight></Li>
            <Li>This is a special address that means "this same computer." It always works.</Li>
          </Ul>
          <P><Bold>🖥️🖥️ Option B: Two Computers (Context Engine on Laptop A, Holyrics on Laptop B)</Bold></P>
          <Ul>
            <Li>If Context Engine is running on a different laptop than Holyrics:</Li>
            <Li>Both laptops must be on the same Wi-Fi network (or connected to the same router via ethernet).</Li>
            <Li>On Laptop B (the one running Holyrics), find its local IP address:
              <Ul>
                <Li><Bold>Windows:</Bold> Open Command Prompt → type ipconfig → look for "IPv4 Address" (e.g., 192.168.1.105).</Li>
                <Li><Bold>Mac:</Bold> System Preferences → Network → look for the IP address.</Li>
              </Ul>
            </Li>
            <Li>Use that IP address in the next step.</Li>
          </Ul>

          <Sub>📌 Step 3: Install the Allow CORS Browser Extension (Crucial for Local Network Setups)</Sub>
          <P>If you are running Context Engine in your web browser and trying to connect to a local IP address (like Holyrics, vMix, or ProPresenter running on another computer), modern browsers will block the connection due to CORS (Cross-Origin Resource Sharing) security policies.</P>
          <P>To fix this and allow the connection:</P>
          <Ul>
            <Li>Open the Chrome Web Store and search for an extension called <Bold>Allow CORS: Access-Control-Allow-Origin</Bold> (or similar).</Li>
            <Li>Click Add to Chrome and install the extension.</Li>
            <Li>Click the extension icon in your toolbar and turn it ON.</Li>
            <Li>This will allow your browser to bypass the security block and communicate directly with your local broadcast software!</Li>
          </Ul>

          <Sub>📌 Step 4: Enter the Settings in Context Engine</Sub>
          <Ul>
            <Li>On the Context Engine dashboard, click the ⚙️ Settings (Gear Icon) at the top right.</Li>
            <Li>Scroll down to the "Holyrics Integration" section.</Li>
            <Li>Toggle the Holyrics switch to ON (it should turn green).</Li>
            <Li>Fill in the three fields:
              <Ul>
                <Li><Bold>IP Address:</Bold> 127.0.0.1 (same computer) or Laptop B's IP address</Li>
                <Li><Bold>Port:</Bold> The port from Holyrics settings (8091)</Li>
                <Li><Bold>Token:</Bold> Paste the exact token you copied from Holyrics</Li>
              </Ul>
            </Li>
            <Li>Click the 💾 Save button.</Li>
          </Ul>

          <Sub>📌 Step 5: Test the Connection</Sub>
          <Ul>
            <Li>Go back to your Dashboard.</Li>
            <Li>Turn Audio ON and say "John chapter 3 verse 16."</Li>
            <Li>The verse should appear in your Staging Queue.</Li>
            <Li>Click "Push to Screen" on the card.</Li>
            <Li>Check your Holyrics output — the verse should now appear on screen!</Li>
          </Ul>

          <TipBox icon="⚠️" title="Common Errors:">
            <Bold>"Connection refused"</Bold> → Double-check that Holyrics is actually running and the port number is correct.<br/><br/>
            <Bold>"Unauthorized"</Bold> → The token is wrong. Go back to Holyrics, re-copy the token (make sure there are no extra spaces), and paste it again.<br/><br/>
            <Bold>"Network error"</Bold> → The two computers are not on the same Wi-Fi network, or a firewall is blocking port 8091.
          </TipBox>
        </ContentSection>

        <ContentSection id="section-7" title="7. 🔗 Connecting to vMix & ProPresenter">
          <P>Context Engine also supports vMix and ProPresenter. The setup is similar:</P>
          
          <Sub>vMix</Sub>
          <Ul>
            <Li>In Settings, toggle vMix to ON.</Li>
            <Li>Enter the IP address of the vMix computer and the Input number for the text overlay.</Li>
            <Li>Context Engine sends text to vMix via its Web Controller API.</Li>
          </Ul>

          <Sub>ProPresenter</Sub>
          <Ul>
            <Li>In Settings, toggle ProPresenter to ON.</Li>
            <Li>Enter the IP address and port (default: 1025).</Li>
            <Li>Context Engine communicates with ProPresenter's Stage Display API.</Li>
          </Ul>
        </ContentSection>

        <ContentSection id="section-8" title="8. 🎵 Song Lyrics: Fetching & Editing">
          <P>When the worship team starts singing, Context Engine can help display the lyrics.</P>

          <Sub>Fetching Lyrics Automatically</Sub>
          <Ul>
            <Li>Type the song title in the Song Search box (e.g., "Way Maker").</Li>
            <Li>Click "Fetch from Internet." The engine will search online databases to find the lyrics.</Li>
            <Li>If found, the lyrics will be split into sections (Verse 1, Chorus, Bridge, etc.) and stored in your personal library.</Li>
          </Ul>
          <TipBox icon="💡" title="Pro Tip">
            For best results, type <Highlight>Song Title - Artist Name</Highlight> (e.g., "Way Maker - Sinach"). This dramatically improves the accuracy of the search.
          </TipBox>

          <Sub>Editing Lyrics</Sub>
          <Ul>
            <Li>Click on a song in your library.</Li>
            <Li>Click the ✏️ Edit button.</Li>
            <Li>You can rearrange sections, fix typos, or add custom bridges that your worship team uses.</Li>
            <Li>Click Save when done.</Li>
          </Ul>

          <Sub>Pushing Lyrics Live</Sub>
          <Ul>
            <Li>Click on a song section (e.g., "Chorus").</Li>
            <Li>Click "Push to Screen" — the lyrics will be sent to Holyrics/vMix/ProPresenter instantly.</Li>
            <Li>Use the Quick Jump buttons to hop between sections as the worship team sings.</Li>
          </Ul>
        </ContentSection>

        <ContentSection id="section-9" title="9. 📖 The Bible Tab">
          <P>The Bible Tab is your built-in Bible browser for manual searches.</P>
          
          <Sub>How to Use It</Sub>
          <Ul>
            <Li>Click the 📖 Bible tab in the navigation.</Li>
            <Li>Select a Book (e.g., John), then a Chapter (e.g., 3).</Li>
            <Li>All verses in that chapter will load. Click on any verse to highlight it.</Li>
            <Li>Press Enter to push it to the screen.</Li>
            <Li>Use the Arrow Keys (↑↓) to navigate between verses.</Li>
          </Ul>

          <Sub>🕐 History Panel</Sub>
          <P>On the right side of the Bible Tab, you'll see a Recent History list. This automatically saves the last 30 scriptures you viewed. You can click any entry to instantly re-push it — perfect for when the preacher says, "Go back to that verse we read earlier..."</P>
        </ContentSection>

        <ContentSection id="section-10" title="10. ⚙️ Settings: Full Breakdown">
          <P>Click the ⚙️ Gear Icon to open your Settings panel. Here is every option explained:</P>
          
          <Sub>🎨 Graphics & Display</Sub>
          <Ul>
            <Li><Bold>Font Size:</Bold> Controls how large the text appears on the output screen</Li>
            <Li><Bold>Font Family:</Bold> Choose your preferred font (e.g., Arial, Georgia, Times New Roman)</Li>
            <Li><Bold>Text Color:</Bold> The color of the scripture/lyrics text</Li>
            <Li><Bold>Background Color:</Bold> The background color behind the text overlay</Li>
            <Li><Bold>Position Preset:</Bold> Where the text appears: Bottom Center (subtitles), Full Screen, Lower Third, etc.</Li>
          </Ul>

          <Sub>📖 Bible Settings</Sub>
          <Ul>
            <Li><Bold>Default Bible Version:</Bold> Which translation to use (KJV, NKJV, NIV, ESV, etc.)</Li>
          </Ul>

          <Sub>🤖 AI Settings</Sub>
          <Ul>
            <Li><Bold>AI Extraction:</Bold> Toggle ON/OFF to enable the semantic AI fallback</Li>
            <Li><Bold>OpenAI API Key:</Bold> Your API key for the AI engine.</Li>
          </Ul>

          <Sub>🔗 Integration Settings</Sub>
          <Ul>
            <Li><Bold>Holyrics IP / Port / Token:</Bold> Connection details for Holyrics</Li>
            <Li><Bold>vMix IP / Input:</Bold> Connection details for vMix</Li>
            <Li><Bold>ProPresenter IP / Port:</Bold> Connection details for ProPresenter</Li>
          </Ul>

          <Sub>🎤 Spoken Word Mode</Sub>
          <Ul>
            <Li><Bold>Spoken Word Mode:</Bold> When ON, displays the preacher's exact words as live captions/subtitles on screen in real time</Li>
          </Ul>
        </ContentSection>

        <ContentSection id="section-11" title="11. 🖥️ Going Live on Sunday!">
          <P>Here is your step-by-step checklist for Sunday morning:</P>
          <Ul>
            <Li>✅ Open Context Engine in Chrome and log in.</Li>
            <Li>✅ Make sure Holyrics (or vMix/ProPresenter) is running.</Li>
            <Li>✅ Verify your settings are saved (IP, Port, Token).</Li>
            <Li>✅ Click 🎙️ Audio ON to start listening.</Li>
            <Li>✅ Watch the Staging Queue as the preacher speaks.</Li>
            <Li>✅ When a card appears that you want to show, click "Push to Screen."</Li>
            <Li>✅ When the preacher moves on, click "Clear Screen" at the top.</Li>
            <Li>✅ During worship, search for songs and push lyrics section by section.</Li>
          </Ul>
          <TipBox icon="🎉" title="That's it!">
            Context Engine handles the heavy lifting — you just approve what goes on screen.
          </TipBox>
        </ContentSection>

        <ContentSection id="section-12" title="12. ❓ Troubleshooting & FAQ">
          <Sub>"The microphone isn't picking up audio."</Sub>
          <Ul>
            <Li>Make sure you clicked Allow when Chrome asked for microphone permission.</Li>
            <Li>Check your computer's audio input settings to ensure the correct microphone or audio interface is selected.</Li>
          </Ul>

          <Sub>"Scriptures are not showing up."</Sub>
          <Ul>
            <Li>Make sure Audio is ON (the button should show green).</Li>
            <Li>Check that your internet connection is stable — the Bible API needs internet to fetch verses.</Li>
            <Li>If the preacher is speaking too fast or too quietly, the speech recognition may struggle. Try adjusting the microphone volume.</Li>
          </Ul>

          <Sub>"Holyrics says Unauthorized."</Sub>
          <Ul>
            <Li>Go back to Holyrics → Settings → API/Web → Copy the Token again carefully.</Li>
            <Li>Paste it into Context Engine settings. Make sure there are no extra spaces before or after the token.</Li>
          </Ul>

          <Sub>"Song lyrics not found."</Sub>
          <Ul>
            <Li>Try searching with the format: "Song Title - Artist Name" (e.g., "Way Maker - Sinach").</Li>
            <Li>If the song is very new or obscure, you may need to add the lyrics manually using the Edit function.</Li>
          </Ul>

          <Sub>"Can I use this on my phone?"</Sub>
          <Ul>
            <Li>Context Engine works on any device with a modern browser. However, for the best experience during live services, we recommend using a laptop or desktop computer connected to your church's sound system.</Li>
          </Ul>
        </ContentSection>

      </div>
    </main>
  );
}

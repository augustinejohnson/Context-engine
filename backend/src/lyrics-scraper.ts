import * as cheerio from 'cheerio';

export async function fetchLyricsFromWeb(songTitle: string): Promise<{ title: string, artist: string, sections: { section: string, text: string }[] }> {
  
  // --- Strategy 1: lyrics.ovh (Fast, reliable for worship songs) ---
  try {
    const result = await fetchFromLyricsOvh(songTitle);
    if (result) return result;
  } catch (e: any) {
    console.log('[Scraper] lyrics.ovh failed, trying Genius fallback...', e?.message);
  }

  // --- Strategy 2: DuckDuckGo → Genius.com scrape (Fallback) ---
  try {
    const result = await fetchFromGenius(songTitle);
    if (result) return result;
  } catch (e: any) {
    console.log('[Scraper] Genius fallback failed too.', e?.message);
  }

  throw new Error(`Could not find lyrics for "${songTitle}". Try searching with "Song Title - Artist Name" for better results.`);
}


// ---- lyrics.ovh Strategy ----
async function fetchFromLyricsOvh(songTitle: string): Promise<{ title: string, artist: string, sections: { section: string, text: string }[] } | null> {
  let artist = '';
  let title = songTitle;

  // Common separators: " - ", " by ", " – "
  const separators = [' - ', ' – ', ' by '];
  for (const sep of separators) {
    if (songTitle.toLowerCase().includes(sep)) {
      const parts = songTitle.split(new RegExp(sep, 'i'));
      artist = parts[0].trim();
      title = parts[1].trim();
      break;
    }
  }

  // Try with artist if we parsed one out
  if (artist) {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    console.log(`[Scraper] Trying lyrics.ovh: ${url}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics && data.lyrics.trim()) {
        return parsePlainLyrics(data.lyrics, title, artist);
      }
    }
    // Also try swapped (maybe user typed "Song - Artist" instead of "Artist - Song")
    const url2 = `https://api.lyrics.ovh/v1/${encodeURIComponent(title)}/${encodeURIComponent(artist)}`;
    console.log(`[Scraper] Trying lyrics.ovh (swapped): ${url2}`);
    const res2 = await fetch(url2, { signal: AbortSignal.timeout(8000) });
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.lyrics && data2.lyrics.trim()) {
        return parsePlainLyrics(data2.lyrics, artist, title);
      }
    }
  }

  // No artist given — try each known worship artist
  const worshipArtists = [
    'Sinach', 'Hillsong Worship', 'Hillsong United', 'Bethel Music', 'Elevation Worship',
    'Maverick City Music', 'Chris Tomlin', 'Matt Redman', 'Kari Jobe', 'Lauren Daigle',
    'Phil Wickham', 'Nathaniel Bassey', 'Dunsin Oyekan', 'Tim Godfrey', 'Mercy Chinwo',
    'Tasha Cobbs Leonard', 'William McDowell', 'Todd Dulaney', 'Travis Greene',
    'Chandler Moore', 'Brandon Lake', 'Upperroom', 'Leeland', 'Brooke Ligertwood',
    'Housefires', 'Jesus Culture', 'Planetshakers', 'Gateway Worship',
    'Ada Ehi', 'Frank Edwards', 'Eben', 'Joe Praize', 'Prospa Ochimana',
    'Moses Bliss', 'Minister GUC', 'Judikay', 'Chidinma', 'Victoria Orenze',
    'CeCe Winans', 'Don Moen', 'Ron Kenoly', 'Michael W. Smith', 'Casting Crowns'
  ];

  for (const knownArtist of worshipArtists) {
    try {
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(knownArtist)}/${encodeURIComponent(title)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.lyrics && data.lyrics.trim()) {
          console.log(`[Scraper] ✅ Found "${title}" by ${knownArtist} via lyrics.ovh`);
          return parsePlainLyrics(data.lyrics, title, knownArtist);
        }
      }
    } catch { /* continue to next artist */ }
  }

  return null;
}


// ---- Genius Strategy (Fallback) ----
async function fetchFromGenius(songTitle: string): Promise<{ title: string, artist: string, sections: { section: string, text: string }[] } | null> {
  const query = encodeURIComponent(`${songTitle} lyrics genius`);
  const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;
  
  const searchRes = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const searchHtml = await searchRes.text();
  const $search = cheerio.load(searchHtml);
  
  let geniusUrl = '';
  $search('a.result__url, a[href*="genius.com"]').each((_i, el) => {
    const href = $search(el).attr('href');
    if (href && href.includes('genius.com') && !geniusUrl) {
      let candidateUrl = '';
      const match = href.match(/uddg=([^&]+)/);
      if (match) {
        candidateUrl = decodeURIComponent(match[1]);
      } else if (href.startsWith('http')) {
        candidateUrl = href;
      }
      
      // Ensure we are getting a song lyrics page, NOT an artist or album page
      if (candidateUrl && !candidateUrl.includes('/artists/') && !candidateUrl.includes('/albums/')) {
        geniusUrl = candidateUrl;
      }
    }
  });

  if (!geniusUrl) return null;

  const geniusRes = await fetch(geniusUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const geniusHtml = await geniusRes.text();
  const $ = cheerio.load(geniusHtml);

  let rawLyrics = '';
  $('[data-lyrics-container="true"]').each((_i, el) => {
    $(el).find('br').replaceWith('\n');
    rawLyrics += $(el).text() + '\n\n';
  });

  if (!rawLyrics.trim()) return null;

  const scrapedTitle = $('h1[class^="SongHeader"]').first().text().trim() || songTitle;
  const scrapedArtist = $('a[class^="SongHeader"]').first().text().trim() || 'Unknown Artist';

  return parseGeniusLyrics(rawLyrics, scrapedTitle, scrapedArtist);
}


// ---- Parsers ----

function parsePlainLyrics(rawLyrics: string, title: string, artist: string): { title: string, artist: string, sections: { section: string, text: string }[] } {
  const sections: { section: string, text: string }[] = [];
  const paragraphs = rawLyrics.split(/\n\s*\n/).filter(p => p.trim());

  let verseCount = 0;
  for (const paragraph of paragraphs) {
    const lines = paragraph.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) continue;

    if (lines[0].startsWith('[') && lines[0].endsWith(']')) {
      const sectionName = lines[0].replace('[', '').replace(']', '');
      sections.push({ section: sectionName, text: lines.slice(1).join('\n') });
    } else {
      verseCount++;
      const sectionLabel = `Verse ${verseCount}`;
      sections.push({ section: sectionLabel, text: lines.join('\n') });
    }
  }

  if (sections.length === 0) {
    sections.push({ section: 'Verse 1', text: rawLyrics.trim() });
  }

  return { title, artist, sections };
}

function parseGeniusLyrics(rawLyrics: string, title: string, artist: string): { title: string, artist: string, sections: { section: string, text: string }[] } {
  const sections: { section: string, text: string }[] = [];
  const lines = rawLyrics.split('\n');
  
  let currentSection = 'Verse 1';
  let currentText = '';

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      if (currentText.trim()) {
        sections.push({ section: currentSection, text: currentText.trim() });
      }
      currentSection = line.replace('[', '').replace(']', '');
      currentText = '';
    } else {
      currentText += line + '\n';
    }
  }
  
  if (currentText.trim()) {
    sections.push({ section: currentSection, text: currentText.trim() });
  }

  return { title, artist, sections };
}

import * as cheerio from 'cheerio';

export async function fetchLyricsFromWeb(songTitle: string): Promise<{ title: string, artist: string, sections: { section: string, text: string }[] }> {
  
  console.log(`[Scraper] Starting parallel search for: "${songTitle}"`);

  // Wrap functions so they reject if they return null, allowing Promise.any to work correctly
  const ovhPromise = fetchFromLyricsOvh(songTitle).then(r => r ? r : Promise.reject('lyrics.ovh returned null'));
  const geniusPromise = fetchFromGenius(songTitle).then(r => r ? r : Promise.reject('Genius returned null'));

  try {
    // Promise.any will return the first one that resolves successfully (doesn't throw).
    const result = await Promise.any([ovhPromise, geniusPromise]);
    console.log(`[Scraper] ✅ Search successful for "${songTitle}"`);
    return result;
  } catch (e: any) {
    console.log(`[Scraper] ❌ Both sources failed for "${songTitle}"`);
    throw new Error(`Could not find lyrics for "${songTitle}". Try searching with "Song Title - Artist Name" for better results.`);
  }
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
      // In usually "Title - Artist", so parts[0] is title, parts[1] is artist
      // Wait, earlier logic had parts[0] as artist. But usually it's "Title - Artist"! 
      // Let's assume standard "Title - Artist" format.
      title = parts[0].trim();
      artist = parts[1].trim();
      break;
    }
  }

  // Try with artist if we parsed one out
  if (artist) {
    try {
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (data.lyrics && data.lyrics.trim()) {
          return parsePlainLyrics(data.lyrics, title, artist);
        }
      }
      
      // Also try swapped just in case
      const url2 = `https://api.lyrics.ovh/v1/${encodeURIComponent(title)}/${encodeURIComponent(artist)}`;
      const res2 = await fetch(url2, { signal: AbortSignal.timeout(3000) });
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2.lyrics && data2.lyrics.trim()) {
          return parsePlainLyrics(data2.lyrics, artist, title);
        }
      }
    } catch (e) {
      // timeout or network error
    }
  }

  return null;
}


async function fetchFromGenius(songTitle: string): Promise<{ title: string, artist: string, sections: { section: string, text: string }[] } | null> {
  const query = encodeURIComponent(songTitle);
  const searchUrl = `https://genius.com/api/search/multi?per_page=5&q=${query}`;
  
  try {
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    
    let geniusUrl = '';
    
    // Find the first hit in the 'song' section
    const sections = searchData.response?.sections || [];
    for (const section of sections) {
      if (section.type === 'song' && section.hits && section.hits.length > 0) {
        for (const hit of section.hits) {
          if (hit.type === 'song' && hit.result && hit.result.url) {
            geniusUrl = hit.result.url;
            break;
          }
        }
      }
      if (geniusUrl) break;
    }

    if (!geniusUrl) return null;

    const geniusRes = await fetch(geniusUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!geniusRes.ok) return null;
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
  } catch (e: any) {
    console.log('[Scraper] Error in Genius API search:', e?.message);
    return null;
  }
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

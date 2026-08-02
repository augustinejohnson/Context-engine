import * as cheerio from 'cheerio';

export async function fetchLyricsFromWeb(songTitle: string): Promise<{ title: string, artist: string, sections: { section: string, text: string }[] }> {
  try {
    // 1. Search Genius.com via Google or directly via Genius Search API (unofficial)
    // Actually, hitting Google directly might get blocked. Let's use a public API or a simple Google search with a dummy User-Agent.
    const query = encodeURIComponent(`${songTitle} lyrics genius`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;
    
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const searchHtml = await searchRes.text();
    const $search = cheerio.load(searchHtml);
    
    // Extract the first Genius.com link
    let geniusUrl = '';
    $search('a.result__url').each((i, el) => {
      const href = $search(el).attr('href');
      if (href && href.includes('genius.com') && !geniusUrl) {
        // DuckDuckGo formats links weirdly sometimes, need to parse out the real URL
        const match = href.match(/uddg=([^&]+)/);
        if (match) {
          geniusUrl = decodeURIComponent(match[1]);
        } else {
          geniusUrl = href;
        }
      }
    });

    if (!geniusUrl) {
      throw new Error("Could not find lyrics online.");
    }

    // 2. Scrape Genius.com
    const geniusRes = await fetch(geniusUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const geniusHtml = await geniusRes.text();
    const $ = cheerio.load(geniusHtml);

    // Genius hides lyrics inside div containers with data-lyrics-container="true"
    let rawLyrics = '';
    $('[data-lyrics-container="true"]').each((i, el) => {
      // Replace <br> with newlines before extracting text
      $(el).find('br').replaceWith('\n');
      rawLyrics += $(el).text() + '\n\n';
    });

    if (!rawLyrics.trim()) {
      throw new Error("Could not extract lyrics content.");
    }

    // Extract title and artist from Genius page
    const scrapedTitle = $('h1[class^="SongHeader"]').first().text().trim() || songTitle;
    const scrapedArtist = $('a[class^="SongHeader"]').first().text().trim() || "Unknown Artist";

    // 3. Parse raw lyrics into sections
    // Genius uses [Verse 1], [Chorus], etc.
    const sections: { section: string, text: string }[] = [];
    const lines = rawLyrics.split('\n');
    
    let currentSection = 'Verse 1';
    let currentText = '';

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('[') && line.endsWith(']')) {
        // Push the previous section
        if (currentText.trim()) {
          sections.push({ section: currentSection, text: currentText.trim() });
        }
        currentSection = line.replace('[', '').replace(']', '');
        currentText = '';
      } else {
        currentText += line + '\n';
      }
    }
    
    // Push the final section
    if (currentText.trim()) {
      sections.push({ section: currentSection, text: currentText.trim() });
    }

    return {
      title: scrapedTitle,
      artist: scrapedArtist,
      sections
    };

  } catch (error: any) {
    console.error("[Scraper Error]:", error);
    throw new Error(error.message || "Failed to fetch lyrics automatically.");
  }
}

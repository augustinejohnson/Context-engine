export function detectScripture(text: string): { book: string; chapter: number; verse: number } | null {
  const regex = /([1-3]?\s?[A-Za-z]+)\s*(?:chapter)?\s*(\d+)\s*(?:verse|:)?\s*(\d+)/i;
  const match = text.match(regex);
  if (match) {
    const book = match[1].trim();
    const chapter = parseInt(match[2], 10);
    const verse = parseInt(match[3], 10);
    return { book, chapter, verse };
  }
  return null;
}

export function detectKeywords(text: string, keywords: string[]): string[] {
  const matched: string[] = [];
  const lowerText = text.toLowerCase();
  for (const kw of keywords) {
    if (lowerText.includes(kw.toLowerCase())) {
      matched.push(kw);
    }
  }
  return matched;
}

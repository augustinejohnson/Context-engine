const wordToNumber: { [key: string]: number } = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'first': 1, 'second': 2, 'third': 3,
};

function convertWordNumbers(text: string): string {
  let result = text.toLowerCase();

  // First pass: replace compound numbers like 'twenty two' or 'twenty-two' → 22
  const tens: { [key: string]: number } = { 'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50 };
  const ones: { [key: string]: number } = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
  };
  for (const [tw, tv] of Object.entries(tens)) {
    for (const [ow, ov] of Object.entries(ones)) {
      const compound = new RegExp(tw + '[\\s-]+' + ow, 'gi');
      result = result.replace(compound, String(tv + ov));
    }
  }

  // Second pass: remaining standalone teens, tens, ones, and ordinals
  const sorted = Object.keys(wordToNumber).sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, String(wordToNumber[word]));
  }

  return result;
}

export function detectScripture(text: string): { book: string; chapter: number; verse: number } | null {
  // Pre-process: convert written-out numbers to digits (e.g. "eighteen" → "18")
  const processed = convertWordNumbers(text);
  
  // Primary regex: "Book [chapter] number [verse|:] number"
  const regex = /([1-3]?\s?[A-Za-z]+)\s+(?:chapter\s+)?(\d+)\s*(?:verse\s+|:\s*)(\d+)/i;
  const match = processed.match(regex);
  if (match) {
    const book = match[1].trim();
    const chapter = parseInt(match[2], 10);
    const verse = parseInt(match[3], 10);
    return { book, chapter, verse };
  }
  
  // Fallback: "Book number number" without explicit separator
  const fallback = /([1-3]?\s?[A-Za-z]+)\s+(\d+)\s+(\d+)/i;
  const match2 = processed.match(fallback);
  if (match2) {
    const book = match2[1].trim();
    const chapter = parseInt(match2[2], 10);
    const verse = parseInt(match2[3], 10);
    // Avoid false positives: chapter should be reasonable (1-150)
    if (chapter >= 1 && chapter <= 150 && verse >= 1 && verse <= 176) {
      return { book, chapter, verse };
    }
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

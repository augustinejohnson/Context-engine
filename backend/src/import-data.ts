import Database from 'better-sqlite3';
import path from 'path';
import https from 'https';

const dbPath = path.join(__dirname, '..', 'context_engine.db');
const db = new Database(dbPath);

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Context-Engine/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
          }
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function importBibleVersions() {
  const versions = [
    { id: 'KJV', url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json' },
    { id: 'ASV', url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_asv.json' },
    { id: 'BBE', url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json' }
  ];

  for (const version of versions) {
    console.log(`Downloading ${version.id} Bible (this may take a minute)...`);
    try {
      const data = await fetchJson(version.url);
      
      console.log(`Clearing existing ${version.id} verses...`);
      db.prepare('DELETE FROM bible_verses WHERE version = ?').run(version.id);
      
      const insert = db.prepare('INSERT INTO bible_verses (book, chapter, verse, text, version) VALUES (?, ?, ?, ?, ?)');
      
      let count = 0;
      db.transaction(() => {
        for (const book of data) {
          const bookName = book.name;
          for (let c = 0; c < book.chapters.length; c++) {
            const chapterNum = c + 1;
            const verses = book.chapters[c];
            for (let v = 0; v < verses.length; v++) {
              const verseNum = v + 1;
              const text = verses[v];
              insert.run(bookName, chapterNum, verseNum, text, version.id);
              count++;
            }
          }
        }
      })();
      
      console.log(`✅ Successfully imported ${count} ${version.id} verses into the database!`);
    } catch (error) {
      console.error(`Failed to import ${version.id}:`, error);
    }
  }
}

const bookMapping: Record<string, string> = {
  'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy',
  'Josh': 'Joshua', 'Judg': 'Judges', 'Ruth': 'Ruth', '1Sam': '1 Samuel', '2Sam': '2 Samuel',
  '1Kgs': '1 Kings', '2Kgs': '2 Kings', '1Chr': '1 Chronicles', '2Chr': '2 Chronicles', 'Ezra': 'Ezra',
  'Neh': 'Nehemiah', 'Esth': 'Esther', 'Job': 'Job', 'Ps': 'Psalms', 'Prov': 'Proverbs',
  'Eccl': 'Ecclesiastes', 'Song': 'Song of Solomon', 'Isa': 'Isaiah', 'Jer': 'Jeremiah', 'Lam': 'Lamentations',
  'Ezek': 'Ezekiel', 'Dan': 'Daniel', 'Hos': 'Hosea', 'Joel': 'Joel', 'Amos': 'Amos',
  'Obad': 'Obadiah', 'Jonah': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum', 'Hab': 'Habakkuk',
  'Zeph': 'Zephaniah', 'Hag': 'Haggai', 'Zech': 'Zechariah', 'Mal': 'Malachi',
  'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John', 'Acts': 'Acts',
  'Rom': 'Romans', '1Cor': '1 Corinthians', '2Cor': '2 Corinthians', 'Gal': 'Galatians',
  'Eph': 'Ephesians', 'Phil': 'Philippians', 'Col': 'Colossians', '1Thess': '1 Thessalonians',
  '2Thess': '2 Thessalonians', '1Tim': '1 Timothy', '2Tim': '2 Timothy', 'Titus': 'Titus',
  'Phlm': 'Philemon', 'Heb': 'Hebrews', 'Jas': 'James', '1Pet': '1 Peter', '2Pet': '2 Peter',
  '1John': '1 John', '2John': '2 John', '3John': '3 John', 'Jude': 'Jude', 'Rev': 'Revelation'
};

function parseVerseRef(ref: string) {
  const parts = ref.split('.');
  if (parts.length < 3) return null;
  const book = bookMapping[parts[0]] || parts[0];
  return { book, chapter: parseInt(parts[1], 10), verse: parseInt(parts[2], 10) };
}

import AdmZip from 'adm-zip';

async function importCrossReferences() {
  console.log('Downloading OpenBible Cross-References (340k+ rows)...');
  try {
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const req = https.get('https://a.openbible.info/data/cross-references.zip', (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          https.get(res.headers.location!, (res2) => {
             const data: Buffer[] = [];
             res2.on('data', (c) => data.push(c));
             res2.on('end', () => resolve(Buffer.concat(data)));
          }).on('error', reject);
        } else {
          const data: Buffer[] = [];
          res.on('data', (c) => data.push(c));
          res.on('end', () => resolve(Buffer.concat(data)));
        }
      }).on('error', reject);
    });

    const zip = new AdmZip(zipBuffer);
    const zipEntry = zip.getEntry('cross_references.txt');
    if (!zipEntry) throw new Error('cross_references.txt not found in zip');
    
    const data = zip.readAsText(zipEntry);

    console.log('Clearing existing cross references...');
    db.prepare('DELETE FROM cross_references').run();
    
    const insert = db.prepare('INSERT INTO cross_references (from_book, from_chapter, from_verse, to_book, to_chapter, to_verse, votes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    
    let count = 0;
    const lines = data.split('\n');
    
    db.transaction(() => {
      for (let i = 1; i < lines.length; i++) { // Skip header
        const line = lines[i].trim();
        if (!line) continue;
        
        const [fromRef, toRef, votes] = line.split('\t');
        if (!fromRef || !toRef || !votes) continue;
        
        const from = parseVerseRef(fromRef);
        const to = parseVerseRef(toRef);
        if (from && to) {
          insert.run(from.book, from.chapter, from.verse, to.book, to.chapter, to.verse, parseInt(votes, 10));
          count++;
        }
      }
    })();
    
    console.log(`✅ Successfully imported ${count} cross-references into the database!`);
  } catch (error) {
    console.error('Failed to import Cross-References:', error);
  }
}

async function importEncyclopedia() {
  console.log("Downloading Easton's Bible Dictionary...");
  try {
    // A known reliable dump of Easton's Bible Dictionary
    const data = await fetchJson('https://raw.githubusercontent.com/solancer/bible-dictionary-scraper/master/Dump/Bible_Dict_json_dump.json');
    
    console.log('Clearing existing encyclopedia entries...');
    db.prepare('DELETE FROM knowledge_cards').run();
    
    const insert = db.prepare('INSERT INTO knowledge_cards (keyword, title, summary) VALUES (?, ?, ?)');
    
    let count = 0;
    db.transaction(() => {
      for (const entry of data) {
        if (entry.Word && entry.Definition) {
          const keyword = entry.Word.toLowerCase();
          const title = entry.Word;
          // Take first 300 characters of definition for the summary to keep the card readable
          const summary = entry.Definition.substring(0, 300) + (entry.Definition.length > 300 ? '...' : '');
          insert.run(keyword, title, summary);
          count++;
        }
      }
    })();
    
    console.log(`✅ Successfully imported ${count} Encyclopedia entries into the database!`);
  } catch (error) {
    console.error('Failed to import Encyclopedia:', error);
    console.log('Falling back to a smaller theological dictionary...');
    // Fallback if the URL fails
    const fallbackData = [
      ['atonement', 'Atonement', 'The reconciliation of God and humankind through Jesus Christ.'],
      ['baptism', 'Baptism', 'A Christian sacrament of admission and adoption, almost invariably with the use of water.'],
      ['communion', 'Communion', 'The Christian sacrament in which consecrated bread and wine are consumed.'],
    ];
    const insert = db.prepare('INSERT INTO knowledge_cards (keyword, title, summary) VALUES (?, ?, ?)');
    for (const [k, t, s] of fallbackData) {
      insert.run(k, t, s);
    }
  }
}

async function run() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bible_verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT,
      chapter INTEGER,
      verse INTEGER,
      text TEXT,
      version TEXT DEFAULT 'KJV'
    );
    CREATE TABLE IF NOT EXISTS knowledge_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT,
      title TEXT,
      summary TEXT
    );
    CREATE TABLE IF NOT EXISTS cross_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_book TEXT,
      from_chapter INTEGER,
      from_verse INTEGER,
      to_book TEXT,
      to_chapter INTEGER,
      to_verse INTEGER,
      votes INTEGER
    );
  `);

  await importBibleVersions();
  await importCrossReferences();
  await importEncyclopedia();
  console.log('🎉 Data import complete!');
}

run();

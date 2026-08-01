import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Replace with a valid tenant ID for seeding
const tenantId = process.env.SEED_TENANT_ID || 'default-tenant-id';

async function seed() {
  console.log('Seeding Database...');

  // 1. Bible Verses
  const bibleVerses = [
    { book: 'John', chapter: 3, verse: 16, version: 'KJV', text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
    { book: 'John', chapter: 3, verse: 16, version: 'NIV', text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
    { book: 'Genesis', chapter: 1, verse: 1, version: 'KJV', text: 'In the beginning God created the heaven and the earth.' },
    { book: 'Genesis', chapter: 1, verse: 1, version: 'NIV', text: 'In the beginning God created the heavens and the earth.' },
    { book: 'Psalm', chapter: 23, verse: 1, version: 'KJV', text: 'The Lord is my shepherd; I shall not want.' },
    { book: 'Psalm', chapter: 23, verse: 1, version: 'NIV', text: 'The Lord is my shepherd, I lack nothing.' },
    { book: 'Romans', chapter: 8, verse: 28, version: 'KJV', text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
    { book: 'Romans', chapter: 8, verse: 28, version: 'NIV', text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.' },
    { book: 'Philippians', chapter: 4, verse: 13, version: 'KJV', text: 'I can do all things through Christ which strengtheneth me.' },
    { book: 'Philippians', chapter: 4, verse: 13, version: 'NIV', text: 'I can do all this through him who gives me strength.' },
    { book: 'Proverbs', chapter: 3, verse: 5, version: 'KJV', text: 'Trust in the Lord with all thine heart; and lean not unto thine own understanding.' },
    { book: 'Proverbs', chapter: 3, verse: 5, version: 'NIV', text: 'Trust in the Lord with all your heart and lean not on your own understanding.' },
    { book: 'Isaiah', chapter: 41, verse: 10, version: 'KJV', text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.' },
    { book: 'Isaiah', chapter: 41, verse: 10, version: 'NIV', text: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.' },
    { book: 'Jeremiah', chapter: 29, verse: 11, version: 'KJV', text: 'For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil, to give you an expected end.' },
    { book: 'Jeremiah', chapter: 29, verse: 11, version: 'NIV', text: 'For I know the plans I have for you,” declares the Lord, “plans to prosper you and not to harm you, plans to give you hope and a future.' },
    { book: 'Matthew', chapter: 6, verse: 33, version: 'KJV', text: 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.' },
    { book: 'Matthew', chapter: 6, verse: 33, version: 'NIV', text: 'But seek first his kingdom and his righteousness, and all these things will be given to you as well.' },
    { book: 'John', chapter: 14, verse: 6, version: 'KJV', text: 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.' },
    { book: 'John', chapter: 14, verse: 6, version: 'NIV', text: 'Jesus answered, “I am the way and the truth and the life. No one comes to the Father except through me.”' }
  ];

  for (const v of bibleVerses) {
    await supabase.from('bible_verses').insert({ ...v, tenant_id: tenantId });
  }

  // 2. Knowledge Cards
  const knowledgeCards = [
    { keyword: 'grace', title: 'Grace', summary: 'The unmerited favor of God.' },
    { keyword: 'salvation', title: 'Salvation', summary: 'Deliverance from sin and its consequences.' },
    { keyword: 'albert einstein', title: 'Albert Einstein', summary: 'Theoretical physicist known for the theory of relativity.' },
    { keyword: 'martin luther king', title: 'Martin Luther King Jr.', summary: 'American civil rights leader.' },
    { keyword: 'intellectual capacity', title: 'Intellectual Capacity', summary: 'The ability to think, learn, and understand.' },
    { keyword: 'faith', title: 'Faith', summary: 'Complete trust or confidence in someone or something.' },
    { keyword: 'hope', title: 'Hope', summary: 'A feeling of expectation and desire for a certain thing to happen.' },
    { keyword: 'love', title: 'Love', summary: 'An intense feeling of deep affection.' },
    { keyword: 'peace', title: 'Peace', summary: 'Freedom from disturbance; tranquility.' },
    { keyword: 'joy', title: 'Joy', summary: 'A feeling of great pleasure and happiness.' }
  ];

  for (const k of knowledgeCards) {
    await supabase.from('knowledge_cards').insert({ ...k, tenant_id: tenantId });
  }

  // 3. Songs
  const songs = [
    { title: 'Amazing Grace', artist: 'John Newton', lyrics: 'Amazing grace! How sweet the sound\nThat saved a wretch like me!\n\nI once was lost, but now am found;\nWas blind, but now I see.' },
    { title: 'How Great Thou Art', artist: 'Carl Boberg', lyrics: 'O Lord my God, When I in awesome wonder,\nConsider all the worlds Thy Hands have made;\n\nThen sings my soul, My Saviour God, to Thee,\nHow great Thou art, How great Thou art.' },
    { title: 'It Is Well With My Soul', artist: 'Horatio Spafford', lyrics: 'When peace, like a river, attendeth my way,\nWhen sorrows like sea billows roll;\n\nIt is well, it is well, with my soul.' }
  ];

  for (const s of songs) {
    const { data } = await supabase.from('songs').insert({ ...s, tenant_id: tenantId }).select('id').single();
    if (data) {
      const parts = s.lyrics.split('\\n\\n');
      for (let i = 0; i < parts.length; i++) {
        await supabase.from('song_lyrics').insert({
          title: s.title,
          artist: s.artist,
          section: \`Part \${i + 1}\`,
          text: parts[i],
          tenant_id: tenantId
        });
      }
    }
  }

  console.log('Seeding Complete!');
}

seed().catch(console.error);

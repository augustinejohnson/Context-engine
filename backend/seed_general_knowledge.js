const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantId = 'a5f2bd71-fe0a-4309-98f3-b77ff49e8a65';

const facts = [
  // Science
  { keyword: 'Photosynthesis', title: 'Photosynthesis', summary: 'The process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water.' },
  { keyword: 'Gravity', title: 'Gravity', summary: 'A fundamental interaction which causes mutual attraction between all things with mass or energy.' },
  { keyword: 'DNA', title: 'DNA (Deoxyribonucleic Acid)', summary: 'A molecule composed of two polynucleotide chains that coil around each other to carry genetic instructions.' },
  { keyword: 'Quantum Mechanics', title: 'Quantum Mechanics', summary: 'A fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles.' },
  { keyword: 'Evolution', title: 'Evolution', summary: 'The change in the heritable characteristics of biological populations over successive generations.' },
  { keyword: 'Thermodynamics', title: 'Thermodynamics', summary: 'The branch of physics that deals with heat, work, and temperature, and their relation to energy, radiation, and physical properties of matter.' },
  { keyword: 'Black Hole', title: 'Black Hole', summary: 'A region of spacetime where gravity is so strong that nothing—no particles or even electromagnetic radiation such as light—can escape from it.' },
  { keyword: 'Antibiotics', title: 'Antibiotics', summary: 'A type of antimicrobial substance active against bacteria and is the most important type of antibacterial agent for fighting bacterial infections.' },
  { keyword: 'Plate Tectonics', title: 'Plate Tectonics', summary: 'A scientific theory describing the large-scale motion of seven large plates and the movements of a larger number of smaller plates of Earth lithosphere.' },
  { keyword: 'Mitosis', title: 'Mitosis', summary: 'A part of the cell cycle in which replicated chromosomes are separated into two new nuclei.' },
  { keyword: 'Periodic Table', title: 'Periodic Table', summary: 'A tabular display of the chemical elements, organized by atomic number, electron configuration, and recurring chemical properties.' },
  { keyword: 'Ecosystem', title: 'Ecosystem', summary: 'A geographic area where plants, animals, and other organisms, as well as weather and landscape, work together to form a bubble of life.' },
  
  // Technology
  { keyword: 'Artificial Intelligence', title: 'Artificial Intelligence', summary: 'Intelligence demonstrated by machines, as opposed to the natural intelligence displayed by animals including humans.' },
  { keyword: 'Blockchain', title: 'Blockchain', summary: 'A growing list of records, called blocks, that are linked together using cryptography.' },
  { keyword: 'Machine Learning', title: 'Machine Learning', summary: 'The study of computer algorithms that can improve automatically through experience and by the use of data.' },
  { keyword: 'Internet of Things', title: 'Internet of Things (IoT)', summary: 'Describes physical objects with sensors, processing ability, software, and other technologies that connect and exchange data with other devices and systems over the Internet.' },
  { keyword: 'Cloud Computing', title: 'Cloud Computing', summary: 'The on-demand availability of computer system resources, especially data storage and computing power, without direct active management by the user.' },
  { keyword: 'Quantum Computing', title: 'Quantum Computing', summary: 'A type of computation whose operations can harness the phenomena of quantum mechanics, such as superposition, interference, and entanglement.' },
  { keyword: 'Cryptography', title: 'Cryptography', summary: 'The practice and study of techniques for secure communication in the presence of third parties called adversaries.' },
  { keyword: 'Virtual Reality', title: 'Virtual Reality (VR)', summary: 'A simulated experience that can be similar to or completely different from the real world.' },
  { keyword: 'Algorithm', title: 'Algorithm', summary: 'A finite sequence of rigorous instructions, typically used to solve a class of specific problems or to perform a computation.' },
  { keyword: 'Open Source', title: 'Open Source', summary: 'Source code that is made freely available for possible modification and redistribution.' },
  { keyword: 'Cybersecurity', title: 'Cybersecurity', summary: 'The practice of protecting systems, networks, and programs from digital attacks.' },
  
  // History
  { keyword: 'Roman Empire', title: 'Roman Empire', summary: 'The post-Republican period of ancient Rome, consisting of large territorial holdings around the Mediterranean Sea in Europe, North Africa, and Western Asia.' },
  { keyword: 'Industrial Revolution', title: 'Industrial Revolution', summary: 'The transition to new manufacturing processes in Great Britain, continental Europe, and the United States, in the period from about 1760 to sometime between 1820 and 1840.' },
  { keyword: 'Renaissance', title: 'Renaissance', summary: 'A fervent period of European cultural, artistic, political and economic "rebirth" following the Middle Ages.' },
  { keyword: 'French Revolution', title: 'French Revolution', summary: 'A period of radical political and societal change in France that began with the Estates General of 1789 and ended with the formation of the French Consulate in 1799.' },
  { keyword: 'World War II', title: 'World War II', summary: 'A global war that lasted from 1939 to 1945, involving the vast majority of the world\'s countries—including all the great powers—forming two opposing military alliances: the Allies and the Axis.' },
  { keyword: 'Magna Carta', title: 'Magna Carta', summary: 'A royal charter of rights agreed to by King John of England at Runnymede, near Windsor, on 15 June 1215.' },
  { keyword: 'Cold War', title: 'Cold War', summary: 'A period of geopolitical tension between the United States and the Soviet Union and their respective allies, the Western Bloc and the Eastern Bloc, which began following World War II.' },
  { keyword: 'Ancient Egypt', title: 'Ancient Egypt', summary: 'A civilization of ancient North Africa, concentrated along the lower reaches of the Nile River, situated in the place that is now the country Egypt.' },
  { keyword: 'Enlightenment', title: 'Age of Enlightenment', summary: 'An intellectual and philosophical movement that dominated the world of ideas in Europe during the 17th and 18th centuries.' },
  { keyword: 'Silk Road', title: 'Silk Road', summary: 'A network of Eurasian trade routes active from the second century BCE until the mid-15th century.' },
  { keyword: 'Berlin Wall', title: 'Berlin Wall', summary: 'A guarded concrete barrier that physically and ideologically divided Berlin from 1961 to 1989.' },
  
  // Business/Economics
  { keyword: 'Capitalism', title: 'Capitalism', summary: 'An economic system based on the private ownership of the means of production and their operation for profit.' },
  { keyword: 'Inflation', title: 'Inflation', summary: 'The general increase in prices and fall in the purchasing value of money.' },
  { keyword: 'Supply and Demand', title: 'Supply and Demand', summary: 'An economic model of price determination in a market. It postulates that in a competitive market, the unit price for a particular good will vary until it settles at a point where the quantity demanded will equal the quantity supplied.' },
  { keyword: 'Gross Domestic Product', title: 'Gross Domestic Product (GDP)', summary: 'A monetary measure of the market value of all the final goods and services produced in a specific time period.' },
  { keyword: 'Monopoly', title: 'Monopoly', summary: 'Exists when a specific person or enterprise is the only supplier of a particular commodity.' },
  { keyword: 'Interest Rate', title: 'Interest Rate', summary: 'The amount of interest due per period, as a proportion of the amount lent, deposited or borrowed.' },
  { keyword: 'Cryptocurrency', title: 'Cryptocurrency', summary: 'A digital currency designed to work as a medium of exchange through a computer network that is not reliant on any central authority, such as a government or bank, to uphold or maintain it.' },
  { keyword: 'Stock Market', title: 'Stock Market', summary: 'The aggregation of buyers and sellers of stocks, which represent ownership claims on businesses.' },
  { keyword: 'Entrepreneurship', title: 'Entrepreneurship', summary: 'The creation or extraction of economic value. With this definition, entrepreneurship is viewed as change, generally entailing risk beyond what is normally encountered in starting a business.' },
  { keyword: 'Globalization', title: 'Globalization', summary: 'The process of interaction and integration among people, companies, and governments worldwide.' },
  
  // Additional Science & Tech
  { keyword: 'Neuroscience', title: 'Neuroscience', summary: 'The scientific study of the nervous system, including the brain, spinal cord, and networks of sensory nerve cells called neurons.' },
  { keyword: 'Nanotechnology', title: 'Nanotechnology', summary: 'The manipulation of matter on an atomic, molecular, and supramolecular scale.' },
  { keyword: 'Gene Editing', title: 'CRISPR Gene Editing', summary: 'A genetic engineering technique in molecular biology by which the genomes of living organisms may be modified.' },
  { keyword: 'Dark Matter', title: 'Dark Matter', summary: 'A hypothetical form of matter thought to account for approximately 85% of the matter in the universe.' },
  { keyword: 'Supernova', title: 'Supernova', summary: 'A powerful and luminous stellar explosion. This transient astronomical event occurs during the last evolutionary stages of a massive star.' }
];

async function seed() {
  console.log('Seeding', facts.length, 'facts to database...');
  
  // Get existing
  const { data: existing } = await supabase.from('knowledge_cards').select('keyword').eq('tenant_id', tenantId);
  const existingKeys = new Set(existing.map(r => r.keyword.toLowerCase()));

  for (const item of facts) {
    if (existingKeys.has(item.keyword.toLowerCase())) {
      console.log('Skipping existing:', item.keyword);
      continue;
    }

    const { error } = await supabase.from('knowledge_cards').insert({
      tenant_id: tenantId,
      keyword: item.keyword,
      title: item.title,
      summary: item.summary
    });
    
    if (error) {
      console.error('Error inserting', item.keyword, error);
    } else {
      console.log('Inserted:', item.keyword);
    }
  }
  console.log('Seeding complete.');
}

seed();

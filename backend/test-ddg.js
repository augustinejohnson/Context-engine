const cheerio = require('cheerio'); 
fetch('https://html.duckduckgo.com/html/?q=Way+Maker+lyrics+genius', {headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}})
.then(res => res.text())
.then(t => { 
  const $ = cheerio.load(t); 
  let urls = []; 
  $('a.result__url').each((i, el) => urls.push($(el).attr('href'))); 
  console.log(urls); 
})

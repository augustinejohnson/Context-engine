import OpenAI from 'openai';

async function test() {
  const openaiClient = new OpenAI({ 
    apiKey: process.env.TEST_KEY || 'sk-or-v1-invalid-key-for-testing',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Live Broadcast Context Engine"
    }
  });

  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'google/gemma-7b-it:free',
      messages: [{ role: 'user', content: 'hello' }]
    });
    console.log(completion.choices[0].message);
  } catch (e: any) {
    console.error('Error:', e.response?.data || e.message || e);
  }
}

test();

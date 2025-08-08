// Legacy Vercel API route for OpenAI integration - Fixed version
export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    const keyPreview = process.env.OPENAI_API_KEY ? 
      process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'Not found';
    
    return res.json({ 
      message: 'AI API route is working!',
      hasApiKey,
      keyPreview,
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    try {
      const { action, title, content, language, summary } = req.body;

      if (action === 'summarize') {
        const prompt = `You are a professional journalist writing for Asian American Voices Media. Write a comprehensive, objective news summary of 300-400 words for: "${title}". Focus on facts and maintain journalistic objectivity.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o', // Switch to gpt-4o for better quality
            messages: [
              { role: 'system', content: 'You are a professional journalist writing objective news summaries.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 800,
            temperature: 0.2,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenAI summarization error:', errorText);
          return res.status(500).json({ error: `OpenAI error: ${response.status}` });
        }

        const data = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim();
        
        if (!result) {
          return res.status(500).json({ error: 'No summary generated' });
        }
        
        return res.json({ result });
      }

      if (action === 'translate') {
        // Normalize language to lowercase to handle 'Chinese', 'Korean', etc.
        const normalizedLanguage = language?.toLowerCase();
        
        if (!['chinese', 'korean'].includes(normalizedLanguage)) {
          return res.status(400).json({ 
            error: 'Invalid language. Supported: chinese, korean' 
          });
        }

        if (!summary || summary.trim().length === 0) {
          return res.status(400).json({ 
            error: 'No summary provided for translation' 
          });
        }

        const prompt = normalizedLanguage === 'chinese' 
          ? `Translate this English news summary to simplified Chinese, maintaining journalistic tone: ${summary}`
          : `Translate this English news summary to Korean, maintaining journalistic tone: ${summary}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o', // Use gpt-4o for translations too
            messages: [
              { 
                role: 'system', 
                content: `You are a professional translator specializing in ${normalizedLanguage === 'chinese' ? 'Chinese' : 'Korean'} news translation.` 
              },
              { role: 'user', content: prompt }
            ],
            max_tokens: 1000,
            temperature: 0.1,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenAI translation error:', errorText);
          return res.status(500).json({ error: `Translation failed: ${response.status}` });
        }

        const data = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim();
        
        if (!result) {
          return res.status(500).json({ error: 'No translation generated' });
        }
        
        return res.json({ result });
      }

      return res.status(400).json({ error: 'Invalid action. Use: summarize, translate' });

    } catch (error) {
      console.error('API route error:', error);
      return res.status(500).json({ error: `Server error: ${error.message}` });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

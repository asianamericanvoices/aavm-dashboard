// API route for OpenAI integration
import { NextResponse } from 'next/server';

export async function GET(request) {
  console.log('GET request to:', request.url);
  
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const keyPreview = process.env.OPENAI_API_KEY ? 
    process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'Not found';
  
  return NextResponse.json({ 
    message: 'AI API route is working!',
    hasApiKey,
    keyPreview,
    requestUrl: request.url
  });
}

export async function POST(request) {
  console.log('POST request to:', request.url);
  console.log('POST request received');
  
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.log('No API key found');
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    console.log('Request body:', body);
    
    const { action, title, content, language, summary } = body;

    if (action === 'summarize') {
      console.log('Summarizing article:', title);
      
      const prompt = `You are a professional journalist writing for Asian American Voices Media. Write a comprehensive, objective news summary of the following article in 300-400 words. 

Guidelines:
- Focus on facts and key developments
- Maintain journalistic objectivity with no editorial bias
- Include relevant context for Asian American readers when applicable
- Use proper news writing structure (lead, body, conclusion)
- Write in third person

Article Title: ${title}
Content: ${content || title}

Write a professional news summary:`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 600,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI summarization error:', errorText);
        return NextResponse.json({ 
          error: `OpenAI summarization failed: ${response.status}` 
        }, { status: 500 });
      }

      const data = await response.json();
      console.log('Summary generated successfully');
      
      return NextResponse.json({ 
        result: data.choices[0]?.message?.content?.trim() || 'Summary could not be generated'
      });
    }

    if (action === 'translate') {
      console.log('Translating to:', language);
      
      if (!summary || summary.trim().length === 0) {
        return NextResponse.json({ 
          error: 'No summary provided for translation' 
        }, { status: 400 });
      }

      let prompt = '';
      if (language === 'chinese') {
        prompt = `Translate the following English news summary into simplified Chinese. Maintain the journalistic tone and accuracy:

${summary}

Chinese Translation:`;
      } else if (language === 'korean') {
        prompt = `Translate the following English news summary into Korean. Maintain the journalistic tone and accuracy:

${summary}

Korean Translation:`;
      } else {
        return NextResponse.json({ 
          error: 'Unsupported language. Use "chinese" or "korean"' 
        }, { status: 400 });
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 800,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI translation error:', errorText);
        return NextResponse.json({ 
          error: `Translation failed: ${response.status}` 
        }, { status: 500 });
      }

      const data = await response.json();
      console.log('Translation completed successfully for language:', language);
      
      return NextResponse.json({ 
        result: data.choices[0]?.message?.content?.trim() || 'Translation could not be generated'
      });
    }

    return NextResponse.json({ 
      error: 'Invalid action. Use "summarize" or "translate"' 
    }, { status: 400 });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json({ 
      error: `Server error: ${error.message}` 
    }, { status: 500 });
  }
}

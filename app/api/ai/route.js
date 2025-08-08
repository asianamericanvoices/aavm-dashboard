// API route for OpenAI integration - Updated format
import { NextResponse } from 'next/server';

export async function GET() {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const keyPreview = process.env.OPENAI_API_KEY ? 
    process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'Not found';
  
  return NextResponse.json({ 
    message: 'AI API route is working!',
    hasApiKey,
    keyPreview,
    timestamp: new Date().toISOString()
  });
}

export async function POST(request) {
  console.log('POST request received at:', new Date().toISOString());
  
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error('No OpenAI API key found in environment variables');
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    console.log('Request body received:', JSON.stringify(body, null, 2));
    
    const { action, title, content, language, summary } = body;

    if (action === 'summarize') {
      console.log('Starting summarization for:', title);
      
      const prompt = `You are a professional journalist writing for Asian American Voices Media. 

Write a comprehensive, objective news summary of 300-400 words based on this article:

Title: ${title}
Content: ${content || 'Limited content available - please expand based on the title and context.'}

Requirements:
- Write in clear, professional journalism style
- Focus on facts and key developments
- Maintain complete objectivity with no editorial bias
- Include relevant context for Asian American readers when applicable
- Use third person throughout
- Structure with clear lead paragraph followed by supporting details

Write the summary now:`;

      console.log('Sending request to OpenAI API...');

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional journalist. Write objective, factual news summaries in a clear, engaging style appropriate for Asian American Voices Media.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 800,
          temperature: 0.2,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        }),
      });

      console.log('OpenAI response status:', openaiResponse.status);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error response:', errorText);
        
        let errorMessage = 'OpenAI API request failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch (e) {
          // Use default message if can't parse error
        }
        
        return NextResponse.json({ 
          error: `Summarization failed: ${errorMessage}`,
          details: errorText
        }, { status: 500 });
      }

      const data = await openaiResponse.json();
      console.log('OpenAI response received successfully');
      
      const summary = data.choices?.[0]?.message?.content?.trim();
      
      if (!summary) {
        console.error('No content in OpenAI response:', JSON.stringify(data, null, 2));
        return NextResponse.json({ 
          error: 'No summary content returned from OpenAI' 
        }, { status: 500 });
      }

      console.log('Summary generated successfully, length:', summary.length);
      
      return NextResponse.json({ 
        result: summary,
        usage: data.usage
      });
    }

    if (action === 'translate') {
      console.log('Starting translation to:', language);
      
      if (!summary || summary.trim().length === 0) {
        return NextResponse.json({ 
          error: 'No summary provided for translation. Please generate a summary first.' 
        }, { status: 400 });
      }

      if (!['chinese', 'korean'].includes(language)) {
        return NextResponse.json({ 
          error: 'Invalid language. Supported languages: chinese, korean' 
        }, { status: 400 });
      }

      let systemPrompt = '';
      let userPrompt = '';

      if (language === 'chinese') {
        systemPrompt = 'You are a professional translator specializing in news content for Chinese-speaking audiences. Translate accurately while maintaining the journalistic tone and cultural appropriateness.';
        userPrompt = `Translate this English news summary into simplified Chinese. Maintain the professional journalistic tone and ensure the translation is natural and appropriate for Chinese readers:

${summary}

Provide only the Chinese translation:`;
      } else if (language === 'korean') {
        systemPrompt = 'You are a professional translator specializing in news content for Korean-speaking audiences. Translate accurately while maintaining the journalistic tone and cultural appropriateness.';
        userPrompt = `Translate this English news summary into Korean. Maintain the professional journalistic tone and ensure the translation is natural and appropriate for Korean readers:

${summary}

Provide only the Korean translation:`;
      }

      console.log('Sending translation request to OpenAI...');

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.1,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        }),
      });

      console.log('OpenAI translation response status:', openaiResponse.status);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI translation error:', errorText);
        
        let errorMessage = 'Translation API request failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch (e) {
          // Use default message
        }
        
        return NextResponse.json({ 
          error: `Translation failed: ${errorMessage}`,
          details: errorText
        }, { status: 500 });
      }

      const data = await openaiResponse.json();
      const translation = data.choices?.[0]?.message?.content?.trim();
      
      if (!translation) {
        console.error('No translation content returned:', JSON.stringify(data, null, 2));
        return NextResponse.json({ 
          error: 'No translation content returned from OpenAI' 
        }, { status: 500 });
      }

      console.log(`Translation to ${language} completed successfully, length:`, translation.length);
      
      return NextResponse.json({ 
        result: translation,
        usage: data.usage
      });
    }

    return NextResponse.json({ 
      error: 'Invalid action. Supported actions: summarize, translate' 
    }, { status: 400 });

  } catch (error) {
    console.error('API route error:', error);
    
    // More detailed error information
    let errorMessage = error.message;
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = 'Network error connecting to OpenAI API';
    }
    
    return NextResponse.json({ 
      error: `Server error: ${errorMessage}`,
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

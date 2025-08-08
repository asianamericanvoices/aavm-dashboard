// API route for OpenAI integration - Updated with source attribution
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
    
    const { action, title, content, language, summary, source } = body;

    if (action === 'summarize') {
      console.log('Starting summarization for:', title);
      
      const prompt = `You are a professional journalist writing for Asian American Voices Media. 

Write a comprehensive, objective news summary of 300-400 words that reports the news events and developments described in this article. Focus on WHAT happened, WHO was involved, WHEN it occurred, WHERE it took place, and WHY it matters.

STRICT REQUIREMENTS:
- NEVER fabricate, hallucinate, or create quotes that don't exist in the source material
- NEVER add information not present in the original article
- NEVER create composite quotes or paraphrase quotes as direct quotes
- ONLY use direct quotes that appear verbatim in the source material
- When paraphrasing, make it clear it's paraphrasing, not a direct quote
- Include proper attribution for all claims and information
- Report the news events, not analyze the article itself
- Focus on the actual developments, decisions, actions, and statements reported
- Use proper source attribution (e.g., "Reuters reports," "According to ${source || 'the source'}," "${source || 'The source'} reported")
- NEVER refer to "the article" - always cite the actual news source by name
- Format with natural paragraph breaks for readability (2-3 paragraphs)
- End with substantive news content, NOT meta-commentary about the story or its implications
- Do not include concluding sentences that sound like analysis or book reports

Title: ${title}
Source: This article is from ${source || 'the original source'}
Content: ${content}

Requirements:
- Write in clear, professional journalism style reporting the news events
- Focus on facts explicitly stated in the source material about what happened
- Maintain complete objectivity with no editorial bias
- Include direct quotes from the article when available, using quotation marks
- Attribute all information to the news source (e.g., "${source || 'The source'} reported," "According to ${source || 'the source'}")
- Include relevant context for Asian American readers when the article provides such context
- Use third person throughout
- Structure with 2-3 clear paragraphs with natural breaks
- Lead paragraph: main news event
- Supporting paragraphs: key details, quotes, context
- End with concrete facts or developments, not analysis
- Always reference the news source by name, never as "the article"

Write the news summary now with proper paragraph formatting:`;

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
              content: `You are a professional journalist reporting news events. Write news summaries that focus on WHAT happened, WHO was involved, WHEN and WHERE events occurred, and specific developments reported in the source. Always attribute information to the specific news source (${source || 'the source'}) and never refer to "the article." Format with natural paragraph breaks (2-3 paragraphs). End with concrete facts or developments, NOT analysis or meta-commentary about the story's implications. Report the news events the source describes, not analysis of the source itself. You NEVER fabricate quotes, add information not in the source, or create composite statements. Every piece of information must be traceable to the source material provided.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 800,
          temperature: 0.1,
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
        systemPrompt = 'You are a professional translator specializing in news content for Chinese-speaking audiences. Translate accurately while maintaining the journalistic tone, preserving all attributions and quotes exactly as they appear in the original text. Do not add, omit, or modify any factual content.';
        userPrompt = `Translate this English news summary into simplified Chinese. Maintain the professional journalistic tone, preserve all quotes and attributions exactly, and ensure the translation is natural and appropriate for Chinese readers. Do not add any information not present in the original:

${summary}

Provide only the Chinese translation:`;
      } else if (language === 'korean') {
        systemPrompt = 'You are a professional translator specializing in news content for Korean-speaking audiences. Translate accurately while maintaining the journalistic tone, preserving all attributions and quotes exactly as they appear in the original text. Do not add, omit, or modify any factual content.';
        userPrompt = `Translate this English news summary into Korean. Maintain the professional journalistic tone, preserve all quotes and attributions exactly, and ensure the translation is natural and appropriate for Korean readers. Do not add any information not present in the original:

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

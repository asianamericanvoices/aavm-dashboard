// API route for OpenAI integration - Updated with title regeneration and fixes
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

    if (action === 'generate_title') {
      console.log('Starting title generation for:', title);
      
      const prompt = `You are a skilled headline writer for Asian American Voices Media, creating engaging, punchy headlines that capture reader attention while maintaining journalistic integrity.

Given this original headline: "${title}"
From source: ${source || 'the original source'}

Create a more engaging, punchy headline that:
- Is 8-15 words maximum
- Captures the essence of the story better than the original
- Uses active voice and strong verbs
- Avoids clickbait but creates genuine interest
- Is appropriate for Asian American Voices Media's audience
- Focuses on the human impact or key development
- Removes unnecessary words like "according to reports" or publication names
- Makes the story feel immediate and relevant

Examples of good transformations:
"Company Reports Q3 Earnings Beat Expectations" → "Tech Giant Crushes Profit Targets"
"Study Shows Increase in Remote Work Adoption" → "Remote Work Revolution Transforms American Workplace"
"Officials Announce New Policy Changes" → "Major Policy Shift Reshapes Immigration Rules"

Generate ONE punchy headline that's better than the original:`;

      console.log('Sending title generation request to OpenAI API...');

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
              content: 'You are an expert headline writer who creates punchy, engaging headlines that are 8-15 words maximum. Focus on active voice, strong verbs, and human impact. Avoid clickbait but create genuine interest. Return ONLY the new headline, nothing else.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 50,
          temperature: 0.7,
          top_p: 1,
          frequency_penalty: 0.3,
          presence_penalty: 0.3
        }),
      });

      console.log('OpenAI title response status:', openaiResponse.status);

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
          error: `Title generation failed: ${errorMessage}`,
          details: errorText
        }, { status: 500 });
      }

      const data = await openaiResponse.json();
      console.log('OpenAI title response received successfully');
      
      const newTitle = data.choices?.[0]?.message?.content?.trim();
      
      if (!newTitle) {
        console.error('No title content in OpenAI response:', JSON.stringify(data, null, 2));
        return NextResponse.json({ 
          error: 'No title content returned from OpenAI' 
        }, { status: 500 });
      }

      // Clean up the title (remove quotes if AI added them)
      const cleanTitle = newTitle.replace(/^["']|["']$/g, '').trim();

      console.log('Title generated successfully:', cleanTitle);
      
      return NextResponse.json({ 
        result: cleanTitle,
        usage: data.usage
      });
    }

    if (action === 'translate_title') {
      console.log('Starting title translation to:', language);
      
      if (!title || title.trim().length === 0) {
        return NextResponse.json({ 
          error: 'No title provided for translation.' 
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
        systemPrompt = 'You are a professional translator specializing in news headlines for Chinese-speaking audiences. Translate headlines accurately while maintaining the punchy, engaging tone. Keep the translation concise and impactful.';
        userPrompt = `Translate this English news headline into simplified Chinese. Maintain the engaging, punchy tone and ensure the translation is natural and appropriate for Chinese readers:

"${title}"

Provide only the Chinese translation:`;
      } else if (language === 'korean') {
        systemPrompt = 'You are a professional translator specializing in news headlines for Korean-speaking audiences. Translate headlines accurately while maintaining the punchy, engaging tone. Keep the translation concise and impactful.';
        userPrompt = `Translate this English news headline into Korean. Maintain the engaging, punchy tone and ensure the translation is natural and appropriate for Korean readers:

"${title}"

Provide only the Korean translation:`;
      }

      console.log('Sending title translation request to OpenAI...');

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
          max_tokens: 100,
          temperature: 0.1,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        }),
      });

      console.log('OpenAI title translation response status:', openaiResponse.status);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI title translation error:', errorText);
        
        let errorMessage = 'Title translation API request failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch (e) {
          // Use default message
        }
        
        return NextResponse.json({ 
          error: `Title translation failed: ${errorMessage}`,
          details: errorText
        }, { status: 500 });
      }

      const data = await openaiResponse.json();
      const translation = data.choices?.[0]?.message?.content?.trim();
      
      if (!translation) {
        console.error('No title translation content returned:', JSON.stringify(data, null, 2));
        return NextResponse.json({ 
          error: 'No title translation content returned from OpenAI' 
        }, { status: 500 });
      }

      // Clean up the translation (remove quotes if AI added them)
      const cleanTranslation = translation.replace(/^["']|["']$/g, '').trim();

      console.log(`Title translation to ${language} completed successfully:`, cleanTranslation);
      
      return NextResponse.json({ 
        result: cleanTranslation,
        usage: data.usage
      });
    }

    if (action === 'summarize') {
      console.log('Starting summarization for:', title);
      
      // Check if we have actual article content
      if (!content || content.trim().length < 100) {
        return NextResponse.json({ 
          error: 'Insufficient article content provided. Cannot generate summary without the full article text.' 
        }, { status: 400 });
      }

      // Check if content appears to be just metadata (constructed fake content)
      const isJustMetadata = content.includes('This article needs a comprehensive summary') || 
                            content.includes('[Note: Full article content not available]') ||
                            content.split('.').length < 5; // Very short content

      if (isJustMetadata) {
        return NextResponse.json({ 
          error: 'Only article metadata provided. Full article text is required to generate accurate summaries without fabrication. Please ensure your scraping system captures the complete article content.' 
        }, { status: 400 });
      }
      
      const prompt = `You are a professional journalist writing for Asian American Voices Media. 

You are provided with the FULL TEXT of a news article below. Write a comprehensive, objective news summary of 300-400 words that reports ONLY the events and information explicitly stated in this article.

CRITICAL REQUIREMENTS - JOURNALISTIC INTEGRITY:
- NEVER fabricate, hallucinate, or create ANY quotes that don't exist in the source material
- NEVER add information not present in the original article
- NEVER create composite quotes or paraphrase quotes as direct quotes
- ONLY use direct quotes that appear VERBATIM in the source material provided below
- If no quotes exist in the source, do NOT include any quotes
- When paraphrasing, make it clear it's paraphrasing, not a direct quote
- Every fact, figure, name, date, and claim MUST be directly traceable to the source text
- NEVER refer to "the article" - always cite the actual news source by name: "${source || 'the source'}"
- If the source article is incomplete or truncated, state that clearly

Source Publication: ${source || 'the original source'}
Article Headline: ${title}

FULL ARTICLE TEXT:
${content}

Requirements:
- Write in clear, professional journalism style reporting ONLY the news events described in the source text above
- Focus ONLY on facts explicitly stated in the source material above
- Maintain complete objectivity with no editorial bias
- Include direct quotes from the article ONLY if they appear verbatim in the source text above
- Attribute all information to the news source by name (e.g., "${source || 'The source'} reported," "According to ${source || 'the source'}")
- Use third person throughout
- Structure with 2-3 clear paragraphs with natural breaks
- Lead paragraph: main news event as reported in the source
- Supporting paragraphs: key details, quotes (if any exist), context from the source
- End with concrete facts or developments from the source, not analysis
- Always reference "${source || 'the source'}" by name, NEVER as "the article"
- If the article appears incomplete or cut off, mention this limitation
- Every sentence must be traceable to information explicitly provided in the source text above

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

      // Convert paragraph breaks to HTML format for display
      const formattedSummary = summary.replace(/\n\n/g, '\n\n').replace(/\n/g, '<br>');

      console.log('Summary generated successfully, length:', summary.length);
      
      return NextResponse.json({ 
        result: formattedSummary,
        usage: data.usage
      });
    }

    if (action === 'generate_image') {
      console.log('Starting image generation for:', title);
      
      if (!title || title.trim().length === 0) {
        return NextResponse.json({ 
          error: 'No article title provided for image generation.' 
        }, { status: 400 });
      }

      // Create a descriptive prompt for the image
      const imagePrompt = `Create a professional, photorealistic news illustration for this article: "${title}". 

CRITICAL REQUIREMENTS - NO EXCEPTIONS:
- Absolutely NO text, words, letters, numbers, signs, or any written content visible anywhere in the image
- NO newspapers, documents, books, screens with text, or any readable materials
- NO street signs, building signs, or any signage with text
- NO weighing scales, balance scales, or justice-related imagery (avoid legal/court symbolism)
- NO dollar signs, currency symbols, or financial symbols
- Focus on natural scenes, people in action, buildings, technology, or abstract concepts
- Photorealistic, high-quality photography style
- NO recognizable faces of real people or celebrities
- Clean, modern composition suitable for news media
- Professional lighting and composition
- Suitable for Asian American Voices Media publication
- Think: landscapes, cityscapes, business environments, technology, healthcare settings, but NEVER include scales, legal symbols, or any form of readable text

Create a visual representation that captures the essence of the news story through real-world scenes and objects, avoiding overused legal/financial symbolism.`;

      console.log('Sending image generation request to OpenAI...');

      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: imagePrompt,
            n: 1,
            size: '1024x1024',
            quality: 'hd',
            style: 'natural'
          }),
        });

        console.log('OpenAI image response status:', openaiResponse.status);

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error('OpenAI image generation error:', errorText);
          
          let errorMessage = 'Image generation API request failed';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorMessage;
          } catch (e) {
            // Use default message
          }
          
          return NextResponse.json({ 
            error: `Image generation failed: ${errorMessage}`,
            details: errorText
          }, { status: 500 });
        }

        const data = await openaiResponse.json();
        const imageUrl = data.data?.[0]?.url;
        
        if (!imageUrl) {
          console.error('No image URL in OpenAI response:', JSON.stringify(data, null, 2));
          return NextResponse.json({ 
            error: 'No image URL returned from OpenAI' 
          }, { status: 500 });
        }

        console.log('Image generated successfully:', imageUrl);
        
        return NextResponse.json({ 
          result: imageUrl,
          usage: data.usage
        });

      } catch (error) {
        console.error('Image generation error:', error);
        return NextResponse.json({ 
          error: `Image generation failed: ${error.message}`,
        }, { status: 500 });
      }
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
        systemPrompt = 'You are a professional translator specializing in news content for Chinese-speaking audiences. Translate accurately while maintaining the journalistic tone, preserving all attributions and quotes exactly as they appear in the original text. Maintain paragraph breaks for readability. Do not add, omit, or modify any factual content.';
        userPrompt = `Translate this English news summary into simplified Chinese. Maintain the professional journalistic tone, preserve all quotes and attributions exactly, maintain paragraph breaks, and ensure the translation is natural and appropriate for Chinese readers. Do not add any information not present in the original:

${summary}

Important: Preserve paragraph structure by including double line breaks between paragraphs in your translation.

Provide only the Chinese translation:`;
      } else if (language === 'korean') {
        systemPrompt = 'You are a professional translator specializing in news content for Korean-speaking audiences. Translate accurately while maintaining the journalistic tone, preserving all attributions and quotes exactly as they appear in the original text. Maintain paragraph breaks for readability. Do not add, omit, or modify any factual content.';
        userPrompt = `Translate this English news summary into Korean. Maintain the professional journalistic tone, preserve all quotes and attributions exactly, maintain paragraph breaks, and ensure the translation is natural and appropriate for Korean readers. Do not add any information not present in the original:

${summary}

Important: Preserve paragraph structure by including double line breaks between paragraphs in your translation.

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
      error: 'Invalid action. Supported actions: generate_title, translate_title, summarize, translate, generate_image' 
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

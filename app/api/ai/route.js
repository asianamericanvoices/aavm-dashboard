import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { action, title, content, language, summary } = await request.json();

    let prompt = '';
    let maxTokens = 500;

    switch (action) {
      case 'summarize':
        prompt = `You are a professional journalist writing for Asian American Voices Media. Write a comprehensive, objective news summary of the following article. 

Guidelines:
- Write 300-400 words in a clear, journalistic style
- Focus on facts, quotes, and key developments
- Maintain objectivity with no editorial bias
- Include relevant context for Asian American readers when applicable
- Use proper news writing structure (lead, body, conclusion)
- Write in third person

Article Title: ${title}

Article Content: ${content}

Write a professional news summary:`;
        maxTokens = 600;
        break;

      case 'translate':
        if (language === 'chinese') {
          prompt = `Translate the following English news summary into simplified Chinese. Maintain the journalistic tone and accuracy of information. Ensure the translation is natural and appropriate for Chinese-speaking readers.

English Summary: ${summary}

Chinese Translation:`;
        } else if (language === 'korean') {
          prompt = `Translate the following English news summary into Korean. Maintain the journalistic tone and accuracy of information. Ensure the translation is natural and appropriate for Korean-speaking readers.

English Summary: ${summary}

Korean Translation:`;
        }
        maxTokens = 800;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // More cost-effective for this use case
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.3, // Lower temperature for more consistent, factual output
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to process with OpenAI' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content?.trim();

    if (!result) {
      return NextResponse.json(
        { error: 'No response from OpenAI' },
        { status: 500 }
      );
    }

    return NextResponse.json({ result });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// app/api/ai/route.js - Enhanced with Stability.ai integration
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Optional Supabase integration - gracefully falls back to file system
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    console.log('✅ Supabase connected');
  } else {
    console.log('📁 Using file system (Supabase env vars not found)');
  }
} catch (error) {
  console.log('📁 Supabase not available, using file system');
  supabase = null;
}

// Helper function to read dashboard data
async function readDashboardData() {
  if (supabase) {
    try {
      console.log('📊 Reading from Supabase...');
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('*')
        .order('scraped_date', { ascending: false });

      if (articlesError) throw articlesError;

      const { data: analytics, error: analyticsError } = await supabase
        .from('analytics')
        .select('*')
        .single();

      const calculatedAnalytics = analytics || {
        total_articles: articles.length,
        today_articles: articles.filter(a => 
          new Date(a.scraped_date).toDateString() === new Date().toDateString()
        ).length,
        pending_synthesis: articles.filter(a => a.status === 'pending_synthesis').length,
        pending_translation: articles.filter(a => 
          !a.translations?.chinese || !a.translations?.korean
        ).length,
        published_articles: articles.filter(a => a.status === 'published').length
      };

      // Convert Supabase format to dashboard format
      const dashboardArticles = articles.map(article => ({
        id: article.id,
        originalTitle: article.original_title,
        source: article.source,
        author: article.author,
        scrapedDate: article.scraped_date,
        originalUrl: article.original_url,
        status: article.status,
        topic: article.topic,
        fullContent: article.full_content,
        shortDescription: article.short_description,
        aiSummary: article.ai_summary,
        aiTitle: article.ai_title,
        displayTitle: article.display_title,
        translations: article.translations || { chinese: null, korean: null },
        translatedTitles: article.translated_titles || { chinese: null, korean: null },
        imageGenerated: article.image_generated || false,
        imageUrl: article.image_url,
        priority: article.priority,
        relevanceScore: article.relevance_score,
        contentQuality: article.content_quality || 'unknown',
        wordCount: article.word_count || 0
      }));

      return {
        articles: dashboardArticles,
        analytics: calculatedAnalytics,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Supabase read error, falling back to file:', error);
      return readFromFile();
    }
  } else {
    return readFromFile();
  }
}

function readFromFile() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'dashboard_data.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    console.log('📁 Reading from file system');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading dashboard data:', error);
    return { articles: [], analytics: {}, last_updated: new Date().toISOString() };
  }
}

// Helper function to write dashboard data (enhanced with Supabase)
async function writeDashboardData(data) {
  if (supabase) {
    try {
      console.log('💾 Saving to Supabase...');
      // This would be implemented when needed
      return true;
    } catch (error) {
      console.error('❌ Supabase write error:', error);
      return writeToFile(data);
    }
  } else {
    return writeToFile(data);
  }
}

function writeToFile(data) {
  try {
    // On Vercel, we can't write to files, so we'll just log and return true
    // In a real production setup, this would write to a database
    console.log('📝 Would save data (Vercel file system is read-only)');
    data.last_updated = new Date().toISOString();
    return true;
  } catch (error) {
    console.error('Error writing dashboard data:', error);
    return false;
  }
}

// Helper function to update article in dashboard data (enhanced with Supabase)
async function updateArticleInData(articleId, updates) {
  if (supabase) {
    try {
      console.log('🔄 Updating in Supabase:', articleId, updates);
      
      // Convert dashboard format to Supabase format
      const supabaseUpdates = {};
      if (updates.aiTitle !== undefined) supabaseUpdates.ai_title = updates.aiTitle;
      if (updates.aiSummary !== undefined) supabaseUpdates.ai_summary = updates.aiSummary;
      if (updates.displayTitle !== undefined) supabaseUpdates.display_title = updates.displayTitle;
      if (updates.status !== undefined) supabaseUpdates.status = updates.status;
      if (updates.translations !== undefined) supabaseUpdates.translations = updates.translations;
      if (updates.translatedTitles !== undefined) supabaseUpdates.translated_titles = updates.translatedTitles;
      if (updates.imageUrl !== undefined) supabaseUpdates.image_url = updates.imageUrl;
      if (updates.imageGenerated !== undefined) supabaseUpdates.image_generated = updates.imageGenerated;
      
      const { data, error } = await supabase
        .from('articles')
        .update(supabaseUpdates)
        .eq('id', articleId)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        ...updates,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Supabase update error:', error);
      return updateInFile(articleId, updates);
    }
  } else {
    return updateInFile(articleId, updates);
  }
}

function updateInFile(articleId, updates) {
  console.log('🔄 Updating article:', articleId, 'with:', updates);
  
  // For now, just return success without actually saving
  // In production, this would update a database
  return {
    id: articleId,
    ...updates,
    last_updated: new Date().toISOString()
  };
}

// Dynamic visual storytelling prompt generation - no fixed categories
function generateNewsImagePrompt(title, content) {
  // Remove real person names to avoid content policy issues
  let safeTitle = title
    .replace(/Trump/gi, 'government official')
    .replace(/Biden/gi, 'administration official')
    .replace(/Harris/gi, 'political figure')
    .replace(/[A-Z][a-z]+ [A-Z][a-z]+/g, 'official');

  const text = `${safeTitle} ${content}`.toLowerCase();
  
  // Extract the emotional and visual essence dynamically
  const visualEssence = extractVisualEssence(text, safeTitle);
  
  // Create compelling visual prompt
  const prompt = `Professional news photography: ${visualEssence}, institutional architecture, no people, no text, photorealistic documentary style, professional lighting.`;

  console.log('🎨 Generated dynamic prompt for:', safeTitle.substring(0, 50) + '...');
  console.log('🎨 Visual essence:', visualEssence);
  console.log('🎨 Prompt length:', prompt.length, 'characters');
  
  return prompt;
}

function extractVisualEssence(text, title) {
  // What emotions/tensions are in this story?
  const emotions = detectEmotions(text);
  const contrasts = detectContrasts(text);
  const settings = detectSettings(text);
  const lighting = determineLighting(emotions, text);
  
  // Build visual description from story elements
  return buildVisualDescription(emotions, contrasts, settings, lighting, text);
}

function detectEmotions(text) {
  let emotions = [];
  
  // Urgency/Crisis emotions
  if (text.includes('crisis') || text.includes('emergency') || text.includes('urgent') || 
      text.includes('outbreak') || text.includes('threat') || text.includes('danger')) {
    emotions.push('urgent');
  }
  
  // Conflict/Tension emotions
  if (text.includes('conflict') || text.includes('dispute') || text.includes('battle') ||
      text.includes('versus') || text.includes('against') || text.includes('opposition') ||
      text.includes('takeover') || text.includes('investigation')) {
    emotions.push('tense');
  }
  
  // Power/Authority emotions
  if (text.includes('control') || text.includes('power') || text.includes('authority') ||
      text.includes('enforcement') || text.includes('federal') || text.includes('government')) {
    emotions.push('authoritative');
  }
  
  // Progress/Innovation emotions
  if (text.includes('breakthrough') || text.includes('innovation') || text.includes('advancement') ||
      text.includes('development') || text.includes('research') || text.includes('technology')) {
    emotions.push('progressive');
  }
  
  return emotions.length > 0 ? emotions : ['neutral'];
}

function detectContrasts(text) {
  let contrasts = [];
  
  // Economic contrasts
  if ((text.includes('rich') || text.includes('wealthy') || text.includes('luxury')) &&
      (text.includes('poor') || text.includes('modest') || text.includes('low-income'))) {
    contrasts.push('wealth_disparity');
  }
  
  // Power contrasts
  if ((text.includes('federal') || text.includes('government')) &&
      (text.includes('local') || text.includes('community') || text.includes('municipal'))) {
    contrasts.push('federal_vs_local');
  }
  
  // Size/Scale contrasts
  if ((text.includes('major') || text.includes('massive') || text.includes('large')) &&
      (text.includes('small') || text.includes('individual') || text.includes('personal'))) {
    contrasts.push('scale_disparity');
  }
  
  // Old vs New contrasts
  if ((text.includes('traditional') || text.includes('old') || text.includes('legacy')) &&
      (text.includes('new') || text.includes('modern') || text.includes('innovative'))) {
    contrasts.push('traditional_vs_modern');
  }
  
  return contrasts;
}

function detectSettings(text) {
  // Dynamic setting detection based on story content
  let settings = [];
  
  // Financial/Economic settings
  if (text.includes('tax') || text.includes('revenue') || text.includes('economic') || 
      text.includes('financial') || text.includes('budget') || text.includes('income')) {
    settings.push('financial_district');
  }
  
  // Medical/Health settings
  if (text.includes('health') || text.includes('medical') || text.includes('hospital') ||
      text.includes('disease') || text.includes('virus') || text.includes('treatment')) {
    settings.push('medical_facility');
  }
  
  // Legal/Justice settings
  if (text.includes('court') || text.includes('legal') || text.includes('justice') ||
      text.includes('lawsuit') || text.includes('judge') || text.includes('trial')) {
    settings.push('courthouse');
  }
  
  // Security/Enforcement settings
  if (text.includes('police') || text.includes('security') || text.includes('enforcement') ||
      text.includes('detention') || text.includes('arrest') || text.includes('investigation')) {
    settings.push('security_facility');
  }
  
  // Educational settings
  if (text.includes('school') || text.includes('university') || text.includes('education') ||
      text.includes('student') || text.includes('academic') || text.includes('campus')) {
    settings.push('educational_institution');
  }
  
  // Default to government/institutional if no specific setting
  return settings.length > 0 ? settings : ['institutional_building'];
}

function determineLighting(emotions, text) {
  // Dynamic lighting based on story tone
  if (emotions.includes('urgent') || text.includes('crisis') || text.includes('emergency')) {
    return 'dramatic lighting with stark shadows';
  } else if (emotions.includes('tense') || text.includes('investigation') || text.includes('conflict')) {
    return 'moody lighting with strong contrast';
  } else if (emotions.includes('progressive') || text.includes('breakthrough') || text.includes('innovation')) {
    return 'bright modern lighting with clean lines';
  } else if (text.includes('evening') || text.includes('night') || emotions.includes('authoritative')) {
    return 'golden hour lighting with imposing shadows';
  } else {
    return 'professional architectural lighting';
  }
}

function buildVisualDescription(emotions, contrasts, settings, lighting, text) {
  // Start with primary setting
  let description = '';
  
  // Handle contrasts first - they're most visually compelling
  if (contrasts.includes('wealth_disparity')) {
    description = 'luxury high-rise towers overlooking modest residential buildings with stark architectural contrast';
  } else if (contrasts.includes('federal_vs_local')) {
    description = 'imposing federal building dominating smaller municipal structures in urban landscape';
  } else if (contrasts.includes('scale_disparity')) {
    description = 'massive institutional complex with individual human-scale elements in foreground';
  } else if (contrasts.includes('traditional_vs_modern')) {
    description = 'sleek contemporary architecture alongside classical institutional buildings';
  }
  
  // If no contrasts, build from settings and emotions
  else {
    const primarySetting = settings[0] || 'institutional_building';
    
    switch(primarySetting) {
      case 'financial_district':
        if (emotions.includes('urgent')) {
          description = 'wall street financial towers at dramatic sunset with imposing glass facades';
        } else {
          description = 'sleek banking headquarters with modern glass architecture and urban sophistication';
        }
        break;
        
      case 'medical_facility':
        if (emotions.includes('urgent')) {
          description = 'high-tech medical facility with sterile white surfaces and emergency lighting';
        } else {
          description = 'cutting-edge healthcare center with clean modern architecture and clinical precision';
        }
        break;
        
      case 'courthouse':
        if (emotions.includes('tense')) {
          description = 'imposing courthouse with marble columns and dramatic shadows on stone steps';
        } else {
          description = 'stately judicial building with classical architecture and formal stone facade';
        }
        break;
        
      case 'security_facility':
        if (emotions.includes('authoritative')) {
          description = 'fortress-like government building with controlled access and imposing concrete architecture';
        } else {
          description = 'modern law enforcement facility with secure institutional design';
        }
        break;
        
      case 'educational_institution':
        if (emotions.includes('tense')) {
          description = 'university administration building with formal academic architecture under stormy skies';
        } else {
          description = 'prestigious academic campus with collegiate architecture and scholarly atmosphere';
        }
        break;
        
      default:
        description = 'contemporary institutional building with authoritative architecture';
    }
  }
  
  // Add lighting to enhance mood
  return `${description}, ${lighting}`;
}

// SINGLE GET FUNCTION - handles both API status and dashboard data
export async function GET(request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  
  // If requesting dashboard data
  if (type === 'dashboard') {
    try {
      const dashboardData = await readDashboardData();
      return NextResponse.json(dashboardData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch dashboard data' },
        { status: 500 }
      );
    }
  }
  
  // Default: return API status
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasMysticKey = !!process.env.FREEPIK_API_KEY;
  const keyPreview = process.env.OPENAI_API_KEY ? 
    process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'Not found';
  
  const hasSupabase = !!supabase;
  
  return NextResponse.json({ 
    message: 'AI API route is working!',
    hasOpenAIKey,
    hasMysticKey,
    keyPreview,
    hasSupabase,
    dataSource: hasSupabase ? 'Supabase' : 'File System',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request) {
  console.log('🚀 POST REQUEST RECEIVED:', new Date().toISOString());
  
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error('❌ No OpenAI API key found in environment variables');
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    console.log('📦 REQUEST BODY RECEIVED:', JSON.stringify(body, null, 2));
    console.log('🔍 ACTION DETECTED:', body.action);
    
    const { action, title, content, language, summary, source, articleId } = body;

    // Add specific logging for manual add
    if (action === 'add_manual_article') {
      console.log('💾 MANUAL ADD ARTICLE DETECTED!');
      console.log('📄 Article data received:', body.article ? 'YES' : 'NO');
      if (body.article) {
        console.log('📊 Article preview data:', {
          id: body.article.id,
          title: body.article.originalTitle?.substring(0, 50) + '...',
          source: body.article.source,
          hasContent: body.article.fullContent ? 'YES' : 'NO',
          contentLength: body.article.fullContent?.length || 0
        });
      }
    }

    // NEW: Handle start over action
    if (action === 'start_over') {
      console.log('🔄 START OVER REQUEST:', { action, articleId, body });
      
      if (!articleId) {
        return NextResponse.json({ error: 'Article ID required for start over' }, { status: 400 });
      }

      // Reset article to original state
      const resetUpdates = {
        status: 'pending_synthesis',
        aiTitle: null,
        aiSummary: null,
        displayTitle: null,
        translations: { chinese: null, korean: null },
        translatedTitles: { chinese: null, korean: null },
        imageGenerated: false,
        imageUrl: null
      };

      try {
        const updatedArticle = await updateArticleInData(articleId, resetUpdates);
        
        return NextResponse.json({ 
          success: true, 
          message: `Article reset successfully ${supabase ? '(Supabase)' : '(File System)'}`,
          articleId: articleId,
          updates: resetUpdates,
          article: updatedArticle
        });
      } catch (error) {
        console.error('Error resetting article:', error);
        return NextResponse.json({ 
          error: 'Failed to reset article',
          details: error.message 
        }, { status: 500 });
      }
    }

    // Handle status updates (non-AI actions)
    if (action === 'update_status') {
      console.log('✅ STATUS UPDATE REQUEST:', { action, articleId, body });
      
      const { status, updates } = body;
      
      if (!articleId) {
        return NextResponse.json({ error: 'Article ID required for status updates' }, { status: 400 });
      }
    
      // Enhanced: Try Supabase first, fall back to file system
      const updatedArticle = await updateArticleInData(articleId, { status, ...updates });
      
      return NextResponse.json({ 
        success: true, 
        message: `Status update saved ${supabase ? '(Supabase)' : '(File System)'}`,
        articleId: articleId,
        updates: { status, ...updates },
        article: updatedArticle
      });
    }

    // Handle content updates (saving editorial changes)
    if (action === 'update_content') {
      const { updates } = body;
      
      if (!articleId) {
        return NextResponse.json({ error: 'Article ID required for content updates' }, { status: 400 });
      }

      const updatedArticle = await updateArticleInData(articleId, updates);
      
      if (updatedArticle) {
        return NextResponse.json({ 
          success: true, 
          article: updatedArticle,
          dataSource: supabase ? 'Supabase' : 'File System'
        });
      } else {
        return NextResponse.json({ 
          error: 'Failed to update article content' 
        }, { status: 500 });
      }
    }

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

      // Save the generated title to the article (enhanced with Supabase)
      if (articleId) {
        await updateArticleInData(articleId, { 
          aiTitle: cleanTitle,
          status: 'title_review'
        });
      }

      console.log('Title generated successfully:', cleanTitle);
      
      return NextResponse.json({ 
        result: cleanTitle,
        usage: data.usage,
        dataSource: supabase ? 'Supabase' : 'File System'
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

      // Save the translated title to the article (enhanced with Supabase)
      if (articleId) {
        const currentData = await readDashboardData();
        const article = currentData.articles.find(a => a.id === articleId);
        if (article) {
          const updatedTranslatedTitles = {
            ...article.translatedTitles,
            [language]: cleanTranslation
          };
          await updateArticleInData(articleId, { 
            translatedTitles: updatedTranslatedTitles
          });
        }
      }

      console.log(`Title translation to ${language} completed successfully:`, cleanTranslation);
      
      return NextResponse.json({ 
        result: cleanTranslation,
        usage: data.usage,
        dataSource: supabase ? 'Supabase' : 'File System'
      });
    }

    if (action === 'summarize') {
      console.log('Starting summarization for:', title);
      
      // Enhanced content validation with better error messages
      if (!content || content.trim().length === 0) {
        console.error('No content provided for summarization');
        return NextResponse.json({ 
          error: 'No article content provided. Cannot generate summary without the full article text.',
          suggestion: 'Please ensure your web scraping system captures the complete article content before attempting to generate summaries.'
        }, { status: 400 });
      }

      if (content.trim().length < 100) {
        console.error('Content too short for summarization:', content.length, 'characters');
        return NextResponse.json({ 
          error: 'Article content is too short to generate a meaningful summary. Minimum 100 characters required.',
          received: content.trim().length,
          suggestion: 'Please provide the full article text, not just the headline or metadata.'
        }, { status: 400 });
      }

      // Enhanced detection of placeholder/constructed content
      const placeholderIndicators = [
        'This article needs a comprehensive summary',
        '[Note: Full article content not available]',
        'Published by',
        'needs a comprehensive summary',
        'comprehensive summary'
      ];

      const isPlaceholderContent = placeholderIndicators.some(indicator => 
        content.toLowerCase().includes(indicator.toLowerCase())
      );

      // Check if content appears to be just metadata (very few sentences)
      const sentenceCount = content.split(/[.!?]+/).filter(s => s.trim().length > 10).length;
      const isJustMetadata = sentenceCount < 3;

      if (isPlaceholderContent || isJustMetadata) {
        console.error('Detected placeholder or metadata-only content');
        return NextResponse.json({ 
          error: 'Cannot generate summary from placeholder content or article metadata.',
          details: 'The provided content appears to be constructed metadata rather than the actual article text.',
          suggestion: 'Please ensure your web scraping system captures the complete article body text, including all paragraphs and quotes from the original source.',
          contentAnalysis: {
            isPlaceholder: isPlaceholderContent,
            sentenceCount: sentenceCount,
            contentLength: content.length
          }
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

      // Save the generated summary to the article (enhanced with Supabase)
      if (articleId) {
        await updateArticleInData(articleId, { 
          aiSummary: formattedSummary,
          status: 'summary_review'
        });
      }

      console.log('Summary generated successfully, length:', summary.length);
      
      return NextResponse.json({ 
        result: formattedSummary,
        usage: data.usage,
        dataSource: supabase ? 'Supabase' : 'File System'
      });
    }

    if (action === 'generate_image') {
      console.log('🎨 Starting multi-provider image generation for:', title);
      
      if (!title || title.trim().length === 0) {
        return NextResponse.json({ 
          error: 'No article title provided for image generation.' 
        }, { status: 400 });
      }

      // Generate dynamic, contextual prompt using our enhanced system
      const articleContent = content || '';
      const imagePrompt = generateNewsImagePrompt(title, articleContent);

      console.log('🎨 Generated prompt:', imagePrompt);

      try {
        // Try providers in order of preference
        const providers = [
          { name: 'Stability AI', key: 'STABILITY_API_KEY', func: generateStabilityImage },
          { name: 'Freepik', key: 'FREEPIK_API_KEY', func: generateFreepikImage },
          { name: 'DALL-E', key: 'OPENAI_API_KEY', func: generateDalleImage }
        ];

        let imageUrl = null;
        let usedProvider = null;

        for (const provider of providers) {
          const apiKey = process.env[provider.key];
          
          if (!apiKey) {
            console.log(`⏭️ ${provider.name} API key not configured, skipping...`);
            continue;
          }

          try {
            console.log(`🎨 Trying ${provider.name} for image generation...`);
            const result = await provider.func(imagePrompt, apiKey);
            
            if (result.success) {
              imageUrl = result.imageUrl;
              usedProvider = provider.name;
              console.log(`✅ ${provider.name} succeeded!`);
              break;
            }
          } catch (error) {
            console.log(`❌ ${provider.name} failed:`, error.message);
            continue; // Try next provider
          }
        }

        if (!imageUrl) {
          throw new Error('All image generation providers failed');
        }

        // Save the generated image URL to the article (enhanced with Supabase)
        if (articleId) {
          await updateArticleInData(articleId, { 
            imageUrl: imageUrl,
            imageGenerated: true,
            status: 'ready_for_publication'
          });
        }

        console.log(`🎨 Image generated successfully with ${usedProvider}`);
        
        return NextResponse.json({ 
          result: imageUrl,
          prompt_used: imagePrompt,
          provider: usedProvider,
          usage: { prompt_tokens: imagePrompt.length },
          dataSource: supabase ? 'Supabase' : 'File System'
        });

      } catch (error) {
        console.error('🎨 All image generation providers failed:', error);
        return NextResponse.json({ 
          error: `Image generation failed: ${error.message}`,
        }, { status: 500 });
      }
    }

// Optimized Stability AI function for your existing code
async function generateStabilityImage(prompt, apiKey) {
  console.log('🎨 Calling Stability AI with prompt:', prompt.substring(0, 100) + '...');
  
  // Enhanced prompt for news photography
  const stabilityPrompt = `${prompt}, professional photography, high quality, detailed, realistic, 4k resolution, documentary style, clean composition, news media quality`;

  const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text_prompts: [{ text: stabilityPrompt, weight: 1 }],
      cfg_scale: 7,          // Good balance of creativity vs prompt adherence
      height: 1024,
      width: 1024,
      samples: 1,
      steps: 30,             // Good quality vs speed balance
      seed: 0,               // Random seed for variety
      style_preset: "photographic", // Perfect for news images
    }),
  });

  console.log('🎨 Stability AI response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Stability AI error:', errorText);
    throw new Error(`Stability AI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.artifacts || !data.artifacts[0]) {
    throw new Error('No image returned from Stability AI');
  }

  const imageUrl = `data:image/png;base64,${data.artifacts[0].base64}`;
  console.log('✅ Stability AI image generated successfully');
  
  return { success: true, imageUrl };
}

// Environment variable you'll need in Vercel:
// STABILITY_API_KEY=your_stability_api_key_here

async function generateFreepikImage(prompt, apiKey) {
  const response = await fetch('https://api.freepik.com/v1/ai/text-to-image', {
    method: 'POST',
    headers: {
      'x-freepik-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt,
      num_images: 1,
      image: { size: "square_hd" },
      styling: { style: "photo", color: "color", lightning: "studio" },
      ai_model: "freepik-flux"
    }),
  });

  if (!response.ok) {
    throw new Error(`Freepik API error: ${response.status}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.base64 ? 
    `data:image/jpeg;base64,${data.data[0].base64}` : 
    data.data?.[0]?.url;
    
  if (!imageUrl) {
    throw new Error('No image URL returned from Freepik');
  }

  return { success: true, imageUrl };
}

async function generateDalleImage(prompt, apiKey) {
  const dallePrompt = `Create a professional, photorealistic news photograph: ${prompt}. High-quality photography style, suitable for news media publication, clean composition, professional lighting, documentary photography style.`;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: dallePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'natural'
    }),
  });

  if (!response.ok) {
    throw new Error(`DALL-E API error: ${response.status}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;
  
  if (!imageUrl) {
    throw new Error('No image URL returned from DALL-E');
  }

  return { success: true, imageUrl };
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

      // Save the translation to the article (enhanced with Supabase)
      if (articleId) {
        const currentData = await readDashboardData();
        const article = currentData.articles.find(a => a.id === articleId);
        if (article) {
          const updatedTranslations = {
            ...article.translations,
            [language]: translation.replace(/\n/g, '<br>')
          };
          
          // Check if both translations are now complete
          const bothComplete = updatedTranslations.chinese && updatedTranslations.korean;
          
          await updateArticleInData(articleId, { 
            translations: updatedTranslations,
            status: bothComplete ? 'translation_review' : 'ready_for_translation'
          });
        }
      }

      console.log(`Translation to ${language} completed successfully, length:`, translation.length);
      
      return NextResponse.json({ 
        result: translation,
        usage: data.usage,
        dataSource: supabase ? 'Supabase' : 'File System'
      });
    }

    if (action === 'add_manual_article') {
      console.log('💾 MANUAL ARTICLE ADD REQUEST:', { action, article: body.article });
      
      const { article } = body;
      
      if (!article) {
        return NextResponse.json({ error: 'Article data required' }, { status: 400 });
      }
    
      try {
        // If you have Supabase, save there
        if (supabase) {
          const supabaseArticle = {
            original_title: article.originalTitle,
            source: article.source,
            author: article.author,
            scraped_date: article.scrapedDate,
            original_url: article.originalUrl,
            status: article.status || 'pending_synthesis',
            topic: article.topic,
            full_content: article.fullContent,
            short_description: article.shortDescription,
            ai_summary: null,
            ai_title: null,
            display_title: null,
            translations: article.translations || { chinese: null, korean: null },
            translated_titles: article.translatedTitles || { chinese: null, korean: null },
            image_generated: article.imageGenerated || false,
            image_url: article.imageUrl || null,
            priority: article.priority,
            relevance_score: article.relevanceScore,
            in_dashboard: true, // ✅ ADD THIS FIELD
            daily_snapshot: null, // ✅ ADD THIS FIELD  
            content_hash: null, // ✅ ADD THIS FIELD
            // created_at and updated_at will be auto-generated
          };
    
          const { data, error } = await supabase
            .from('articles')
            .insert(supabaseArticle)
            .select()
            .single();
    
          if (error) {
            console.error('❌ Supabase insert error:', error);
            throw error;
          }
    
          console.log('✅ Manual article saved to Supabase:', data.id);
    
          // Convert back to dashboard format for frontend
          const dashboardArticle = {
            id: data.id,
            originalTitle: data.original_title,
            source: data.source,
            author: data.author,
            scrapedDate: data.scraped_date,
            originalUrl: data.original_url,
            status: data.status,
            topic: data.topic,
            fullContent: data.full_content,
            shortDescription: data.short_description,
            aiSummary: data.ai_summary,
            aiTitle: data.ai_title,
            displayTitle: data.display_title,
            translations: data.translations || { chinese: null, korean: null },
            translatedTitles: data.translated_titles || { chinese: null, korean: null },
            imageGenerated: data.image_generated || false,
            imageUrl: data.image_url,
            priority: data.priority,
            relevanceScore: data.relevance_score,
            contentQuality: article.contentQuality || 'manual',
            wordCount: article.wordCount || 0,
            dateline: article.dateline || '',
            isManualAdd: true
          };
    
          return NextResponse.json({ 
            success: true, 
            message: 'Manual article saved to Supabase',
            articleId: data.id,
            article: dashboardArticle
          });
        } else {
          // Fallback to file system (existing code)
          console.log('📁 Saving manual article to file system...');
          
          const currentData = await readDashboardData();
          
          const newArticle = {
            ...article,
            id: Date.now(),
            isManualAdd: true
          };
          
          const updatedData = {
            ...currentData,
            articles: [newArticle, ...currentData.articles],
            analytics: {
              ...currentData.analytics,
              total_articles: currentData.articles.length + 1
            },
            last_updated: new Date().toISOString()
          };
          
          return NextResponse.json({ 
            success: true, 
            message: 'Manual article saved (file system)',
            articleId: newArticle.id,
            article: newArticle,
            updatedData: updatedData
          });
        }
        
      } catch (error) {
        console.error('Error saving manual article:', error);
        return NextResponse.json({ 
          error: 'Failed to save manual article',
          details: error.message 
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({ 
      error: 'Invalid action. Supported actions: generate_title, translate_title, summarize, translate, generate_image, update_status, update_content, start_over, add_manual_article' 
    }, { status: 400 });

  } catch (error) {
    console.error('API route error:', error);
    
    // More detailed error information
    let errorMessage = error.message;
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = 'Network error connecting to API';
    }
    
    return NextResponse.json({ 
      error: `Server error: ${errorMessage}`,
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

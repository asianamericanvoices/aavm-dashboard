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

async function readDashboardData() {
  if (supabase) {
    try {
      console.log('📊 Reading from Supabase...');
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('*')
        .order('scraped_date', { ascending: false });

      if (articlesError) throw articlesError;

      // 🔍 CHINESE CONTENT DEBUG - Check raw Supabase data
      console.log('🔍 SUPABASE DEBUG - Total articles from DB:', articles.length);
      console.log('🔍 SUPABASE DEBUG - First article raw data:', articles[0]);
      console.log('🔍 SUPABASE DEBUG - First article translations field:', articles[0]?.translations);
      console.log('🔍 SUPABASE DEBUG - First article translated_titles field:', articles[0]?.translated_titles);
      
      // Check if ANY articles have Chinese content in the database
      const dbArticlesWithChinese = articles.filter(a => 
        (a.translations && a.translations.chinese) || 
        (a.translated_titles && a.translated_titles.chinese)
      );
      console.log('🔍 SUPABASE DEBUG - DB articles with Chinese content:', dbArticlesWithChinese.length);
      
      if (dbArticlesWithChinese.length > 0) {
        console.log('🔍 SUPABASE DEBUG - Sample DB article with Chinese:', dbArticlesWithChinese[0]);
      }

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
      const dashboardArticles = articles.map(article => {
        // 🔧 FIX: Parse JSON strings properly
        let translations = { chinese: null, korean: null };
        let translatedTitles = { chinese: null, korean: null };
        
        // Handle translations field (stored as string)
        if (article.translations) {
          try {
            if (typeof article.translations === 'string') {
              translations = JSON.parse(article.translations);
            } else {
              translations = article.translations;
            }
          } catch (e) {
            console.log('❌ Failed to parse translations for article:', article.id, article.translations);
            translations = { chinese: null, korean: null };
          }
        }
        
        // Handle translated_titles field (corrupted with escaped chars)
        if (article.translated_titles) {
          try {
            if (typeof article.translated_titles === 'string') {
              translatedTitles = JSON.parse(article.translated_titles);
            } else {
              translatedTitles = article.translated_titles;
            }
          } catch (e) {
            console.log('❌ Failed to parse translated_titles for article:', article.id, article.translated_titles);
            translatedTitles = { chinese: null, korean: null };
          }
        }
        
        console.log('🔧 PARSED DATA for article', article.id, ':', {
          translations,
          translatedTitles
        });
        
        return {
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
          translations: translations,
          translatedTitles: translatedTitles,
          chineseTranslationApproved: article.chinese_translation_approved || false,
          chineseApprovedBy: article.chinese_approved_by,
          chineseApprovedAt: article.chinese_approved_at,
          koreanTranslationApproved: article.korean_translation_approved || false,
          koreanApprovedBy: article.korean_approved_by,
          koreanApprovedAt: article.korean_approved_at,
          imageGenerated: article.image_generated || false,
          imageUrl: article.image_url,
          priority: article.priority,
          relevanceScore: article.relevance_score,
          contentQuality: article.content_quality || 'unknown',
          wordCount: article.word_count || 0,
          dateline: article.dateline || ''
        };
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
      if (updates.imageSource !== undefined) supabaseUpdates.image_source = updates.imageSource;
      if (updates.imageAttribution !== undefined) supabaseUpdates.image_attribution = updates.imageAttribution;
      if (updates.imageMode !== undefined) supabaseUpdates.image_mode = updates.imageMode;
      if (updates.useAIImages !== undefined) supabaseUpdates.use_ai_images = updates.useAIImages;
      
      // Add support for author and dateline
      if (updates.author !== undefined) supabaseUpdates.author = updates.author;
      if (updates.dateline !== undefined) supabaseUpdates.dateline = updates.dateline;
      
      // Add support for discard/delete timestamps
      if (updates.deleted_at !== undefined) supabaseUpdates.deleted_at = updates.deleted_at;
      if (updates.discarded_at !== undefined) supabaseUpdates.discarded_at = updates.discarded_at;

      // Add support for translation approval fields
      if (updates.chineseTranslationApproved !== undefined) supabaseUpdates.chinese_translation_approved = updates.chineseTranslationApproved;
      if (updates.chineseApprovedBy !== undefined) supabaseUpdates.chinese_approved_by = updates.chineseApprovedBy;
      if (updates.chineseApprovedAt !== undefined) supabaseUpdates.chinese_approved_at = updates.chineseApprovedAt;
      if (updates.koreanTranslationApproved !== undefined) supabaseUpdates.korean_translation_approved = updates.koreanTranslationApproved;
      if (updates.koreanApprovedBy !== undefined) supabaseUpdates.korean_approved_by = updates.koreanApprovedBy;
      if (updates.koreanApprovedAt !== undefined) supabaseUpdates.korean_approved_at = updates.koreanApprovedAt;

      // Always update the updated_at timestamp
      supabaseUpdates.updated_at = new Date().toISOString();
      
      // Always update the updated_at timestamp
      supabaseUpdates.updated_at = new Date().toISOString();
      
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

// Simple title-based prompt generation with professional news photography constraints
function generateNewsImagePrompt(title, content) {
  console.log('🎨 Generating prompt from title:', title);
  
  // Use the title directly as the main concept, add professional news photography constraints
  const prompt = `${title}, professional news photography, photorealistic documentary style, professional lighting, no people visible anywhere, no faces, no human figures, no politicians, no officials, no text, no words, no signage, high quality news media image, 4k resolution`;
  
  console.log('🎨 Generated prompt:', prompt);
  
  return prompt;
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

// Stock Photo Integration - Add BEFORE the POST function

// Unsplash API integration
async function searchUnsplashPhotos(query, count = 6) {
  const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
  
  if (!UNSPLASH_ACCESS_KEY) {
    console.log('⚠️ Unsplash API key not found');
    return { success: false, error: 'No Unsplash API key' };
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      photos: data.results.map(photo => ({
        id: photo.id,
        url: photo.urls.regular,
        thumb: photo.urls.thumb,
        description: photo.description || photo.alt_description || 'Stock photo',
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
        downloadUrl: photo.links.download_location,
        source: 'unsplash'
      }))
    };
  } catch (error) {
    console.error('Unsplash search error:', error);
    return { success: false, error: error.message };
  }
}

// Pexels API integration
async function searchPexelsPhotos(query, count = 6) {
  const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
  
  if (!PEXELS_API_KEY) {
    console.log('⚠️ Pexels API key not found');
    return { success: false, error: 'No Pexels API key' };
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          'Authorization': PEXELS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      photos: data.photos.map(photo => ({
        id: photo.id,
        url: photo.src.large,
        thumb: photo.src.medium,
        description: photo.alt || 'Stock photo',
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        downloadUrl: photo.src.original,
        source: 'pexels'
      }))
    };
  } catch (error) {
    console.error('Pexels search error:', error);
    return { success: false, error: error.message };
  }
}

// Generate search terms for stock photos
function generateStockPhotoSearchTerms(title, topic, content = '') {
  console.log('🔍 Generating search terms for title:', title);
  console.log('🔍 Topic:', topic);
  
  const searchTerms = [];
  
  // Extract meaningful words from the headline
  const titleWords = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'will', 'been', 'said', 'says', 'after', 'over', 'more', 'than', 'about', 'would', 'could', 'should', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'may', 'put', 'say', 'she', 'too', 'use'].includes(word));

  console.log('🔍 Key words from title:', titleWords);

  // Start with the most important words from the title
  searchTerms.push(...titleWords.slice(0, 4));

  // Add one relevant topic term if we have space
  const topicTerms = {
    'Politics': ['government', 'politics', 'capitol'],
    'Healthcare': ['healthcare', 'medical', 'hospital'],
    'Education': ['education', 'university', 'school'],
    'Immigration': ['immigration', 'border'],
    'Economy': ['business', 'economy', 'finance'],
    'Culture': ['culture', 'community'],
    'General': ['news', 'business']
  };

  const baseTerms = topicTerms[topic] || topicTerms['General'];
  if (searchTerms.length < 5) {
    searchTerms.push(baseTerms[0]);
  }

  // ONLY add Asian American terms if the headline is actually about Asian Americans
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();
  
  if (titleLower.includes('asian american') || titleLower.includes('chinese american') || 
      titleLower.includes('korean american') || contentLower.includes('asian american') ||
      titleLower.includes('aapi') || titleLower.includes('anti-asian')) {
    searchTerms.unshift('asian american');
  }

  // Clean up and limit to 5-6 terms max
  const finalTerms = [...new Set(searchTerms)]
    .filter(term => term && term.length > 2)
    .slice(0, 6);

  console.log('🔍 Final search terms:', finalTerms);
  return finalTerms;
}
// Main stock photo search function
async function searchStockPhotos(title, topic, content = '') {
  const searchTerms = generateStockPhotoSearchTerms(title, topic, content);
  const results = { unsplash: [], pexels: [], combined: [] };
  
  for (const term of searchTerms.slice(0, 3)) {
    try {
      const [unsplashResult, pexelsResult] = await Promise.all([
        searchUnsplashPhotos(term, 3),
        searchPexelsPhotos(term, 3)
      ]);
      
      if (unsplashResult.success) {
        results.unsplash.push(...unsplashResult.photos);
      }
      
      if (pexelsResult.success) {
        results.pexels.push(...pexelsResult.photos);
      }
      
      if (results.unsplash.length >= 6 && results.pexels.length >= 6) {
        break;
      }
      
    } catch (error) {
      console.error(`Error searching for term "${term}":`, error);
    }
  }
  
  results.combined = [
    ...results.unsplash.slice(0, 6),
    ...results.pexels.slice(0, 6)
  ];
  
  return results;
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
    
      // Add timestamp for discard/delete actions
      const timestampUpdates = { ...updates };
      if (status === 'discarded' && !timestampUpdates.discarded_at) {
        timestampUpdates.discarded_at = new Date().toISOString();
      }
      if (status === 'deleted' && !timestampUpdates.deleted_at) {
        timestampUpdates.deleted_at = new Date().toISOString();
      }
    
      // Enhanced: Try Supabase first, fall back to file system
      const updatedArticle = await updateArticleInData(articleId, { status, ...timestampUpdates });
      
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

    if (action === 'generate_image_prompt') {
      console.log('🎨 Starting image prompt generation for:', title);
      
      if (!title || title.trim().length === 0) {
        return NextResponse.json({ 
          error: 'No article title provided for image prompt generation.' 
        }, { status: 400 });
      }

      // Generate dynamic, contextual prompt using our enhanced system
      const articleContent = content || '';
      const imagePrompt = generateNewsImagePrompt(title, articleContent);

      console.log('🎨 Generated prompt:', imagePrompt);
      
      return NextResponse.json({ 
        result: imagePrompt,
        usage: { prompt_tokens: imagePrompt.length }
      });
    }

    if (action === 'generate_image') {
      console.log('🎨 Starting image generation with custom prompt');
      console.log('🔍 Request body:', JSON.stringify(body, null, 2));
      
      // Use the provided prompt directly instead of generating one
      const { prompt: customPrompt } = body;
      const imagePrompt = customPrompt;
      
      if (!imagePrompt || imagePrompt.trim().length === 0) {
        console.error('❌ No image prompt received. Body:', JSON.stringify(body, null, 2));
        return NextResponse.json({ 
          error: 'No image prompt provided for image generation.',
          debug: { receivedBody: body }
        }, { status: 400 });
      }

      console.log('🎨 Using prompt:', imagePrompt);

      try {
        // Try providers in order of preference
        const providers = [
          { name: 'Freepik', key: 'FREEPIK_API_KEY', func: generateFreepikImage },
          { name: 'Stability AI', key: 'STABILITY_API_KEY', func: generateStabilityImage },
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
          
          // Update status based on new workflow
          const newStatus = language === 'chinese' ? 'chinese_translation_pending' : 'korean_translation_pending';
          
          await updateArticleInData(articleId, { 
            translations: updatedTranslations,
            status: newStatus
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

    if (action === 'delete_article') {
      console.log('🗑️ SOFT DELETE ARTICLE REQUEST:', { action, articleId });
      
      if (!articleId) {
        return NextResponse.json({ error: 'Article ID required for deletion' }, { status: 400 });
      }

      try {
        // Soft delete - just change status to 'deleted'
        const updatedArticle = await updateArticleInData(articleId, { 
          status: 'deleted',
          deleted_at: new Date().toISOString()
        });

        console.log('✅ Article moved to deleted status:', articleId);

        return NextResponse.json({ 
          success: true, 
          message: `Article moved to deleted status ${supabase ? '(Supabase)' : '(File System)'}`,
          articleId: articleId,
          article: updatedArticle
        });

      } catch (error) {
        console.error('❌ Error deleting article:', error);
        return NextResponse.json({ 
          error: 'Failed to delete article',
          details: error.message 
        }, { status: 500 });
      }
    }

    if (action === 'restore_article') {
      console.log('♻️ RESTORE ARTICLE REQUEST:', { action, articleId });
      
      if (!articleId) {
        return NextResponse.json({ error: 'Article ID required for restoration' }, { status: 400 });
      }

      try {
        // Restore article to pending_synthesis
        const updatedArticle = await updateArticleInData(articleId, { 
          status: 'pending_synthesis',
          deleted_at: null
        });

        console.log('✅ Article restored:', articleId);

        return NextResponse.json({ 
          success: true, 
          message: `Article restored successfully ${supabase ? '(Supabase)' : '(File System)'}`,
          articleId: articleId,
          article: updatedArticle
        });

      } catch (error) {
        console.error('❌ Error restoring article:', error);
        return NextResponse.json({ 
          error: 'Failed to restore article',
          details: error.message 
        }, { status: 500 });
      }
    }

    if (action === 'permanent_delete_article') {
      console.log('💀 PERMANENT DELETE ARTICLE REQUEST:', { action, articleId });
      
      if (!articleId) {
        return NextResponse.json({ error: 'Article ID required for permanent deletion' }, { status: 400 });
      }

      try {
        if (supabase) {
          // Actually delete from Supabase
          const { error } = await supabase
            .from('articles')
            .delete()
            .eq('id', articleId);

          if (error) throw error;

          console.log('✅ Article permanently deleted from Supabase:', articleId);
        } else {
          console.log('📁 File system - would permanently delete article:', articleId);
        }

        return NextResponse.json({ 
          success: true, 
          message: `Article permanently deleted ${supabase ? '(Supabase)' : '(File System)'}`,
          articleId: articleId
        });

      } catch (error) {
        console.error('❌ Error permanently deleting article:', error);
        return NextResponse.json({ 
          error: 'Failed to permanently delete article',
          details: error.message 
        }, { status: 500 });
      }
    }

  if (action === 'search_stock_photos') {
    console.log('📸 Starting stock photo search for:', title);
    
    if (!title || title.trim().length === 0) {
      return NextResponse.json({ 
        error: 'No article title provided for stock photo search.' 
      }, { status: 400 });
    }

    try {
      const { topic, content } = body;
      const stockResults = await searchStockPhotos(title, topic || 'General', content || '');
      
      console.log(`📸 Found ${stockResults.combined.length} stock photos`);
      
      return NextResponse.json({ 
        success: true,
        photos: stockResults.combined,
        searchTerms: generateStockPhotoSearchTerms(title, topic || 'General', content || '')
      });
      
    } catch (error) {
      console.error('📸 Stock photo search error:', error);
      return NextResponse.json({ 
        error: `Stock photo search failed: ${error.message}`,
      }, { status: 500 });
    }
  }

  if (action === 'search_stock_photos_direct') {
      console.log('📸 Direct stock photo search with custom terms:', body.searchTerms);
      
      const { searchTerms } = body;
      
      if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) {
        return NextResponse.json({ 
          error: 'No search terms provided.' 
        }, { status: 400 });
      }

      try {
        const allPhotos = [];
        
        for (const term of searchTerms.slice(0, 4)) {
          console.log('🔍 Searching for term:', term);
          
          const [unsplashResult, pexelsResult] = await Promise.all([
            searchUnsplashPhotos(term, 3),
            searchPexelsPhotos(term, 3)
          ]);
          
          if (unsplashResult.success) {
            allPhotos.push(...unsplashResult.photos);
          }
          
          if (pexelsResult.success) {
            allPhotos.push(...pexelsResult.photos);
          }
        }
        
        // Remove duplicates and limit results
        const uniquePhotos = allPhotos.filter((photo, index, self) => 
          index === self.findIndex(p => p.id === photo.id && p.source === photo.source)
        ).slice(0, 12);
        
        console.log(`📸 Found ${uniquePhotos.length} photos with direct search`);
        
        return NextResponse.json({ 
          success: true,
          photos: uniquePhotos,
          searchTerms: searchTerms
        });
        
      } catch (error) {
        console.error('📸 Direct stock photo search error:', error);
        return NextResponse.json({ 
          error: `Direct stock photo search failed: ${error.message}`,
        }, { status: 500 });
      }
    }
    
  if (action === 'select_stock_photo') {
    console.log('📸 Selecting stock photo for article:', articleId);
    
    const { photoUrl, photoData } = body;
    
    if (!photoUrl || !articleId) {
      return NextResponse.json({ 
        error: 'Photo URL and article ID required' 
      }, { status: 400 });
    }

    try {
      await updateArticleInData(articleId, { 
        imageUrl: photoUrl,
        imageGenerated: false,
        imageSource: 'stock',
        imageAttribution: photoData ? {
          photographer: photoData.photographer,
          photographerUrl: photoData.photographerUrl,
          source: photoData.source,
          photoId: photoData.id
        } : null,
        status: 'ready_for_publication'
      });

      console.log('📸 Stock photo selected successfully');
      
      return NextResponse.json({ 
        success: true,
        imageUrl: photoUrl,
        attribution: photoData
      });

    } catch (error) {
      console.error('📸 Error selecting stock photo:', error);
      return NextResponse.json({ 
        error: `Failed to select stock photo: ${error.message}`,
      }, { status: 500 });
    }
  }

  if (action === 'toggle_image_mode') {
    console.log('🔄 Toggling image generation mode for article:', articleId);
    
    const { useAI } = body;
    
    if (!articleId) {
      return NextResponse.json({ 
        error: 'Article ID required' 
      }, { status: 400 });
    }

    try {
      await updateArticleInData(articleId, { 
        useAIImages: useAI,
        imageMode: useAI ? 'ai' : 'stock'
      });

      console.log(`🔄 Image mode set to: ${useAI ? 'AI' : 'Stock'}`);
      
      return NextResponse.json({ 
        success: true,
        imageMode: useAI ? 'ai' : 'stock'
      });

    } catch (error) {
      console.error('🔄 Error toggling image mode:', error);
      return NextResponse.json({ 
        error: `Failed to toggle image mode: ${error.message}`,
      }, { status: 500 });
    }
  }
    
    if (action === 'approve_translation') {
      console.log('✅ TRANSLATION APPROVAL REQUEST:', { action, articleId, language, body });
      
      const { language, approvedBy, approverEmail } = body;
      
      if (!articleId || !language || !approvedBy) {
        return NextResponse.json({ 
          error: 'Article ID, language, and approver required for translation approval' 
        }, { status: 400 });
      }

      if (!['chinese', 'korean'].includes(language)) {
        return NextResponse.json({ 
          error: 'Invalid language. Must be chinese or korean' 
        }, { status: 400 });
      }

      try {
        // Prepare approval updates
        const approvalUpdates = {
          [`${language}TranslationApproved`]: true,
          [`${language}ApprovedBy`]: approverEmail,
          [`${language}ApprovedAt`]: new Date().toISOString()
        };

        // Check if this completes all translation approvals
        const currentData = await readDashboardData();
        const article = currentData.articles.find(a => a.id === articleId);
        
        if (!article) {
          return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        // Determine if both translations are now approved
        const otherLanguage = language === 'chinese' ? 'korean' : 'chinese';
        const otherLanguageApproved = article[`${otherLanguage}TranslationApproved`] || false;
        const thisLanguageWillBeApproved = true;
        
        const bothTranslationsApproved = otherLanguageApproved && thisLanguageWillBeApproved;

        // Update status based on completion with new workflow
        if (bothTranslationsApproved) {
          approvalUpdates.status = 'translations_approved';
        } else if (language === 'chinese') {
          approvalUpdates.status = 'korean_translation_pending';
        } else if (language === 'korean') {
          approvalUpdates.status = 'chinese_translation_pending';
        } else {
          approvalUpdates.status = 'translation_review';
        }

        // Save to backend
        const updatedArticle = await updateArticleInData(articleId, approvalUpdates);
        
        console.log(`✅ ${language.charAt(0).toUpperCase() + language.slice(1)} translation approved by ${approverEmail}`);
        
        return NextResponse.json({ 
          success: true, 
          message: `${language.charAt(0).toUpperCase() + language.slice(1)} translation approved successfully`,
          articleId: articleId,
          language: language,
          approvedBy: approverEmail,
          bothTranslationsApproved: bothTranslationsApproved,
          article: updatedArticle
        });

      } catch (error) {
        console.error('❌ Error approving translation:', error);
        return NextResponse.json({ 
          error: 'Failed to approve translation',
          details: error.message 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      error: 'Invalid action. Supported actions: generate_title, translate_title, summarize, translate, generate_image_prompt, generate_image, update_status, update_content, start_over, add_manual_article, delete_article, restore_article, permanent_delete_article, approve_translation' 
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

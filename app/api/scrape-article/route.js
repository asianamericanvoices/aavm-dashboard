// app/api/scrape-article/route.js - Enhanced with Event Registry fallback
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('🌐 Scraping with AAVM logic for:', url);
   
    console.log('🔍 SCRAPER DEBUG: Starting scrape process...');
    console.log('🔍 SCRAPER DEBUG: Event Registry API Key available:', !!process.env.EVENT_REGISTRY_API_KEY);

    // STEP 1: Try direct scraping first
    const directResult = await tryDirectScraping(url);
    
    // STEP 2: If direct scraping fails or gets poor content, try Event Registry
    if (directResult.contentQuality === 'insufficient' || 
        directResult.contentQuality === 'failed' || 
        directResult.contentQuality === 'blocked' ||
        directResult.wordCount < 100) {
      
      console.log('🔄 Direct scraping failed/insufficient, trying Event Registry...');
      const eventRegistryResult = await tryEventRegistryScraping(url);
      
      if (eventRegistryResult.success && eventRegistryResult.wordCount > directResult.wordCount) {
        console.log('✅ Event Registry provided better content');
        return NextResponse.json(eventRegistryResult);
      }
    }
    
    // Return direct result if it was good enough or Event Registry failed
    return NextResponse.json(directResult);

  } catch (error) {
    console.error('❌ Scraping error:', error);
    return NextResponse.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
}

// Your existing direct scraping logic
async function tryDirectScraping(url) {
  try {
    const fetchFullArticleContent = async (url, title) => {
      try {
        console.log('🔍 SCRAPER DEBUG: Starting fetch for:', url);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          timeout: 15000,
          redirect: 'follow'
        });
    
        // ✅ DEBUG LOGGING ADDED HERE
        console.log('🔍 SCRAPER DEBUG: Response status:', response.status);
        console.log('🔍 SCRAPER DEBUG: Response ok:', response.ok);
        
        if (!response.ok) {
          console.log('🔍 SCRAPER DEBUG: Response not ok, status:', response.status);
          if (response.status === 403 || response.status === 401) {
            console.log('🔍 SCRAPER DEBUG: Blocked by server');
            return { content: "", quality: "blocked", wordCount: 0 };
          }
          throw new Error(`HTTP ${response.status}`);
        }
        
        let text = await response.text();
        console.log('🔍 SCRAPER DEBUG: Raw HTML length:', text.length);
        console.log('🔍 SCRAPER DEBUG: HTML preview:', text.substring(0, 500));
        
        // Check for paywall indicators
        const paywallIndicators = [
          'subscribe to continue reading',
          'this content is for subscribers',
          'paywall',
          'premium content',
          'unlock this article',
          'become a member',
          'sign up to read'
        ];
        
        const hasPaywall = paywallIndicators.some(indicator => 
          text.toLowerCase().includes(indicator)
        );
        
        if (hasPaywall) {
          console.log('🚫 Paywall detected');
          return { content: "", quality: "blocked", wordCount: 0 };
        }
        
        // Your existing HTML cleaning logic
        text = text.replace(/<script[^>]*>.*?<\/script>/gis, '');
        text = text.replace(/<style[^>]*>.*?<\/style>/gis, '');
        text = text.replace(/<nav[^>]*>.*?<\/nav>/gis, '');
        text = text.replace(/<header[^>]*>.*?<\/header>/gis, '');
        text = text.replace(/<footer[^>]*>.*?<\/footer>/gis, '');
        text = text.replace(/<aside[^>]*>.*?<\/aside>/gis, '');
        text = text.replace(/<noscript[^>]*>.*?<\/noscript>/gis, '');
        text = text.replace(/<form[^>]*>.*?<\/form>/gis, '');
        text = text.replace(/<!--.*?-->/gis, '');
        
        // Try to extract article content more intelligently
        const articleSelectors = [
          'article',
          '[role="article"]',
          '.article-content',
          '.post-content',
          '.entry-content',
          '.content',
          'main',
          '.story-body',
          '.article-body'
        ];
        
        let articleContent = '';
        for (const selector of articleSelectors) {
          const regex = new RegExp(`<${selector}[^>]*>(.*?)<\/${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>`, 'gis');
          const match = text.match(regex);
          if (match && match[1] && match[1].length > articleContent.length) {
            articleContent = match[1];
          }
        }
        
        if (articleContent.length > 500) {
          text = articleContent;
        }
        
        // Remove all HTML tags and clean up
        text = text.replace(/<[^>]+>/g, ' ');
        text = text.replace(/&nbsp;/g, ' ')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/\s+/g, ' ')
                  .trim();
        
        // Your existing sentence filtering logic
        const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
        const titleWords = new Set(title.toLowerCase().split(/\s+/).filter(word => word.length > 2));
        const relevantSentences = [];
        
        for (const sentence of sentences) {
          if (sentence.length > 50) {
            let relevanceScore = 0;
            
            const titleOverlap = [...titleWords].filter(word => 
              sentence.toLowerCase().includes(word)
            ).length;
            relevanceScore += titleOverlap * 2;
            
            if (sentence.length > 100) relevanceScore += 1;
            if (sentence.length > 200) relevanceScore += 1;
            
            if (/\b(said|according|reported|stated|announced|revealed|confirmed|disclosed)\b/i.test(sentence)) {
              relevanceScore += 2;
            }
            
            if (/"[^"]*"/g.test(sentence)) {
              relevanceScore += 1;
            }
            
            if (/\b(today|yesterday|this week|last month|on \w+day)\b/i.test(sentence)) {
              relevanceScore += 1;
            }
            
            const isUIText = /\b(click here|read more|subscribe|newsletter|follow us|share this|comments|advertisement)\b/i.test(sentence);
            
            if (relevanceScore >= 2 && !isUIText) {
              relevantSentences.push({ sentence, score: relevanceScore });
            }
          }
        }
        
        relevantSentences.sort((a, b) => b.score - a.score);
        const bestSentences = relevantSentences.slice(0, 40).map(item => item.sentence);
        
        const fullContent = bestSentences.join('. ') + (bestSentences.length > 0 ? '.' : '');
        const wordCount = fullContent.split(/\s+/).filter(word => word.length > 0).length;
        
        let quality;
        if (wordCount >= 400) quality = "excellent";
        else if (wordCount >= 250) quality = "good";
        else if (wordCount >= 150) quality = "medium";
        else if (wordCount >= 75) quality = "poor";
        else quality = "insufficient";
        
        return { content: fullContent, quality, wordCount };
        
      } catch (error) {
        console.log('Direct content fetch failed:', error.message);
        
        if (error.message.includes('timeout')) {
          return { content: "", quality: "timeout", wordCount: 0 };
        }
        if (error.message.includes('403') || error.message.includes('401')) {
          return { content: "", quality: "blocked", wordCount: 0 };
        }
        
        return { content: "", quality: "failed", wordCount: 0 };
      }
    };

    // Extract metadata
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    
    const html = await response.text();
    
    // Extract title
    let title = '';
    const titleMatches = [
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i),
      html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i),
      html.match(/<title[^>]*>([^<]+)<\/title>/i)
    ];
    
    for (const match of titleMatches) {
      if (match && match[1] && match[1].trim()) {
        title = match[1].replace(/&[^;]+;/g, '').trim();
        break;
      }
    }
    
    if (!title) {
      title = `Article from ${new URL(url).hostname}`;
    }
    
    // Extract description
    let description = '';
    const descMatches = [
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i),
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i),
      html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i)
    ];
    
    for (const match of descMatches) {
      if (match && match[1] && match[1].trim()) {
        description = match[1].replace(/&[^;]+;/g, '').trim();
        break;
      }
    }

    // Extract author
    let author = 'N/A';
    const authorMatches = [
      html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i),
      html.match(/<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i),
      html.match(/[Bb]y\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/),
      html.match(/<span[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/span>/i)
    ];
    
    for (const match of authorMatches) {
      if (match && match[1] && match[1].trim()) {
        author = match[1].trim();
        break;
      }
    }

    // Fetch content
    const contentData = await fetchFullArticleContent(url, title);
    
    // Your existing scoring functions
    const relevanceScore = calculateRelevanceScore(title, description);
    const topic = classifyTopic(title, description);
    const priority = determinePriority(relevanceScore, 24);
    
    const hostname = new URL(url).hostname.replace('www.', '');
    
    console.log('📊 Direct scraping result:', {
      titleLength: title.length,
      contentLength: contentData.content.length,
      quality: contentData.quality,
      wordCount: contentData.wordCount,
      relevanceScore,
      priority
    });

    return {
      title,
      author,
      content: contentData.content,
      description: description || 'No description available',
      source: hostname.charAt(0).toUpperCase() + hostname.slice(1),
      dateline: '',
      relevanceScore: Math.round(relevanceScore * 10) / 10,
      priority,
      topic,
      contentQuality: contentData.quality,
      wordCount: contentData.wordCount,
      success: true
    };

  } catch (error) {
    console.error('Direct scraping failed:', error);
    return {
      title: `Article from ${new URL(url).hostname}`,
      author: 'N/A',
      content: '',
      description: 'Direct scraping failed',
      source: new URL(url).hostname.replace('www.', ''),
      dateline: '',
      relevanceScore: 5.0,
      priority: 'medium',
      topic: 'General',
      contentQuality: 'failed',
      wordCount: 0,
      success: false
    };
  }
}

// NEW: Event Registry fallback
async function tryEventRegistryScraping(url) {
  try {
    // Check if Event Registry API key is available
    const EVENT_REGISTRY_API_KEY = process.env.EVENT_REGISTRY_API_KEY;
    
    if (!EVENT_REGISTRY_API_KEY) {
      console.log('⚠️ Event Registry API key not found, skipping fallback');
      return { success: false };
    }

    console.log('🔄 Trying Event Registry for:', url);
    
    // Event Registry article extraction API
    const eventRegistryResponse = await fetch('http://eventregistry.org/api/v1/article/getArticle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: EVENT_REGISTRY_API_KEY,
        articleUri: url,
        resultType: 'info',
        includeArticleTitle: true,
        includeArticleBody: true,
        includeArticleBasicInfo: true,
        includeArticleImage: true,
        includeArticleLinks: true,
        includeArticleSocialScore: true,
        includeSourceTitle: true,
        includeSourceDescription: true,
        includeConceptLabel: true,
        includeConceptImage: true,
        includeConceptSynonyms: true,
        includeLocationGeoLocation: true,
        includeStoryTitle: true,
        includeStoryBasicStats: true,
        includeEventTitle: true,
        includeEventBasicStats: true
      }),
    });

    if (!eventRegistryResponse.ok) {
      throw new Error(`Event Registry API error: ${eventRegistryResponse.status}`);
    }

    const eventData = await eventRegistryResponse.json();
    
    if (!eventData || !eventData.info || !eventData.info.body) {
      throw new Error('No content returned from Event Registry');
    }

    const article = eventData.info;
    
    // Clean up the content
    let content = article.body || '';
    content = content.replace(/<[^>]+>/g, ' '); // Remove HTML tags
    content = content.replace(/\s+/g, ' ').trim(); // Clean whitespace
    
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    
    let quality;
    if (wordCount >= 400) quality = "excellent";
    else if (wordCount >= 250) quality = "good";
    else if (wordCount >= 150) quality = "medium";
    else if (wordCount >= 75) quality = "poor";
    else quality = "insufficient";

    const title = article.title || `Article from ${new URL(url).hostname}`;
    const description = article.body ? article.body.substring(0, 200) + '...' : 'No description available';
    
    // Use your existing scoring
    const relevanceScore = calculateRelevanceScore(title, description);
    const topic = classifyTopic(title, description);
    const priority = determinePriority(relevanceScore, 24);
    
    const hostname = new URL(url).hostname.replace('www.', '');
    
    console.log('✅ Event Registry result:', {
      titleLength: title.length,
      contentLength: content.length,
      quality: quality,
      wordCount: wordCount,
      relevanceScore,
      priority
    });

    return {
      title,
      author: article.authors?.[0]?.name || 'N/A',
      content,
      description,
      source: article.source?.title || hostname.charAt(0).toUpperCase() + hostname.slice(1),
      dateline: '',
      relevanceScore: Math.round(relevanceScore * 10) / 10,
      priority,
      topic,
      contentQuality: quality,
      wordCount,
      success: true
    };

  } catch (error) {
    console.error('Event Registry failed:', error);
    return { success: false };
  }
}

// Your existing helper functions
const calculateRelevanceScore = (title, description = "") => {
  const text = `${title} ${description}`.toLowerCase();
  let score = 2.0;
  
  const aaKeywords = [
    "asian american", "chinese american", "korean american", "vietnamese american",
    "filipino american", "japanese american", "south asian", "southeast asian",
    "immigration", "medicare", "healthcare", "education", "voting", "election",
    "hate crime", "discrimination", "civil rights", "community center",
    "small business", "chinatown", "koreatown", "language access", "translation",
    "diaspora", "green card", "naturalization", "intergenerational",
    "model minority", "bamboo ceiling", "affirmative action"
  ];
  
  for (const keyword of aaKeywords) {
    if (text.includes(keyword)) {
      if (keyword.includes("asian american")) {
        score += 4.0;
      } else {
        score += 2.0;
      }
    }
  }
  
  const highRelevance = ["immigration", "healthcare", "education", "voting", "discrimination", "policy"];
  const mediumRelevance = ["economy", "business", "community", "cultural", "federal", "government"];
  
  for (const topic of highRelevance) {
    if (text.includes(topic)) score += 1.5;
  }
  
  for (const topic of mediumRelevance) {
    if (text.includes(topic)) score += 0.8;
  }
  
  const locations = ["california", "new york", "texas", "georgia", "virginia", "washington", "hawaii"];
  for (const location of locations) {
    if (text.includes(location)) score += 0.3;
  }
  
  score += 1.0;
  return Math.min(score, 10.0);
};

const classifyTopic = (title, description = "") => {
  const text = `${title} ${description}`.toLowerCase();
  
  if (/health|medicare|insurance|hospital|medical/.test(text)) return "Healthcare";
  if (/economy|job|employment|business|market|trade/.test(text)) return "Economy";
  if (/election|voting|politics|government|policy/.test(text)) return "Politics";
  if (/school|education|student|university|college/.test(text)) return "Education";
  if (/immigration|visa|citizen|border/.test(text)) return "Immigration";
  if (/culture|festival|community|celebration|tradition/.test(text)) return "Culture";
  return "General";
};

const determinePriority = (relevanceScore, publishedHoursAgo) => {
  if (relevanceScore >= 6.0 && publishedHoursAgo <= 24) return "high";
  if (relevanceScore >= 4.0 && publishedHoursAgo <= 48) return "medium";
  return "low";
};

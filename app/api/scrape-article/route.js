// app/api/scrape-article/route.js - ENHANCED VERSION with 403 bypass
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('🌐 Enhanced scraping for:', url);
    
    // STEP 1: Try multiple scraping strategies
    const strategies = [
      () => tryAdvancedScraping(url),
      () => tryBasicScraping(url),
      () => tryEventRegistryScraping(url)
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result.success && result.wordCount > 50) {
          console.log('✅ Strategy succeeded with', result.wordCount, 'words');
          return NextResponse.json(result);
        }
      } catch (error) {
        console.log('Strategy failed, trying next...', error.message);
        continue;
      }
    }

    // Return best attempt even if poor quality
    const fallbackResult = await tryBasicScraping(url);
    return NextResponse.json(fallbackResult);

  } catch (error) {
    console.error('❌ All scraping strategies failed:', error);
    return NextResponse.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
}

// STRATEGY 1: Advanced scraping with sophisticated anti-bot measures
async function tryAdvancedScraping(url) {
  try {
    console.log('🚀 Trying advanced scraping strategy...');
    
    // Generate random realistic headers
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];

    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const isChrome = randomUserAgent.includes('Chrome');
    const isFirefox = randomUserAgent.includes('Firefox');

    // Build comprehensive headers that match the user agent
    const headers = {
      'User-Agent': randomUserAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };

    // Add browser-specific headers
    if (isChrome) {
      headers['sec-ch-ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
      headers['sec-ch-ua-mobile'] = '?0';
      headers['sec-ch-ua-platform'] = '"Windows"';
    }

    // Add referer to look more natural
    try {
      const urlObj = new URL(url);
      headers['Referer'] = `https://www.google.com/`;
    } catch (e) {
      // If URL parsing fails, skip referer
    }

    console.log('📡 Making request with advanced headers...');

    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      redirect: 'follow',
      // Add a realistic timeout
      signal: AbortSignal.timeout(15000)
    });

    console.log('📊 Response status:', response.status);

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('403_BLOCKED');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('📄 HTML received, length:', html.length);

    return await processHTML(html, url);

  } catch (error) {
    console.error('Advanced scraping failed:', error.message);
    throw error;
  }
}

// STRATEGY 2: Basic scraping (your existing logic, slightly improved)
async function tryBasicScraping(url) {
  try {
    console.log('🔧 Trying basic scraping strategy...');

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
      timeout: 10000,
      redirect: 'follow'
    });

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        throw new Error('BLOCKED');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return await processHTML(html, url);

  } catch (error) {
    console.error('Basic scraping failed:', error.message);
    throw error;
  }
}

// STRATEGY 3: Event Registry fallback (enhanced from your existing code)
async function tryEventRegistryScraping(url) {
  try {
    const EVENT_REGISTRY_API_KEY = process.env.EVENT_REGISTRY_API_KEY;
    
    if (!EVENT_REGISTRY_API_KEY) {
      throw new Error('No Event Registry API key');
    }

    console.log('🔄 Trying Event Registry fallback...');
    
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
      }),
    });

    if (!eventRegistryResponse.ok) {
      throw new Error(`Event Registry error: ${eventRegistryResponse.status}`);
    }

    const eventData = await eventRegistryResponse.json();
    
    if (!eventData?.info?.body) {
      throw new Error('No content from Event Registry');
    }

    const article = eventData.info;
    const content = article.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    
    let quality = 'insufficient';
    if (wordCount >= 400) quality = "excellent";
    else if (wordCount >= 250) quality = "good";  
    else if (wordCount >= 150) quality = "medium";
    else if (wordCount >= 75) quality = "poor";

    const title = article.title || `Article from ${new URL(url).hostname}`;
    const description = content.length > 200 ? content.substring(0, 200) + '...' : content;
    
    const relevanceScore = calculateRelevanceScore(title, description);
    const topic = classifyTopic(title, description);
    const priority = determinePriority(relevanceScore, 24);
    
    const hostname = new URL(url).hostname.replace('www.', '');

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
    console.error('Event Registry failed:', error.message);
    throw error;
  }
}

// Enhanced HTML processing function
async function processHTML(html, url) {
  try {
    // Check for paywall/blocking indicators
    const paywallIndicators = [
      'subscribe to continue reading',
      'this content is for subscribers',
      'paywall', 'premium content',
      'unlock this article',
      'become a member',
      'sign up to read',
      'access denied',
      'blocked'
    ];
    
    const htmlLower = html.toLowerCase();
    const hasPaywall = paywallIndicators.some(indicator => htmlLower.includes(indicator));
    
    if (hasPaywall) {
      console.log('🚫 Paywall detected');
      throw new Error('PAYWALL_DETECTED');
    }

    // Extract metadata
    const title = extractTitle(html, url);
    const description = extractDescription(html);
    const author = extractAuthor(html);
    
    // Enhanced content extraction
    const content = extractMainContent(html, title);
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    
    let quality = 'insufficient';
    if (wordCount >= 400) quality = "excellent";
    else if (wordCount >= 250) quality = "good";
    else if (wordCount >= 150) quality = "medium";
    else if (wordCount >= 75) quality = "poor";

    const relevanceScore = calculateRelevanceScore(title, description);
    const topic = classifyTopic(title, description);
    const priority = determinePriority(relevanceScore, 24);
    const hostname = new URL(url).hostname.replace('www.', '');

    console.log('✅ Content extracted:', {
      titleLength: title.length,
      contentLength: content.length,
      wordCount,
      quality
    });

    return {
      title,
      author,
      content,
      description: description || 'No description available',
      source: hostname.charAt(0).toUpperCase() + hostname.slice(1),
      dateline: '',
      relevanceScore: Math.round(relevanceScore * 10) / 10,
      priority,
      topic,
      contentQuality: quality,
      wordCount,
      success: true
    };

  } catch (error) {
    console.error('HTML processing failed:', error.message);
    throw error;
  }
}

// Improved content extraction
function extractMainContent(html, title) {
  // Remove unwanted elements
  let cleanHtml = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
  cleanHtml = cleanHtml.replace(/<style[^>]*>.*?<\/style>/gis, '');
  cleanHtml = cleanHtml.replace(/<nav[^>]*>.*?<\/nav>/gis, '');
  cleanHtml = cleanHtml.replace(/<header[^>]*>.*?<\/header>/gis, '');
  cleanHtml = cleanHtml.replace(/<footer[^>]*>.*?<\/footer>/gis, '');
  cleanHtml = cleanHtml.replace(/<aside[^>]*>.*?<\/aside>/gis, '');
  cleanHtml = cleanHtml.replace(/<noscript[^>]*>.*?<\/noscript>/gis, '');
  cleanHtml = cleanHtml.replace(/<form[^>]*>.*?<\/form>/gis, '');
  cleanHtml = cleanHtml.replace(/<!--.*?-->/gis, '');

  // Try to find main article content with better selectors
  const articleSelectors = [
    'article', '[role="article"]', '.article-content', '.post-content',
    '.entry-content', '.content', 'main', '.story-body', '.article-body',
    '.post-body', '.entry', '.single-post', '.blog-post', '[id*="content"]',
    '[class*="story"]', '[class*="article"]', '[class*="post-content"]'
  ];
  
  let bestContent = '';
  for (const selector of articleSelectors) {
    const regex = new RegExp(`<[^>]*(?:class|id)=[^>]*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>(.*?)<\/[^>]*>`, 'gis');
    const match = cleanHtml.match(regex);
    if (match && match[1] && match[1].length > bestContent.length) {
      bestContent = match[1];
    }
  }
  
  if (bestContent.length > 500) {
    cleanHtml = bestContent;
  }

  // Clean up text
  let text = cleanHtml.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();

  // Smart sentence filtering
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30);
  const titleWords = new Set(title.toLowerCase().split(/\s+/).filter(word => word.length > 2));
  const relevantSentences = [];
  
  for (const sentence of sentences) {
    if (sentence.length > 50) {
      let relevanceScore = 0;
      
      // Title word overlap
      const titleOverlap = [...titleWords].filter(word => 
        sentence.toLowerCase().includes(word)
      ).length;
      relevanceScore += titleOverlap * 2;
      
      // Length bonuses
      if (sentence.length > 100) relevanceScore += 1;
      if (sentence.length > 200) relevanceScore += 1;
      
      // Quote indicators
      if (/\b(said|according|reported|stated|announced|revealed|confirmed|disclosed)\b/i.test(sentence)) {
        relevanceScore += 2;
      }
      
      // Direct quotes
      if (/"[^"]*"/g.test(sentence)) {
        relevanceScore += 1;
      }
      
      // Time indicators
      if (/\b(today|yesterday|this week|last month|on \w+day)\b/i.test(sentence)) {
        relevanceScore += 1;
      }
      
      // Filter out UI text
      const isUIText = /\b(click here|read more|subscribe|newsletter|follow us|share this|comments|advertisement|cookie|privacy policy)\b/i.test(sentence);
      
      if (relevanceScore >= 2 && !isUIText && sentence.length < 1000) {
        relevantSentences.push({ sentence, score: relevanceScore });
      }
    }
  }
  
  // Sort by relevance and take the best
  relevantSentences.sort((a, b) => b.score - a.score);
  const bestSentences = relevantSentences.slice(0, 50).map(item => item.sentence);
  
  return bestSentences.join('. ') + (bestSentences.length > 0 ? '.' : '');
}

// Improved title extraction
function extractTitle(html, url) {
  const titleMatches = [
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i),
    html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i),
    html.match(/<title[^>]*>([^<]+)<\/title>/i),
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  ];
  
  for (const match of titleMatches) {
    if (match && match[1] && match[1].trim()) {
      let title = match[1].replace(/&[^;]+;/g, '').trim();
      // Remove common suffixes
      title = title.replace(/\s*[-|]\s*(.*?)$/i, '');
      if (title.length > 10) return title;
    }
  }
  
  return `Article from ${new URL(url).hostname}`;
}

// Improved description extraction  
function extractDescription(html) {
  const descMatches = [
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i),
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i),
    html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i)
  ];
  
  for (const match of descMatches) {
    if (match && match[1] && match[1].trim()) {
      return match[1].replace(/&[^;]+;/g, '').trim();
    }
  }
  
  return '';
}

// Improved author extraction
function extractAuthor(html) {
  const authorMatches = [
    html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i),
    html.match(/<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i),
    html.match(/[Bb]y\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/),
    html.match(/<span[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/span>/i),
    html.match(/<div[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/div>/i)
  ];
  
  for (const match of authorMatches) {
    if (match && match[1] && match[1].trim()) {
      let author = match[1].trim();
      // Clean up common prefixes/suffixes
      author = author.replace(/^(by\s+|author:\s*)/i, '');
      if (author.length > 2 && author.length < 100) {
        return author;
      }
    }
  }
  
  return 'N/A';
}

// Your existing helper functions (keep these the same)
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

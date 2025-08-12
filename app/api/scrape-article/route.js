// Enhanced app/api/scrape-article/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('🌐 Scraping with AAVM logic for:', url);

    // ENHANCED: More sophisticated content fetching
    const fetchFullArticleContent = async (url, title) => {
      try {
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
          timeout: 20000, // Increased timeout
          redirect: 'follow'
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        let text = await response.text();
        
        // ENHANCED: More comprehensive HTML cleaning
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
          const regex = new RegExp(`<${selector}[^>]*>(.*?)<\/${selector}>`, 'gis');
          const match = text.match(regex);
          if (match && match[1] && match[1].length > articleContent.length) {
            articleContent = match[1];
          }
        }
        
        // If we found article content, use that, otherwise use full text
        if (articleContent.length > 500) {
          text = articleContent;
        }
        
        // Remove all HTML tags
        text = text.replace(/<[^>]+>/g, ' ');
        
        // Clean up whitespace and decode HTML entities
        text = text.replace(/&nbsp;/g, ' ')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/\s+/g, ' ')
                  .trim();
        
        // ENHANCED: Better sentence filtering
        const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
        const titleWords = new Set(title.toLowerCase().split(/\s+/).filter(word => word.length > 2));
        const relevantSentences = [];
        
        for (const sentence of sentences) {
          if (sentence.length > 50) {
            const sentenceWords = new Set(sentence.toLowerCase().split(/\s+/));
            
            // Enhanced relevance scoring
            let relevanceScore = 0;
            
            // Title word overlap
            const titleOverlap = [...titleWords].filter(word => 
              sentence.toLowerCase().includes(word)
            ).length;
            relevanceScore += titleOverlap * 2;
            
            // Length bonus for substantial sentences
            if (sentence.length > 100) relevanceScore += 1;
            if (sentence.length > 200) relevanceScore += 1;
            
            // Journalism indicators
            if (/\b(said|according|reported|stated|announced|revealed|confirmed|disclosed)\b/i.test(sentence)) {
              relevanceScore += 2;
            }
            
            // Quote indicators
            if (/"[^"]*"/g.test(sentence)) {
              relevanceScore += 1;
            }
            
            // Date/time indicators (news relevance)
            if (/\b(today|yesterday|this week|last month|on \w+day)\b/i.test(sentence)) {
              relevanceScore += 1;
            }
            
            // Filter out navigation/UI text
            const isUIText = /\b(click here|read more|subscribe|newsletter|follow us|share this|comments|advertisement)\b/i.test(sentence);
            
            if (relevanceScore >= 2 && !isUIText) {
              relevantSentences.push({ sentence, score: relevanceScore });
            }
          }
        }
        
        // Sort by relevance score and take the best content
        relevantSentences.sort((a, b) => b.score - a.score);
        const bestSentences = relevantSentences.slice(0, 40).map(item => item.sentence);
        
        const fullContent = bestSentences.join('. ') + (bestSentences.length > 0 ? '.' : '');
        const wordCount = fullContent.split(/\s+/).filter(word => word.length > 0).length;
        
        // ENHANCED: More nuanced quality assessment
        let quality;
        if (wordCount >= 400) quality = "excellent";
        else if (wordCount >= 250) quality = "good";
        else if (wordCount >= 150) quality = "medium";
        else if (wordCount >= 75) quality = "poor";
        else quality = "insufficient";
        
        // Additional quality factors
        const hasQuotes = /"[^"]*"/g.test(fullContent);
        const hasJournalismWords = /\b(said|according|reported|stated)\b/i.test(fullContent);
        const hasSpecificDetails = /\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}:\d{2}|percent|million|billion)\b/i.test(fullContent);
        
        if (wordCount >= 150 && (hasQuotes || hasJournalismWords || hasSpecificDetails)) {
          if (quality === "medium") quality = "good";
          if (quality === "good") quality = "excellent";
        }
        
        return { content: fullContent, quality, wordCount };
        
      } catch (error) {
        console.log('Content fetch failed:', error.message);
        
        // ENHANCED: Fallback strategies
        if (error.message.includes('timeout')) {
          return { content: "", quality: "timeout", wordCount: 0 };
        }
        if (error.message.includes('403') || error.message.includes('401')) {
          return { content: "", quality: "blocked", wordCount: 0 };
        }
        
        return { content: "", quality: "failed", wordCount: 0 };
      }
    };

    // EXISTING: Your relevance scoring (unchanged)
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

    // EXISTING: Your classification functions (unchanged)
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

    // ENHANCED: Better metadata extraction
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    
    const html = await response.text();
    
    // ENHANCED: Better title extraction
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
    
    // ENHANCED: Better description extraction
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

    // ENHANCED: Better author extraction
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

    // Fetch content using enhanced logic
    const contentData = await fetchFullArticleContent(url, title);
    
    // Use existing scoring
    const relevanceScore = calculateRelevanceScore(title, description);
    const topic = classifyTopic(title, description);
    const priority = determinePriority(relevanceScore, 24);
    
    const hostname = new URL(url).hostname.replace('www.', '');
    
    console.log('✅ ENHANCED AAVM extraction complete:', {
      titleLength: title.length,
      contentLength: contentData.content.length,
      quality: contentData.quality,
      wordCount: contentData.wordCount,
      relevanceScore,
      priority
    });

    return NextResponse.json({
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
    });

  } catch (error) {
    console.error('❌ ENHANCED AAVM scraping error:', error);
    return NextResponse.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
}

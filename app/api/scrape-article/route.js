import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    
    // Better extraction logic
    const getMetaContent = (name) => {
      const patterns = [
        new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
        new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${name}["']`, 'i')
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
      }
      return null;
    };

    // Extract title
    const title = getMetaContent('title') || 
                  html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
                  html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1];

    // Extract description
    const description = getMetaContent('description');

    // FIXED: Better author extraction
    let author = null;
    
    // Try multiple author extraction methods
    const authorPatterns = [
      // NPR specific patterns
      /class="byline-name"[^>]*>([^<]+)</i,
      /class="[^"]*byline[^"]*"[^>]*>([^<]+)</i,
      // Generic patterns
      /[Bb]y\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      /"author"[^>]*>([^<]+)</i,
      /rel="author"[^>]*>([^<]+)</i,
      /class="author"[^>]*>([^<]+)</i
    ];

    for (const pattern of authorPatterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[1].length < 50 && /^[A-Za-z\s\-\.]+$/.test(match[1])) {
        author = match[1].trim();
        break;
      }
    }

    // Extract content
    const contentMatch = html.match(/<p[^>]*>([^<]{50,500})<\/p>/);
    const content = contentMatch ? contentMatch[1] : null;

    // Extract dateline (city at start of articles)
    let dateline = null;
    if (content) {
      const datelinePattern = /^([A-Z]{2,}(?:\s+[A-Z]{2,})*)\s*[—\-–]/;
      const datelineMatch = content.match(datelinePattern);
      if (datelineMatch) {
        dateline = datelineMatch[1];
      }
    }

    const hostname = new URL(url).hostname.replace('www.', '');
    const cleanTitle = title?.replace(/&[^;]+;/g, '').trim() || `Article from ${hostname}`;
    
    // ADDED: Smart relevance and priority scoring
    const calculateRelevance = (title, description, content, source) => {
      let score = 5.0; // Base score
      const text = `${title} ${description} ${content}`.toLowerCase();
      
      // Asian American relevance keywords
      const asianAmericanKeywords = [
        'asian american', 'asian-american', 'aapi', 'chinese american', 'korean american',
        'japanese american', 'vietnamese american', 'filipino american', 'indian american',
        'taiwan', 'hong kong', 'china', 'korea', 'japan', 'vietnam', 'philippines', 'india',
        'immigration', 'visa', 'citizenship', 'diversity', 'discrimination', 'hate crime',
        'college admission', 'affirmative action', 'harvard', 'ucla', 'education'
      ];
      
      // High relevance topics
      const highRelevanceTopics = [
        'civil rights', 'voting rights', 'healthcare', 'education policy', 'immigration policy',
        'supreme court', 'federal funding', 'university', 'college', 'student'
      ];
      
      // Count keyword matches
      let asianAmericanMatches = 0;
      let highRelevanceMatches = 0;
      
      asianAmericanKeywords.forEach(keyword => {
        if (text.includes(keyword)) asianAmericanMatches++;
      });
      
      highRelevanceTopics.forEach(keyword => {
        if (text.includes(keyword)) highRelevanceMatches++;
      });
      
      // Adjust score based on matches
      score += asianAmericanMatches * 1.5; // +1.5 per Asian American keyword
      score += highRelevanceMatches * 0.5; // +0.5 per high relevance topic
      
      // Source bonus (trusted news sources)
      const trustedSources = ['npr', 'reuters', 'ap', 'bbc', 'washingtonpost', 'nytimes'];
      if (trustedSources.some(s => hostname.includes(s))) {
        score += 0.5;
      }
      
      return Math.min(Math.max(score, 1.0), 10.0); // Clamp between 1-10
    };
    
    const calculatePriority = (relevanceScore, title, description) => {
      const text = `${title} ${description}`.toLowerCase();
      
      // High priority indicators
      const urgentKeywords = [
        'breaking', 'urgent', 'emergency', 'crisis', 'lawsuit', 'court ruling',
        'supreme court', 'federal', 'trump', 'biden', 'congress', 'senate'
      ];
      
      const hasUrgentKeywords = urgentKeywords.some(keyword => text.includes(keyword));
      
      if (relevanceScore >= 8.0 || hasUrgentKeywords) return 'high';
      if (relevanceScore >= 6.0) return 'medium';
      return 'low';
    };
    
    const relevanceScore = calculateRelevance(cleanTitle, description, content, hostname);
    const priority = calculatePriority(relevanceScore, cleanTitle, description);
    
    // Determine topic based on content
    const determineTopic = (title, description, content) => {
      const text = `${title} ${description} ${content}`.toLowerCase();
      
      if (text.includes('education') || text.includes('university') || text.includes('college') || text.includes('school')) {
        return 'Education';
      }
      if (text.includes('health') || text.includes('medical') || text.includes('hospital')) {
        return 'Healthcare';
      }
      if (text.includes('immigration') || text.includes('visa') || text.includes('citizenship')) {
        return 'Immigration';
      }
      if (text.includes('election') || text.includes('voting') || text.includes('political') || text.includes('congress')) {
        return 'Politics';
      }
      if (text.includes('economy') || text.includes('inflation') || text.includes('jobs') || text.includes('employment')) {
        return 'Economy';
      }
      
      return 'General';
    };

    return NextResponse.json({
      title: cleanTitle,
      author: author || 'Staff Writer',
      content: content || 'Content preview not available',
      description: description?.replace(/&[^;]+;/g, '').trim() || 'No description available',
      source: hostname.charAt(0).toUpperCase() + hostname.slice(1),
      dateline: dateline || '',
      relevanceScore: Math.round(relevanceScore * 10) / 10, // Round to 1 decimal
      priority: priority,
      topic: determineTopic(cleanTitle, description, content),
      success: true
    });

  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('🌐 Scraping with AAVM logic for:', url);

    // PORTED: Your sophisticated content fetching logic
    const fetchFullArticleContent = async (url, title) => {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 15000
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        let text = await response.text();
        
        // PORTED: Your exact HTML cleaning logic
        text = text.replace(/<script.*?<\/script>/gis, '');
        text = text.replace(/<style.*?<\/style>/gis, '');
        text = text.replace(/<nav.*?<\/nav>/gis, '');
        text = text.replace(/<header.*?<\/header>/gis, '');
        text = text.replace(/<footer.*?<\/footer>/gis, '');
        text = text.replace(/<aside.*?<\/aside>/gis, '');
        text = text.replace(/<[^>]+>/g, '');
        text = text.replace(/\s+/g, ' ').trim();
        
        // PORTED: Your sentence filtering logic
        const sentences = text.split('.').map(s => s.trim()).filter(s => s);
        const titleWords = new Set(title.toLowerCase().split());
        const relevantSentences = [];
        
        for (const sentence of sentences) {
          if (sentence.length > 50) {
            const sentenceWords = new Set(sentence.toLowerCase().split());
            const hasRelevantContent = (
              titleWords.size > 0 && [...titleWords].some(word => sentence.toLowerCase().includes(word)) ||
              sentence.length > 100 ||
              /\b(said|according|reported|stated)\b/i.test(sentence)
            );
            
            if (hasRelevantContent) {
              relevantSentences.push(sentence);
            }
          }
        }
        
        const fullContent = relevantSentences.slice(0, 30).join('. ') + '.';
        const wordCount = fullContent.split(' ').length;
        
        // PORTED: Your quality assessment
        let quality;
        if (wordCount >= 300) quality = "excellent";
        else if (wordCount >= 200) quality = "good";
        else if (wordCount >= 100) quality = "medium";
        else if (wordCount >= 50) quality = "poor";
        else quality = "insufficient";
        
        return { content: fullContent, quality, wordCount };
        
      } catch (error) {
        console.log('Content fetch failed:', error.message);
        return { content: "", quality: "failed", wordCount: 0 };
      }
    };

    // PORTED: Your exact relevance scoring
    const calculateRelevanceScore = (title, description = "") => {
      const text = `${title} ${description}`.toLowerCase();
      let score = 2.0; // Your base score
      
      // PORTED: Your AA keywords (exact same)
      const aaKeywords = [
        "asian american", "chinese american", "korean american", "vietnamese american",
        "filipino american", "japanese american", "south asian", "southeast asian",
        "immigration", "medicare", "healthcare", "education", "voting", "election",
        "hate crime", "discrimination", "civil rights", "community center",
        "small business", "chinatown", "koreatown", "language access", "translation",
        "diaspora", "green card", "naturalization", "intergenerational",
        "model minority", "bamboo ceiling", "affirmative action"
      ];
      
      // PORTED: Your scoring logic
      for (const keyword of aaKeywords) {
        if (text.includes(keyword)) {
          if (keyword.includes("asian american")) {
            score += 4.0;
          } else {
            score += 2.0;
          }
        }
      }
      
      // PORTED: Your topic scoring
      const highRelevance = ["immigration", "healthcare", "education", "voting", "discrimination", "policy"];
      const mediumRelevance = ["economy", "business", "community", "cultural", "federal", "government"];
      
      for (const topic of highRelevance) {
        if (text.includes(topic)) score += 1.5;
      }
      
      for (const topic of mediumRelevance) {
        if (text.includes(topic)) score += 0.8;
      }
      
      // PORTED: Your geographic relevance
      const locations = ["california", "new york", "texas", "georgia", "virginia", "washington", "hawaii"];
      for (const location of locations) {
        if (text.includes(location)) score += 0.3;
      }
      
      score += 1.0;
      return Math.min(score, 10.0);
    };

    // PORTED: Your topic classification
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

    // PORTED: Your priority determination
    const determinePriority = (relevanceScore, publishedHoursAgo) => {
      if (relevanceScore >= 6.0 && publishedHoursAgo <= 24) return "high";
      if (relevanceScore >= 4.0 && publishedHoursAgo <= 48) return "medium";
      return "low";
    };

    // Extract basic metadata
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    
    const html = await response.text();
    
    // Extract title and description
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/&[^;]+;/g, '').trim() : `Article from ${new URL(url).hostname}`;
    
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].replace(/&[^;]+;/g, '').trim() : '';

    // Extract author (simplified)
    const authorMatch = html.match(/[Bb]y\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    const author = authorMatch ? authorMatch[1].trim() : 'Staff Writer';

    // Fetch full content using your logic
    const contentData = await fetchFullArticleContent(url, title);
    
    // Use your exact scoring
    const relevanceScore = calculateRelevanceScore(title, description);
    const topic = classifyTopic(title, description);
    const priority = determinePriority(relevanceScore, 24); // Assume recent for manual adds
    
    const hostname = new URL(url).hostname.replace('www.', '');
    
    console.log('✅ AAVM extraction complete:', {
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
      dateline: '', // Could add your dateline extraction here
      relevanceScore: Math.round(relevanceScore * 10) / 10,
      priority,
      topic,
      contentQuality: contentData.quality,
      wordCount: contentData.wordCount,
      success: true
    });

  } catch (error) {
    console.error('❌ AAVM scraping error:', error);
    return NextResponse.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
}

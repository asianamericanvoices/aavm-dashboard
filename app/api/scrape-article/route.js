import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AAVM-Scraper/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Simple text extraction without JSDOM (to avoid dependencies)
    const extractBetween = (str, start, end) => {
      const startIndex = str.indexOf(start);
      if (startIndex === -1) return null;
      const endIndex = str.indexOf(end, startIndex + start.length);
      if (endIndex === -1) return null;
      return str.substring(startIndex + start.length, endIndex);
    };

    const cleanText = (text) => {
      return text?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    };

    // Extract title from various sources
    let title = extractBetween(html, '<title>', '</title>');
    if (!title) {
      title = extractBetween(html, 'property="og:title" content="', '"');
    }
    if (!title) {
      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      title = h1Match ? h1Match[1] : null;
    }
    title = cleanText(title);

    // Extract description
    let description = extractBetween(html, 'name="description" content="', '"');
    if (!description) {
      description = extractBetween(html, 'property="og:description" content="', '"');
    }
    description = cleanText(description);

    // Extract author
    let author = extractBetween(html, 'name="author" content="', '"');
    if (!author) {
      author = extractBetween(html, 'property="article:author" content="', '"');
    }
    if (!author) {
      const bylineMatch = html.match(/by\s+([^<\n]{2,50})/i);
      author = bylineMatch ? bylineMatch[1].trim() : null;
    }
    author = cleanText(author);

    // Extract basic content (first few paragraphs)
    const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/gi);
    let content = '';
    if (paragraphs) {
      content = paragraphs.slice(0, 5).map(p => cleanText(p)).join(' ').substring(0, 1500);
    }

    // Determine source from URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const sourceMap = {
      'nytimes.com': 'The New York Times',
      'washingtonpost.com': 'The Washington Post',
      'cnn.com': 'CNN',
      'bbc.com': 'BBC',
      'reuters.com': 'Reuters',
      'apnews.com': 'AP News',
      'npr.org': 'NPR',
      'bloomberg.com': 'Bloomberg',
      'wsj.com': 'The Wall Street Journal',
      'politico.com': 'POLITICO',
      'usatoday.com': 'USA Today',
      'abcnews.go.com': 'ABC News',
      'nbcnews.com': 'NBC News'
    };

    const source = sourceMap[hostname] || hostname.charAt(0).toUpperCase() + hostname.slice(1);

    return NextResponse.json({
      title: title || `Article from ${hostname}`,
      author: author || 'N/A',
      content: content || 'Content extraction failed',
      description: description || 'No description available',
      source,
      success: true
    });

  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json({ 
      error: 'Failed to scrape article',
      success: false 
    }, { status: 500 });
  }
}

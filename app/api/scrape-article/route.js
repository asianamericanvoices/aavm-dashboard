// Replace your scrape-article/route.js with this:
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Use a more robust approach - try multiple extraction methods
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10 second timeout
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

    // Extract data
    const title = getMetaContent('title') || 
                  html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
                  html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1];

    const description = getMetaContent('description');
    const author = getMetaContent('author') || 
                   html.match(/[Bb]y\s+([A-Za-z\s]{2,30})/)?.[1];

    // Extract some content
    const contentMatch = html.match(/<p[^>]*>([^<]{50,500})<\/p>/);
    const content = contentMatch ? contentMatch[1] : null;

    const hostname = new URL(url).hostname.replace('www.', '');
    
    return NextResponse.json({
      title: title?.replace(/&[^;]+;/g, '').trim() || `Article from ${hostname}`,
      author: author?.trim() || 'Staff Writer',
      content: content || 'Content preview not available',
      description: description?.replace(/&[^;]+;/g, '').trim() || 'No description available',
      source: hostname.charAt(0).toUpperCase() + hostname.slice(1),
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

// app/api/daily-digest/route.js
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Create Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to read dashboard data (same as in ai/route.js)
async function readDashboardData() {
  if (supabase) {
    try {
      console.log('📊 Reading from Supabase for digest...');
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('*')
        .order('scraped_date', { ascending: false });

      if (articlesError) throw articlesError;

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
        chineseTranslationApproved: article.chinese_translation_approved || false,
        koreanTranslationApproved: article.korean_translation_approved || false,
        imageGenerated: article.image_generated || false,
        imageUrl: article.image_url,
        priority: article.priority,
        relevanceScore: article.relevance_score
      }));

      return { articles: dashboardArticles };
    } catch (error) {
      console.error('❌ Supabase read error for digest:', error);
      return readFromFile();
    }
  } else {
    return readFromFile();
  }
}

function readFromFile() {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'public', 'dashboard_data.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    console.log('📁 Reading from file system for digest');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading dashboard data for digest:', error);
    // Return empty structure if file read fails
    return { 
      articles: [],
      analytics: {
        total_articles: 0,
        today_articles: 0,
        pending_synthesis: 0,
        pending_translation: 0,
        published_articles: 0
      }
    };
  }
}

function generateDigestData(articles) {
  // Exclude deleted and discarded articles
  const activeArticles = articles.filter(a => 
    a.status !== 'deleted' && a.status !== 'discarded'
  );

  const stats = {
    pending_synthesis: activeArticles.filter(a => a.status === 'pending_synthesis').length,
    title_review: activeArticles.filter(a => a.status === 'title_review').length,
    summary_review: activeArticles.filter(a => a.status === 'summary_review').length,
    ready_for_translation: activeArticles.filter(a => a.status === 'ready_for_translation').length,
    chinese_translation_pending: activeArticles.filter(a => a.status === 'chinese_translation_pending').length,
    korean_translation_pending: activeArticles.filter(a => a.status === 'korean_translation_pending').length,
    translation_review: activeArticles.filter(a => a.status === 'translation_review').length,
    translations_approved: activeArticles.filter(a => a.status === 'translations_approved').length,
    ready_for_image: activeArticles.filter(a => a.status === 'ready_for_image').length,
    ready_for_publication: activeArticles.filter(a => a.status === 'ready_for_publication').length,
    total_active: activeArticles.length,
    total_published: activeArticles.filter(a => a.status === 'published').length
  };

  // Calculate if we need to send email (any pending work)
  const needsAttention = stats.pending_synthesis > 0 || 
                        stats.title_review > 0 || 
                        stats.summary_review > 0 || 
                        stats.ready_for_translation > 0 ||
                        stats.chinese_translation_pending > 0 ||
                        stats.korean_translation_pending > 0 ||
                        stats.translation_review > 0 ||
                        stats.translations_approved > 0 ||
                        stats.ready_for_image > 0 ||
                        stats.ready_for_publication > 0;

  return { stats, needsAttention, activeArticles };
}

function generateDigestHTML(stats, activeArticles) {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Get high priority articles that need attention
  const highPriorityPending = activeArticles.filter(a => 
    a.priority === 'high' && 
    !['published', 'deleted', 'discarded'].includes(a.status)
  );

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>AAVM Dashboard Daily Digest</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
            .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
            .footer { background: #1e293b; color: white; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; text-align: center; }
            .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }
            .stat-box { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb; }
            .stat-number { font-size: 24px; font-weight: bold; color: #2563eb; }
            .stat-label { font-size: 14px; color: #6b7280; }
            .priority-section { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 20px 0; }
            .priority-title { color: #dc2626; font-weight: bold; margin-bottom: 10px; }
            .article-item { background: white; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #ef4444; }
            .article-title { font-weight: bold; font-size: 14px; }
            .article-meta { font-size: 12px; color: #6b7280; }
            .cta-button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📊 AAVM Dashboard Daily Digest</h1>
            <p>${today}</p>
        </div>
        
        <div class="content">
            <h2>📈 Pipeline Status</h2>
            
            <div class="stat-grid">
                <div class="stat-box">
                    <div class="stat-number">${stats.pending_synthesis}</div>
                    <div class="stat-label">Pending Synthesis</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.title_review + stats.summary_review}</div>
                    <div class="stat-label">Pending Review</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.chinese_translation_pending}</div>
                    <div class="stat-label">🇨🇳 Chinese Pending</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.korean_translation_pending}</div>
                    <div class="stat-label">🇰🇷 Korean Pending</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.translations_approved}</div>
                    <div class="stat-label">Ready for Images</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${stats.ready_for_publication}</div>
                    <div class="stat-label">Ready to Publish</div>
                </div>
            </div>

            <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3>📊 Summary</h3>
                <p><strong>Total Active Articles:</strong> ${stats.total_active}</p>
                <p><strong>Published Articles:</strong> ${stats.total_published}</p>
                <p><strong>Completion Rate:</strong> ${stats.total_active > 0 ? Math.round((stats.total_published / (stats.total_active + stats.total_published)) * 100) : 0}%</p>
            </div>

            ${highPriorityPending.length > 0 ? `
            <div class="priority-section">
                <div class="priority-title">🔥 High Priority Articles Needing Attention (${highPriorityPending.length})</div>
                ${highPriorityPending.slice(0, 5).map(article => `
                    <div class="article-item">
                        <div class="article-title">${article.displayTitle || article.aiTitle || article.originalTitle}</div>
                        <div class="article-meta">${article.source} • ${article.status.replace('_', ' ')} • Score: ${article.relevanceScore}</div>
                    </div>
                `).join('')}
                ${highPriorityPending.length > 5 ? `<p style="font-size: 12px; color: #6b7280;">...and ${highPriorityPending.length - 5} more</p>` : ''}
            </div>
            ` : ''}

            <div style="text-align: center;">
                <a href="https://aavm-dashboard.vercel.app" class="cta-button">🚀 Open Dashboard</a>
            </div>

            <div style="background: #e0f2fe; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h4 style="margin: 0 0 10px 0; color: #0277bd;">🎯 Next Actions Needed:</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    ${stats.pending_synthesis > 0 ? `<li>${stats.pending_synthesis} articles need title generation</li>` : ''}
                    ${stats.title_review > 0 ? `<li>${stats.title_review} titles need review</li>` : ''}
                    ${stats.summary_review > 0 ? `<li>${stats.summary_review} summaries need review</li>` : ''}
                    ${stats.ready_for_translation > 0 ? `<li>${stats.ready_for_translation} articles ready for translation</li>` : ''}
                    ${stats.chinese_translation_pending > 0 ? `<li>${stats.chinese_translation_pending} Chinese translations need approval</li>` : ''}
                    ${stats.korean_translation_pending > 0 ? `<li>${stats.korean_translation_pending} Korean translations need approval</li>` : ''}
                    ${stats.translations_approved > 0 ? `<li>${stats.translations_approved} articles need image generation</li>` : ''}
                    ${stats.ready_for_publication > 0 ? `<li>${stats.ready_for_publication} articles ready to publish</li>` : ''}
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p>This digest is sent daily at 9:00 PM when articles need attention.</p>
            <p>AAVM Dashboard • Generated on ${new Date().toISOString()}</p>
        </div>
    </body>
    </html>
  `;
}

export async function GET(request) {
  try {
    console.log('📧 Daily digest triggered');

    // Check environment variables
    if (!process.env.RESEND_API_KEY) {
      console.log('⚠️ No Resend API key configured');
      return NextResponse.json({ 
        error: 'Email service not configured - RESEND_API_KEY missing',
        debug: {
          hasResendKey: !!process.env.RESEND_API_KEY,
          hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      }, { status: 500 });
    }

    // Read dashboard data
    const dashboardData = await readDashboardData();
    const { stats, needsAttention, activeArticles } = generateDigestData(dashboardData.articles);

    // Only send email if there's work that needs attention
    if (!needsAttention) {
      console.log('✅ No articles need attention, skipping digest email');
      return NextResponse.json({ 
        success: true, 
        message: 'No articles need attention, digest not sent',
        stats 
      });
    }

    // Generate and send email
    const emailHTML = generateDigestHTML(stats, activeArticles);
    
    const { data, error } = await resend.emails.send({
      from: 'AAVM Dashboard <digest@mail.asianamericanvoices.us>',
      to: ['digest@asianamericanvoices.us'],
      subject: `📊 AAVM Daily Digest - ${stats.pending_synthesis + stats.title_review + stats.summary_review + stats.chinese_translation_pending + stats.korean_translation_pending + stats.translations_approved + stats.ready_for_publication} articles need attention`,
      html: emailHTML,
    });

    if (error) {
      throw new Error(`Resend API error: ${JSON.stringify(error)}`);
    }

    console.log('✅ Daily digest sent successfully:', data.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Daily digest sent successfully',
      emailId: data.id,
      stats,
      needsAttention: true
    });

  } catch (error) {
    console.error('❌ Daily digest error:', error);
    return NextResponse.json({ 
      error: 'Failed to send daily digest',
      details: error.message 
    }, { status: 500 });
  }
}

// Allow manual triggering via POST
export async function POST(request) {
  return GET(request);
}

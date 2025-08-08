'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit3, Globe, CheckCircle, Clock, AlertCircle, BarChart3, Settings } from 'lucide-react';

export default function AAVMDashboard() {
  // State for real data from JSON file
  const [articles, setArticles] = useState([]);
  const [analytics, setAnalytics] = useState({
    articles_scraped_today: 0,
    pending_translation: 0,
    published_articles: 0,
    total_articles: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const [activeTab, setActiveTab] = useState('pipeline');
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Load real data from JSON file
  useEffect(() => {
    fetch('/dashboard_data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Dashboard data not found');
        }
        return response.json();
      })
      .then(data => {
        console.log('Loaded dashboard data:', data);
        setArticles(data.articles || []);
        setAnalytics(data.analytics || {
          articles_scraped_today: 0,
          pending_translation: 0,
          published_articles: 0,
          total_articles: 0
        });
        setLastUpdated(data.last_updated || '');
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading dashboard data:', error);
        // Use sample data if real data not available
        setSampleData();
        setLoading(false);
      });
  }, []);

  const setSampleData = () => {
    setArticles([
      {
        id: 1,
        originalTitle: "Sample Article - Upload dashboard_data.json to see real data",
        source: "Sample Source",
        author: "Sample Author",
        scrapedDate: "2025-08-07",
        originalUrl: "https://example.com",
        status: "pending_synthesis",
        topic: "Sample",
        aiSummary: "This is sample data. Upload your dashboard_data.json file to GitHub to see your real scraped articles here.",
        translations: { chinese: null, korean: null },
        imageGenerated: false,
        priority: "medium",
        relevanceScore: 5.0
      }
    ]);
    setAnalytics({
      articles_scraped_today: 0,
      pending_translation: 0,
      published_articles: 0,
      total_articles: 1
    });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending_synthesis': return 'text-yellow-600 bg-yellow-100';
      case 'ready_for_translation': return 'text-blue-600 bg-blue-100';
      case 'in_translation': return 'text-purple-600 bg-purple-100';
      case 'ready_for_review': return 'text-orange-600 bg-orange-100';
      case 'published': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'pending_synthesis': return <Clock className="w-4 h-4" />;
      case 'ready_for_translation': return <Edit3 className="w-4 h-4" />;
      case 'in_translation': return <Globe className="w-4 h-4" />;
      case 'ready_for_review': return <AlertCircle className="w-4 h-4" />;
      case 'published': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const handleApproveForTranslation = (articleId) => {
    setArticles(prev => prev.map(article => 
      article.id === articleId 
        ? { ...article, status: 'in_translation' }
        : article
    ));
  };

  const handleGenerateSummary = async (articleId) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    // Update status to show loading
    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { ...a, status: 'generating_summary', aiSummary: 'Generating AI summary...' }
        : a
    ));

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'summarize',
          title: article.originalTitle,
          content: `${article.originalTitle}. Published by ${article.source} on ${article.scrapedDate}. This article needs a comprehensive summary.`
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              status: 'ready_for_translation',
              aiSummary: data.result
            }
          : a
      ));
    } catch (error) {
      console.error('Error generating summary:', error);
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              status: 'pending_synthesis',
              aiSummary: 'Error generating summary. Please try again.'
            }
          : a
      ));
    }
  };

  // FIXED TRANSLATION FUNCTION WITH BETTER DEBUGGING
  const handleTranslateArticle = async (articleId, language) => {
    const article = articles.find(a => a.id === articleId);
    if (!article || !article.aiSummary) {
      alert('Please generate an AI summary first before translating.');
      return;
    }

    console.log('Starting translation for:', articleId, 'to', language);
    console.log('Summary to translate:', article.aiSummary.substring(0, 100) + '...');

    // Update to show loading
    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { 
            ...a, 
            translations: {
              ...a.translations,
              [language]: 'Translating...'
            }
          }
        : a
    ));

    try {
      const requestBody = {
        action: 'translate',
        language: language,
        summary: article.aiSummary // Make sure this is the full summary
      };

      console.log('Translation request:', requestBody);

      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Translation response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Translation error response:', errorText);
        throw new Error(`Failed to translate: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Translation successful:', data);
      
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              translations: {
                ...a.translations,
                [language]: data.result
              }
            }
          : a
      ));
    } catch (error) {
      console.error('Error translating:', error);
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              translations: {
                ...a.translations,
                [language]: `Error: ${error.message}. Please try again.`
              }
            }
          : a
      ));
    }
  };

  const handleGenerateImage = (articleId) => {
    setArticles(prev => prev.map(article => 
      article.id === articleId 
        ? { ...article, imageGenerated: true }
        : article
    ));
  };

  const getTopicCounts = () => {
    const counts = {};
    articles.forEach(article => {
      counts[article.topic] = (counts[article.topic] || 0) + 1;
    });
    return counts;
  };

  const getPriorityPercentages = () => {
    const total = articles.length;
    if (total === 0) return { high: 0, medium: 0, low: 0 };
    
    const counts = { high: 0, medium: 0, low: 0 };
    articles.forEach(article => {
      counts[article.priority] = (counts[article.priority] || 0) + 1;
    });
    
    return {
      high: Math.round((counts.high / total) * 100),
      medium: Math.round((counts.medium / total) * 100),
      low: Math.round((counts.low / total) * 100)
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const ArticlePipeline = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Pipeline</h2>
          {lastUpdated && (
            <p className="text-sm text-gray-500">
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Manual Add Article
        </button>
      </div>
      
      {articles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Articles Found</h3>
          <p className="text-gray-600">Upload your dashboard_data.json file to GitHub to see your scraped articles here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {articles.map(article => (
            <div key={article.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(article.status)}`}>
                      {getStatusIcon(article.status)}
                      {article.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-500">{article.source}</span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-500">{article.scrapedDate}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{article.originalTitle}</h3>
                  <p className="text-sm text-gray-600 mb-2">By {article.author}</p>
                  
                  {article.aiSummary && (
                    <div className="bg-gray-50 p-3 rounded-lg mb-3">
                      <p className="text-sm text-gray-700">
                        <strong>AI Summary:</strong> {article.showFullSummary || article.aiSummary.length <= 300
                          ? article.aiSummary
                          : `${article.aiSummary.substring(0, 300)}...`
                        }
                        {article.aiSummary.length > 300 && (
                          <button 
                            onClick={() => {
                              const updatedArticle = {...article, showFullSummary: !article.showFullSummary};
                              setArticles(prev => prev.map(a => 
                                a.id === article.id ? updatedArticle : a
                              ));
                            }}
                            className="text-blue-600 hover:text-blue-800 ml-2 font-medium"
                          >
                            {article.showFullSummary ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">Topic: <span className="font-medium">{article.topic}</span></span>
                    <span className="text-gray-600">Priority: <span className={`font-medium ${article.priority === 'high' ? 'text-red-600' : article.priority === 'medium' ? 'text-orange-600' : 'text-gray-900'}`}>{article.priority}</span></span>
                    <span className="text-gray-600">Score: <span className="font-medium">{article.relevanceScore}</span></span>
                    {article.imageGenerated && <span className="text-green-600">✓ Image Ready</span>}
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <button 
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {article.status === 'ready_for_translation' && (
                    <button 
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      onClick={() => handleApproveForTranslation(article.id)}
                    >
                      Approve for Translation
                    </button>
                  )}
                </div>
              </div>
              
              {(article.translations.chinese || article.translations.korean) && (
                <div className="border-t pt-3 mt-3">
                  <div className="space-y-3">
                    {article.translations.chinese && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-900 mb-1">Chinese Translation:</h4>
                        <p className="text-sm text-gray-700">
                          {article.showFullChinese || article.translations.chinese.length <= 200
                            ? article.translations.chinese
                            : `${article.translations.chinese.substring(0, 200)}...`
                          }
                          {article.translations.chinese.length > 200 && (
                            <button 
                              onClick={() => {
                                const updatedArticle = {...article, showFullChinese: !article.showFullChinese};
                                setArticles(prev => prev.map(a => 
                                  a.id === article.id ? updatedArticle : a
                                ));
                              }}
                              className="text-blue-600 hover:text-blue-800 ml-2 font-medium"
                            >
                              {article.showFullChinese ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </p>
                      </div>
                    )}
                    {article.translations.korean && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-900 mb-1">Korean Translation:</h4>
                        <p className="text-sm text-gray-700">
                          {article.showFullKorean || article.translations.korean.length <= 200
                            ? article.translations.korean
                            : `${article.translations.korean.substring(0, 200)}...`
                          }
                          {article.translations.korean.length > 200 && (
                            <button 
                              onClick={() => {
                                const updatedArticle = {...article, showFullKorean: !article.showFullKorean};
                                setArticles(prev => prev.map(a => 
                                  a.id === article.id ? updatedArticle : a
                                ));
                              }}
                              className="text-blue-600 hover:text-blue-800 ml-2 font-medium"
                            >
                              {article.showFullKorean ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Action buttons - now always visible on main page */}
              <div className="border-t pt-3 mt-3">
                <div className="flex gap-2 flex-wrap">
                  {article.status === 'pending_synthesis' && (
                    <button 
                      onClick={() => handleGenerateSummary(article.id)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Generate AI Summary
                    </button>
                  )}
                  {article.status === 'generating_summary' && (
                    <button 
                      disabled
                      className="px-3 py-1 bg-gray-400 text-white rounded text-sm cursor-not-allowed"
                    >
                      Generating Summary...
                    </button>
                  )}
                  {(article.status === 'ready_for_translation' || article.status === 'in_translation') && !article.translations.chinese && (
                    <button 
                      onClick={() => handleTranslateArticle(article.id, 'chinese')}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Translate to Chinese
                    </button>
                  )}
                  {(article.status === 'ready_for_translation' || article.status === 'in_translation') && !article.translations.korean && (
                    <button 
                      onClick={() => handleTranslateArticle(article.id, 'korean')}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Translate to Korean
                    </button>
                  )}
                  {(article.status === 'ready_for_translation' || article.status === 'in_translation') && !article.imageGenerated && (
                    <button 
                      onClick={() => handleGenerateImage(article.id)}
                      className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                    >
                      Generate AI Image
                    </button>
                  )}
                  <button 
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center gap-1"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <Eye className="w-3 h-3" />
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const Analytics = () => {
    const topicCounts = getTopicCounts();
    const priorityPercentages = getPriorityPercentages();
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Articles Scraped Today</p>
                <p className="text-3xl font-bold text-gray-900">{analytics.articles_scraped_today || 0}</p>
              </div>
              <div className="bg-blue-100 p-2 rounded">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Translation</p>
                <p className="text-3xl font-bold text-gray-900">{analytics.pending_translation || 0}</p>
              </div>
              <div className="bg-yellow-100 p-2 rounded">
                <Globe className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Published Articles</p>
                <p className="text-3xl font-bold text-gray-900">{analytics.published_articles || 0}</p>
              </div>
              <div className="bg-green-100 p-2 rounded">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Articles</p>
                <p className="text-3xl font-bold text-gray-900">{analytics.total_articles || 0}</p>
              </div>
              <div className="bg-purple-100 p-2 rounded">
                <Eye className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Articles by Topic</h3>
            <div className="space-y-3">
              {Object.entries(topicCounts).map(([topic, count]) => (
                <div key={topic} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{topic}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{width: `${Math.min((count / Math.max(...Object.values(topicCounts))) * 100, 100)}%`}}
                      ></div>
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Articles by Priority</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">High Priority</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div className="bg-red-600 h-2 rounded-full" style={{width: `${priorityPercentages.high}%`}}></div>
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{priorityPercentages.high}%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Medium Priority</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div className="bg-orange-600 h-2 rounded-full" style={{width: `${priorityPercentages.medium}%`}}></div>
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{priorityPercentages.medium}%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Low Priority</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div className="bg-gray-600 h-2 rounded-full" style={{width: `${priorityPercentages.low}%`}}></div>
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{priorityPercentages.low}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AAVM Dashboard</h1>
                <p className="text-sm text-gray-600">Asian American Voices Media</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-6 border-b">
          <button 
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pipeline' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('pipeline')}
          >
            Content Pipeline
          </button>
          <button 
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'analytics' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button 
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'pipeline' && <ArticlePipeline />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'settings' && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
            <p className="text-gray-600">Settings panel coming soon - configure scraping sources, translation preferences, and publishing workflows.</p>
          </div>
        )}
      </div>

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedArticle(null)} // Click outside to close
        >
          <div 
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Article Details</h2>
                <button 
                  onClick={() => setSelectedArticle(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedArticle.originalTitle}</h3>
                  <p className="text-sm text-gray-600">
                    {selectedArticle.source} • {selectedArticle.author} • {selectedArticle.scrapedDate}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Relevance Score: {selectedArticle.relevanceScore} • Priority: {selectedArticle.priority}
                  </p>
                  <a 
                    href={selectedArticle.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm mt-2"
                  >
                    <Globe className="w-4 h-4" />
                    Read Original Article
                  </a>
                </div>
                
                {selectedArticle.aiSummary && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">AI Summary</h4>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedArticle.aiSummary}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedArticle.translations.chinese && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Chinese Translation</h4>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedArticle.translations.chinese}</p>
                    </div>
                  )}
                  {selectedArticle.translations.korean && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Korean Translation</h4>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedArticle.translations.korean}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 pt-4 border-t">
                  {selectedArticle.status === 'pending_synthesis' && (
                    <button 
                      onClick={() => {
                        handleGenerateSummary(selectedArticle.id);
                        setSelectedArticle({...selectedArticle, status: 'ready_for_translation'});
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Generate AI Summary
                    </button>
                  )}
                  {!selectedArticle.translations.chinese && (
                    <button 
                      onClick={() => {
                        handleTranslateArticle(selectedArticle.id, 'chinese');
                        setSelectedArticle({
                          ...selectedArticle, 
                          translations: {
                            ...selectedArticle.translations,
                            chinese: '此文章已翻译成中文。这是一个演示翻译，显示翻译功能正常工作。'
                          }
                        });
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Translate to Chinese
                    </button>
                  )}
                  {!selectedArticle.translations.korean && (
                    <button 
                      onClick={() => {
                        handleTranslateArticle(selectedArticle.id, 'korean');
                        setSelectedArticle({
                          ...selectedArticle, 
                          translations: {
                            ...selectedArticle.translations,
                            korean: '이 기사는 한국어로 번역되었습니다. 이것은 번역 기능이 제대로 작동함을 보여주는 데모 번역입니다.'
                          }
                        });
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Translate to Korean
                    </button>
                  )}
                  {!selectedArticle.imageGenerated && (
                    <button 
                      onClick={() => {
                        handleGenerateImage(selectedArticle.id);
                        setSelectedArticle({...selectedArticle, imageGenerated: true});
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      Generate AI Image
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

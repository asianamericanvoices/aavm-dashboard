'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit3, Globe, CheckCircle, Clock, AlertCircle, BarChart3, Settings, Zap, X, ExternalLink, Filter, RotateCcw, ChevronDown } from 'lucide-react';
import AuthWrapper from './components/AuthWrapper';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

function AAVMDashboardContent() {
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [analytics, setAnalytics] = useState({
    articles_scraped_today: 0,
    pending_translation: 0,
    published_articles: 0,
    total_articles: 0
  });
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [activeTab, setActiveTab] = useState('pipeline');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAddUrl, setManualAddUrl] = useState('');
  const [manualAddPreview, setManualAddPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Filter and sort states
  const [filters, setFilters] = useState({
    status: 'all',
    statusGroup: 'all',
    topic: 'all',
    priority: 'all',
    relevanceMin: 0,
    relevanceMax: 10,
    source: 'all',
    keyword: ''
  });
  const [sortBy, setSortBy] = useState('date-desc');
  const [showFilters, setShowFilters] = useState(false);

  const getAuthorDisplay = (author, source) => {
    if (author && 
        author !== 'N/A' && 
        author !== 'Unknown' && 
        author !== 'Staff' &&
        author.trim().length > 0 &&
        !author.toLowerCase().includes('editor') &&
        !author.toLowerCase().includes('staff writer')) {
      return author;
    }
    
    switch (source?.toLowerCase()) {
      case 'reuters':
        return 'Reuters Staff';
      case 'ap news':
      case 'associated press':
        return 'AP Staff';
      case 'usa today':
        return 'USA Today Staff';
      case 'nbc news':
        return 'NBC News Staff';
      case 'abc news':
        return 'ABC News Staff';
      case 'bloomberg':
      case 'bloomberg business':
        return 'Bloomberg Staff';
      case 'politico':
        return 'Politico Staff';
      case 'npr':
        return 'NPR Staff';
      default:
        return 'Staff Writer';
    }
  };

  // Helper function to check permissions
  const canUserPerformAction = (action, language = null) => {
    if (userRole === 'admin') return true; // Admin can do everything
    
    switch (action) {
      case 'approve_chinese_translation':
        return userRole === 'chinese_translator' || userRole === 'admin';
      case 'approve_korean_translation':
        return userRole === 'korean_translator' || userRole === 'admin';
      case 'edit_content':
      case 'generate_title':
      case 'generate_summary':
      case 'generate_image':
        return userRole === 'admin';
      default:
        return false;
    }
  };
  
  // Filter and sort functions
  const applyFiltersAndSort = (articlesList = articles) => {
    let filtered = articlesList.filter(article => {
      // Exclude both deleted and discarded articles from main pipeline
      if (article.status === 'discarded' || article.status === 'deleted') return false;
      
      // Status group filtering
      if (filters.statusGroup !== 'all') {
        const statusGroups = {
          'unreviewed': ['pending_synthesis'],
          'in_process': ['generating_title', 'title_review', 'generating_summary', 'summary_review', 'ready_for_translation', 'in_translation', 'chinese_translation_pending', 'korean_translation_pending', 'translation_review', 'translations_approved', 'ready_for_image', 'generating_image', 'ready_for_publication'],
          'published': ['published']
        };
        if (!statusGroups[filters.statusGroup]?.includes(article.status)) return false;
      }
      
      // Detailed status filtering
      if (filters.status !== 'all' && article.status !== filters.status) return false;
      if (filters.topic !== 'all' && article.topic !== filters.topic) return false;
      if (filters.priority !== 'all' && article.priority !== filters.priority) return false;
      if (filters.source !== 'all' && article.source !== filters.source) return false;
      if (article.relevanceScore < filters.relevanceMin || article.relevanceScore > filters.relevanceMax) return false;
      
      // Keyword search across multiple fields
      if (filters.keyword && filters.keyword.trim().length > 0) {
        const keyword = filters.keyword.toLowerCase().trim();
        const searchableText = [
          article.originalTitle,
          article.aiTitle,
          article.displayTitle,
          article.aiSummary?.replace(/<br>/g, ' '),
          article.fullContent,
          article.author,
          article.source,
          article.translations?.chinese?.replace(/<br>/g, ' '),
          article.translations?.korean?.replace(/<br>/g, ' '),
          article.translatedTitles?.chinese,
          article.translatedTitles?.korean
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(keyword)) return false;
      }
      
      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.scrapedDate) - new Date(a.scrapedDate);
        case 'date-asc':
          return new Date(a.scrapedDate) - new Date(b.scrapedDate);
        case 'relevance-desc':
          return b.relevanceScore - a.relevanceScore;
        case 'relevance-asc':
          return a.relevanceScore - b.relevanceScore;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'title':
          return (a.displayTitle || a.aiTitle || a.originalTitle).localeCompare(
            b.displayTitle || b.aiTitle || b.originalTitle
          );
        default:
          return 0;
      }
    });

    setFilteredArticles(filtered);
  };

  // Get unique values for filter dropdowns
  const getUniqueValues = (field) => {
    const values = [...new Set(articles.map(article => article[field]))];
    return values.filter(Boolean);
  };

  useEffect(() => {
    fetch('/api/ai?type=dashboard')
      .then(response => {
        if (!response.ok) {
          throw new Error('Dashboard data not found');
        }
        return response.json();
      })
      .then(data => {
        console.log('🔍 Loaded dashboard data:', data);
        console.log('🔍 First article dateline:', data.articles[0]?.dateline);
        console.log('🔍 First article author:', data.articles[0]?.author);
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
        setSampleData();
        setLoading(false);
      });
  }, []);

  // Add user role detection
  useEffect(() => {
    const getUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        
        setUser(user);
        setUserRole(userData?.role);
      }
    };
    
    getUserRole();
  }, []);
  
  // Apply filters whenever articles, filters, or sortBy changes
  useEffect(() => {
    applyFiltersAndSort();
  }, [articles, filters, sortBy]);

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
        fullContent: "This is sample data. Upload your dashboard_data.json file to GitHub to see your real scraped articles here.",
        aiSummary: null,
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

  // Start Over functionality
  const handleStartOver = async (articleId) => {
    if (!confirm('Are you sure you want to start over? This will reset all AI-generated content and translations for this article.')) {
      return;
    }

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start_over',
          articleId: articleId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start over');
      }

      const data = await response.json();
      
      // Update the article in the UI to reflect the reset
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              status: 'pending_synthesis',
              aiTitle: null,
              aiSummary: null,
              displayTitle: null,
              translations: { chinese: null, korean: null },
              translatedTitles: { chinese: null, korean: null },
              imageGenerated: false,
              imageUrl: null,
              editingTitle: false,
              editingSummary: false,
              editingChinese: false,
              editingKorean: false,
              editingAuthor: false,
              editingDateline: false
            }
          : a
      ));

      console.log('✅ Article reset successfully:', data);
    } catch (error) {
      console.error('Error starting over:', error);
      alert('Failed to start over. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending_synthesis': return 'text-yellow-600 bg-yellow-100';
      case 'generating_title': return 'text-blue-600 bg-blue-100';
      case 'title_review': return 'text-purple-600 bg-purple-100';
      case 'generating_summary': return 'text-blue-600 bg-blue-100';
      case 'summary_review': return 'text-purple-600 bg-purple-100';
      case 'ready_for_translation': return 'text-orange-600 bg-orange-100';
      case 'in_translation': return 'text-indigo-600 bg-indigo-100';
      case 'chinese_translation_pending': return 'text-red-600 bg-red-100';
      case 'korean_translation_pending': return 'text-blue-600 bg-blue-100';
      case 'translation_review': return 'text-pink-600 bg-pink-100';
      case 'translations_approved': return 'text-green-600 bg-green-100';
      case 'ready_for_image': return 'text-teal-600 bg-teal-100';
      case 'generating_image': return 'text-cyan-600 bg-cyan-100';
      case 'ready_for_publication': return 'text-green-600 bg-green-100';
      case 'published': return 'text-emerald-600 bg-emerald-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'pending_synthesis': return <Clock className="w-4 h-4" />;
      case 'generating_title': return <Zap className="w-4 h-4 animate-spin" />;
      case 'title_review': return <Edit3 className="w-4 h-4" />;
      case 'generating_summary': return <Clock className="w-4 h-4 animate-spin" />;
      case 'summary_review': return <Edit3 className="w-4 h-4" />;
      case 'ready_for_translation': return <Globe className="w-4 h-4" />;
      case 'in_translation': return <Globe className="w-4 h-4 animate-pulse" />;
      case 'translation_review': return <Edit3 className="w-4 h-4" />;
      case 'ready_for_image': return <AlertCircle className="w-4 h-4" />;
      case 'generating_image': return <AlertCircle className="w-4 h-4 animate-spin" />;
      case 'ready_for_publication': return <CheckCircle className="w-4 h-4" />;
      case 'published': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const handleTranslateTitle = async (articleId, language) => {
    const article = articles.find(a => a.id === articleId);
    if (!article || !article.aiTitle) return;
  
    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'translate_title',
          title: article.aiTitle,
          language: language,
          articleId: articleId  // ✅ ADDED FOR PERSISTENCE
        }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to translate title');
      }
  
      const data = await response.json();
      
      // ✅ API saves automatically, just update UI
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              translatedTitles: {
                ...a.translatedTitles,
                [language]: data.result
              }
            }
          : a
      ));
    } catch (error) {
      console.error('Error translating title:', error);
    }
  };
  
  const handleDeleteArticle = async (articleId) => {
    if (confirm('Are you sure you want to delete this article? You can restore it later from the Deleted Articles section.')) {
      try {
        const response = await fetch(window.location.origin + '/api/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'delete_article',
            articleId: articleId
          }),
        });

        if (response.ok) {
          // Move article to deleted status in UI
          setArticles(prev => prev.map(a => 
            a.id === articleId 
              ? { ...a, status: 'deleted', deleted_at: new Date().toISOString() }
              : a
          ));
          
          console.log('✅ Article moved to deleted status');
        } else {
          throw new Error('Failed to delete article');
        }
      } catch (error) {
        console.error('❌ Error deleting article:', error);
        alert('Failed to delete article. Please try again.');
      }
    }
  };

  const handleRestoreArticle = async (articleId) => {
    if (confirm('Are you sure you want to restore this article?')) {
      try {
        const response = await fetch(window.location.origin + '/api/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'restore_article',
            articleId: articleId
          }),
        });

        if (response.ok) {
          // Restore article in UI
          setArticles(prev => prev.map(a => 
            a.id === articleId 
              ? { ...a, status: 'pending_synthesis', deleted_at: null }
              : a
          ));
          
          console.log('✅ Article restored successfully');
        } else {
          throw new Error('Failed to restore article');
        }
      } catch (error) {
        console.error('❌ Error restoring article:', error);
        alert('Failed to restore article. Please try again.');
      }
    }
  };

  const handlePermanentDelete = async (articleId) => {
    if (confirm('Are you sure you want to PERMANENTLY delete this article? This action cannot be undone and will remove it from the database forever.')) {
      try {
        const response = await fetch(window.location.origin + '/api/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'permanent_delete_article',
            articleId: articleId
          }),
        });

        if (response.ok) {
          // Remove article from UI completely
          setArticles(prev => prev.filter(a => a.id !== articleId));
          
          // Update analytics
          setAnalytics(prev => ({
            ...prev,
            total_articles: prev.total_articles - 1
          }));
          
          console.log('✅ Article permanently deleted');
        } else {
          throw new Error('Failed to permanently delete article');
        }
      } catch (error) {
        console.error('❌ Error permanently deleting article:', error);
        alert('Failed to permanently delete article. Please try again.');
      }
    }
  };

  const handleDiscardArticle = async (articleId) => {
    if (confirm('Are you sure you want to discard this article? You can restore it later from the Deleted Articles section.')) {
      try {
        const response = await fetch(window.location.origin + '/api/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'update_status',
            articleId: articleId,
            status: 'discarded'
          }),
        });
  
        if (response.ok) {
          // Update article status in UI
          setArticles(prev => prev.map(a => 
            a.id === articleId 
              ? { ...a, status: 'discarded', discarded_at: new Date().toISOString() }
              : a
          ));
          
          console.log('✅ Article discarded successfully');
        } else {
          throw new Error('Failed to discard article');
        }
      } catch (error) {
        console.error('❌ Error discarding article:', error);
        alert('Failed to discard article. Please try again.');
      }
    }
  };
  
  const handleGenerateTitle = async (articleId) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { ...a, status: 'generating_title', generatingTitle: true }
        : a
    ));

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate_title',
          title: article.originalTitle,
          source: article.source,
          articleId: articleId  // ✅ ADDED FOR PERSISTENCE
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate title');
      }

      const data = await response.json();
      
      // ✅ API saves automatically, just update UI
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              status: 'title_review',
              aiTitle: data.result,
              generatingTitle: false,
              editingTitle: false
            }
          : a
      ));
    } catch (error) {
      console.error('Error generating title:', error);
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              status: 'pending_synthesis',
              generatingTitle: false,
              aiTitle: `Error: ${error.message}. Please try again.`
            }
          : a
      ));
    }
  };

  const handleEditTitle = (articleId, newTitle) => {
    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { ...a, aiTitle: newTitle }
        : a
    ));
  };

  const handleEditAuthor = (articleId, newAuthor) => {
    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { ...a, author: newAuthor }
        : a
    ));
  };

  const handleEditDateline = async (articleId, newDateline) => {
    try {
      // Save to backend first
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_content',
          articleId: articleId,
          updates: {
            dateline: newDateline.toUpperCase() // Ensure it's uppercase
          }
        }),
      });
  
      if (response.ok) {
        // Only update UI after successful save
        setArticles(prev => prev.map(a => 
          a.id === articleId 
            ? { ...a, dateline: newDateline.toUpperCase() }
            : a
        ));
        console.log('✅ Dateline saved successfully');
      } else {
        throw new Error('Failed to save dateline');
      }
    } catch (error) {
      console.error('❌ Error saving dateline:', error);
      alert('Failed to save dateline. Please try again.');
    }
  };
  
  const handleApproveTitle = async (articleId) => {
    console.log('🟢 APPROVE TITLE CLICKED for article:', articleId);
    
    // ✅ Save the approval to the file
    try {
      const article = articles.find(a => a.id === articleId);
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_status',
          articleId: articleId,
          status: 'pending_synthesis',
          updates: {
            editingTitle: false,
            displayTitle: article?.aiTitle
          }
        }),
      });

      if (response.ok) {
        // Update UI to reflect the change
        setArticles(prev => prev.map(a => {
          if (a.id === articleId) {
            return {
              ...a, 
              status: 'pending_synthesis', 
              editingTitle: false,
              displayTitle: a.aiTitle || a.originalTitle
            };
          }
          return a;
        }));
      }
    } catch (error) {
      console.error('Error saving title approval:', error);
    }
  };

  const handleGenerateSummary = async (articleId) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    // Check if we have full content to work with
    if (!article.fullContent || article.fullContent.trim().length < 100) {
      alert('Full article content not available. Please re-run the scraper to capture complete article text.');
      return;
    }

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
          title: article.displayTitle || article.aiTitle || article.originalTitle,
          source: article.source,
          content: article.fullContent,
          articleId: articleId  // ✅ ADDED FOR PERSISTENCE
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();
      
      // ✅ API saves automatically, just update UI
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              status: 'summary_review',
              aiSummary: data.result,
              editingSummary: false
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
              aiSummary: `Error: ${error.message}. Please try again.`
            }
          : a
      ));
    }
  };

  const handleEditSummary = (articleId, newSummary) => {
    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { ...a, aiSummary: newSummary }
        : a
    ));
  };

  const handleApproveSummary = async (articleId) => {
    console.log('🟢 APPROVE SUMMARY CLICKED for article:', articleId);
    
    // ✅ Save the approval to the file
    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_status',
          articleId: articleId,
          status: 'ready_for_translation',
          updates: {
            editingSummary: false
          }
        }),
      });

      if (response.ok) {
        setArticles(prev => prev.map(a => {
          if (a.id === articleId) {
            return {
              ...a, 
              status: 'ready_for_translation', 
              editingSummary: false
            };
          }
          return a;
        }));
      }
    } catch (error) {
      console.error('Error saving summary approval:', error);
    }
  };

  const handleEditTranslation = (articleId, language, newTranslation) => {
    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { 
            ...a, 
            translations: {
              ...a.translations,
              [language]: newTranslation
            }
          }
        : a
    ));
  };

  const handleApproveTranslations = (articleId) => {
    const article = articles.find(a => a.id === articleId);
    if (article && article.translations.chinese && article.translations.korean) {
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              status: 'ready_for_image',
              editingTranslations: false
            }
          : a
      ));
    }
  };

  const handleApproveForPublication = async (articleId) => {
    try {
      // Save published status to backend
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_status',
          articleId: articleId,
          status: 'published'
        }),
      });
  
      if (response.ok) {
        console.log('✅ Published status saved to backend');
        
        // Update UI after successful save
        setArticles(prev => prev.map(a => 
          a.id === articleId 
            ? { ...a, status: 'published' }
            : a
        ));
      } else {
        throw new Error('Failed to save published status');
      }
    } catch (error) {
      console.error('Error publishing article:', error);
      alert('Failed to publish article. Please try again.');
    }
  };

  const handleManualAddUrl = async () => {
    if (!manualAddUrl.trim()) {
      alert('Please enter a URL');
      return;
    }
  
    setLoadingPreview(true);
    
    try {
      // Simple URL validation
      new URL(manualAddUrl);
      
      // Use a web scraping service to get article content
      const scrapingResponse = await fetch(window.location.origin + '/api/scrape-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: manualAddUrl
        })
      });
  
      if (scrapingResponse.ok) {
        const scrapedData = await scrapingResponse.json();
        console.log('🔍 DEBUG: Full API response from scraper:', JSON.stringify(scrapedData, null, 2));
        
        // ✅ ADD THIS DEBUG BLOCK - COPY/PASTE THIS ENTIRE SECTION
        console.log('🔍 DEBUG: Full scraped response:', scrapedData);
        console.log('🔍 DEBUG: Content details:', {
          hasContent: !!scrapedData.content,
          contentLength: scrapedData.content?.length || 0,
          contentPreview: scrapedData.content?.substring(0, 300) || 'NO CONTENT',
          contentQuality: scrapedData.contentQuality,
          wordCount: scrapedData.wordCount,
          success: scrapedData.success
        });
        
        // ✅ CHECK FOR CONTENT ISSUES AND WARN USER
        if (!scrapedData.content || scrapedData.content.length < 100) {
          console.warn('⚠️ DEBUG: Content appears to be too short or empty');
          console.warn('⚠️ DEBUG: Full content received:', scrapedData.content);
          
          // Show warning to user but still allow preview
          if (confirm(`Warning: The scraped content appears to be very short or empty (${scrapedData.content?.length || 0} characters). This may cause issues when generating AI summaries. Do you want to continue anyway?`)) {
            // Continue with short content
          } else {
            setLoadingPreview(false);
            return;
          }
        }
        // ✅ END DEBUG BLOCK
        
        // Create preview from scraped data
        const preview = {
          id: Date.now(),
          originalTitle: scrapedData.title || `Article from ${new URL(manualAddUrl).hostname}`,
          source: scrapedData.source || new URL(manualAddUrl).hostname.replace('www.', ''),
          author: scrapedData.author || 'N/A',
          scrapedDate: new Date().toISOString().split('T')[0],
          originalUrl: manualAddUrl,
          status: 'pending_synthesis',
          topic: scrapedData.topic || 'Manual',
          fullContent: scrapedData.content || 'Content will need to be manually added.',
          shortDescription: scrapedData.description || scrapedData.content?.substring(0, 200) + '...' || 'No description available',
          aiSummary: null,
          aiTitle: null,
          displayTitle: null,
          translations: { chinese: null, korean: null },
          translatedTitles: { chinese: null, korean: null },
          imageGenerated: false,
          imageUrl: null,
          priority: scrapedData.priority || 'medium',
          relevanceScore: scrapedData.relevanceScore || 5.0,
          dateline: scrapedData.dateline || '',
          isManualAdd: true,
          publishedDate: scrapedData.publishedDate || new Date().toISOString().split('T')[0]
        };
        
        setManualAddPreview(preview);
      } else {
        // Fallback to basic preview if scraping fails
        throw new Error('Scraping failed');
      }
      
      setLoadingPreview(false);
      
    } catch (error) {
      console.log('Scraping failed, using basic preview:', error);
      
      // Fallback to basic preview
      const urlObj = new URL(manualAddUrl);
      const domain = urlObj.hostname.replace('www.', '');
      
      const basicPreview = {
        id: Date.now(),
        originalTitle: `Article from ${domain}`,
        source: domain.charAt(0).toUpperCase() + domain.slice(1),
        author: 'N/A',
        scrapedDate: new Date().toISOString().split('T')[0],
        originalUrl: manualAddUrl,
        status: 'pending_synthesis',
        topic: 'Manual',
        fullContent: 'Article content needs to be manually added or scraped.',
        shortDescription: `Manually added article from ${domain}`,
        aiSummary: null,
        aiTitle: null,
        displayTitle: null,
        translations: { chinese: null, korean: null },
        translatedTitles: { chinese: null, korean: null },
        imageGenerated: false,
        imageUrl: null,
        priority: 'medium',
        relevanceScore: 5.0,
        dateline: '',
        isManualAdd: true
      };
      
      setManualAddPreview(basicPreview);
      setLoadingPreview(false);
    }
  };
  
  const handleApproveManualAdd = async () => {
    console.log('🎯 APPROVE MANUAL ADD CLICKED');
    console.log('📄 Manual add preview data:', manualAddPreview);
    
    if (!manualAddPreview) {
      console.error('❌ No manual add preview data!');
      alert('No preview data available. Please generate a preview first.');
      return;
    }
    
    try {
      console.log('💾 Saving manual article to backend...');
      console.log('🌐 Request URL:', window.location.origin + '/api/ai');
      
      const requestPayload = {
        action: 'add_manual_article',
        article: manualAddPreview
      };
      
      console.log('📦 Request payload:', JSON.stringify(requestPayload, null, 2));
      
      // Save to backend using the same API as other updates
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });
  
      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
  
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Manual article saved successfully:', data);
        
        // ✅ FIXED: Properly update the articles state with the returned article
        const articleToAdd = data.article || { ...manualAddPreview, id: data.articleId || manualAddPreview.id };
        
        // Update articles state immediately for UI feedback
        setArticles(prev => [articleToAdd, ...prev]);
        
        // Update analytics to reflect the new article
        setAnalytics(prev => ({
          ...prev,
          total_articles: prev.total_articles + 1
        }));
        
        // If we have updated data from the backend (file system case), use it
        if (data.updatedData) {
          setArticles(data.updatedData.articles);
          setAnalytics(data.updatedData.analytics);
          setLastUpdated(data.updatedData.last_updated);
        }
        
        // Close modal and reset
        setShowManualAdd(false);
        setManualAddUrl('');
        setManualAddPreview(null);
        
        // Show success message
        alert('Article added successfully!');
        
      } else {
        const errorText = await response.text();
        console.error('❌ Response not ok:', errorText);
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
    } catch (error) {
      console.error('💥 Error saving manual article:', error);
      alert(`Failed to save article: ${error.message}`);
    }
  };
  
  const handleCancelManualAdd = () => {
    setShowManualAdd(false);
    setManualAddUrl('');
    setManualAddPreview(null);
    setLoadingPreview(false);
  };
  
  const handleTranslateArticle = async (articleId, language) => {
    // First, force save any pending edits
    const currentArticle = articles.find(a => a.id === articleId);
    if (currentArticle && currentArticle.editingSummary) {
      const textarea = document.getElementById(`summary-edit-${articleId}`);
      if (textarea) {
        console.log('SAVING EDITS - Textarea value:', textarea.value.substring(0, 50) + '...');
        handleEditSummary(articleId, textarea.value.replace(/\n/g, '<br>'));
        // Add a small delay to ensure state updates
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Get the updated article after potential edits
    const article = articles.find(a => a.id === articleId);
    if (!article || !article.aiSummary) {
      alert('Please generate an AI summary first before translating.');
      return;
    }

    console.log(`🔍 TRANSLATION DEBUG - ${language.toUpperCase()}:`);
    console.log('Article ID:', articleId);
    console.log('Summary being sent:', article.aiSummary.substring(0, 100) + '...');
    console.log('Full summary length:', article.aiSummary.length);

    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { 
            ...a, 
            status: 'in_translation',
            translations: {
              ...a.translations,
              [language]: 'Translating...'
            }
          }
        : a
    ));

    try {
      const summaryText = article.aiSummary.replace(/<br>/g, '\n');
      console.log('📤 Sending to API:', summaryText.substring(0, 100) + '...');
      
      const requestBody = {
        action: 'translate',
        language: language,
        summary: summaryText,
        articleId: articleId  // ✅ ADDED FOR PERSISTENCE
      };

      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to translate: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Also translate the title if we have one
      if (article.aiTitle && !article.translatedTitles?.[language]) {
        handleTranslateTitle(articleId, language);
      }
      
      // Check if both translations will be done after this one
      const currentArticleCheck = articles.find(a => a.id === articleId);
      const otherLanguage = language === 'chinese' ? 'korean' : 'chinese';
      const otherTranslationExists = currentArticleCheck.translations[otherLanguage] && 
                                   currentArticleCheck.translations[otherLanguage] !== 'Translating...';
      
      const bothTranslationsDone = otherTranslationExists && data.result;

      // ✅ API saves automatically, just update UI
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              status: bothTranslationsDone ? 'translation_review' : 'ready_for_translation',
              translations: {
                ...a.translations,
                [language]: data.result.replace(/\n/g, '<br>')
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
              status: 'ready_for_translation',
              translations: {
                ...a.translations,
                [language]: `Error: ${error.message}. Please try again.`
              }
            }
          : a
      ));
    }
  };

  const handleGenerateImagePrompt = async (articleId) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { ...a, generatingPrompt: true }
        : a
    ));

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate_image_prompt',
          title: article.displayTitle || article.aiTitle || article.originalTitle,
          content: article.fullContent || '',
          source: article.source,
          articleId: articleId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image prompt');
      }

      const data = await response.json();
      
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              generatingPrompt: false,
              imagePrompt: data.result,
              showPromptEditor: true
            }
          : a
      ));
    } catch (error) {
      console.error('Error generating image prompt:', error);
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              generatingPrompt: false,
              imagePrompt: `Error: ${error.message}. Please try again.`
            }
          : a
      ));
    }
  };

  const handleEditImagePrompt = (articleId, newPrompt) => {
    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { ...a, imagePrompt: newPrompt }
        : a
    ));
  };

  const handleGenerateImage = async (articleId) => {
    const article = articles.find(a => a.id === articleId);
    if (!article || !article.imagePrompt) {
      alert('Please generate and review an image prompt first.');
      return;
    }

    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { ...a, status: 'generating_image', imageGenerating: true }
        : a
    ));

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate_image',
          prompt: article.imagePrompt, // Use the edited prompt
          articleId: articleId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              status: 'ready_for_publication',
              imageGenerated: true,
              imageGenerating: false,
              imageUrl: data.result,
              showPromptEditor: false
            }
          : a
      ));
    } catch (error) {
      console.error('Error generating image:', error);
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              status: 'ready_for_image',
              imageGenerating: false,
              imageUrl: null
            }
          : a
      ));
      alert('Failed to generate image. Please try again.');
    }
  };

  // Translation Approval Handlers
  const handleApproveChineseTranslation = async (articleId) => {
    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_translation',
          articleId: articleId,
          language: 'chinese',
          approvedBy: user.id,
          approverEmail: user.email
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update UI to show approval
        setArticles(prev => prev.map(a => 
          a.id === articleId 
            ? { 
                ...a, 
                chineseTranslationApproved: true,
                chineseApprovedBy: user.email,
                chineseApprovedAt: new Date().toISOString(),
                status: data.article?.status || a.status
              }
            : a
        ));
        console.log('✅ Chinese translation approved');
      }
    } catch (error) {
      console.error('❌ Error approving Chinese translation:', error);
      alert('Failed to approve translation. Please try again.');
    }
  };

  const handleApproveKoreanTranslation = async (articleId) => {
    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_translation',
          articleId: articleId,
          language: 'korean',
          approvedBy: user.id,
          approverEmail: user.email
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update UI to show approval
        setArticles(prev => prev.map(a => 
          a.id === articleId 
            ? { 
                ...a, 
                koreanTranslationApproved: true,
                koreanApprovedBy: user.email,
                koreanApprovedAt: new Date().toISOString(),
                status: data.article?.status || a.status
              }
            : a
        ));
        console.log('✅ Korean translation approved');
      }
    } catch (error) {
      console.error('❌ Error approving Korean translation:', error);
      alert('Failed to approve translation. Please try again.');
    }
  };
  
  // Stock Photo Handlers - Add after existing handlers
  const handleSearchStockPhotos = async (articleId) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { ...a, searchingStockPhotos: true }
        : a
    ));

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_stock_photos',
          title: article.displayTitle || article.aiTitle || article.originalTitle,
          topic: article.topic,
          content: article.fullContent,
          articleId: articleId
        }),
      });

      if (!response.ok) throw new Error('Failed to search stock photos');
      const data = await response.json();
      
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              searchingStockPhotos: false,
              stockPhotos: data.photos,
              showStockPhotoSelector: true,
              searchTerms: data.searchTerms
            }
          : a
      ));
    } catch (error) {
      console.error('Error searching stock photos:', error);
      setArticles(prev => prev.map(a => 
        a.id === articleId ? { ...a, searchingStockPhotos: false, stockPhotos: [] } : a
      ));
      alert('Failed to search stock photos. Please try again.');
    }
  };

  const handleSelectStockPhoto = async (articleId, photo) => {
    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'select_stock_photo',
          articleId: articleId,
          photoUrl: photo.url,
          photoData: photo
        }),
      });

      if (!response.ok) throw new Error('Failed to select stock photo');
      const data = await response.json();
      
      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              imageUrl: data.imageUrl,
              imageGenerated: false,
              imageSource: 'stock',
              imageAttribution: data.attribution,
              showStockPhotoSelector: false,
              status: 'ready_for_publication'
            }
          : a
      ));
    } catch (error) {
      console.error('Error selecting stock photo:', error);
      alert('Failed to select stock photo. Please try again.');
    }
  };

  const handleSearchStockPhotosWithTerms = async (articleId, customTerms) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    setArticles(prev => prev.map(a => 
      a.id === articleId 
        ? { ...a, searchingStockPhotos: true, editingSearchTerms: false }
        : a
    ));

    try {
      const response = await fetch(window.location.origin + '/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_stock_photos_direct',
          searchTerms: customTerms,
          articleId: articleId
        }),
      });

      if (!response.ok) throw new Error('Failed to search with custom terms');
      const data = await response.json();

      setArticles(prev => prev.map(a => 
        a.id === articleId 
          ? { 
              ...a, 
              searchingStockPhotos: false,
              stockPhotos: data.photos,
              showStockPhotoSelector: true,
              searchTerms: customTerms
            }
          : a
      ));
    } catch (error) {
      console.error('Error searching with custom terms:', error);
      setArticles(prev => prev.map(a => 
        a.id === articleId ? { ...a, searchingStockPhotos: false } : a
      ));
      alert('Failed to search with custom terms. Please try again.');
    }
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

  const ArticlePreview = ({ article }) => (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h4 className="font-medium text-blue-900 mb-2">📄 {article.originalTitle}</h4>
      <div className="space-y-2 text-sm">
        <p><strong>Source:</strong> {article.source}</p>
        <p><strong>Topic:</strong> {article.topic}</p>
        <p><strong>Priority:</strong> 
          <span className={`ml-1 font-medium ${
            article.priority === 'high' ? 'text-red-600' : 
            article.priority === 'medium' ? 'text-orange-600' : 'text-gray-600'
          }`}>
            {article.priority}
          </span>
        </p>
        <p><strong>Relevance Score:</strong> {article.relevanceScore}/10</p>
        {article.shortDescription && (
          <div>
            <strong>Preview:</strong>
            <p className="text-gray-700 mt-1 italic">"{article.shortDescription}"</p>
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <a 
            href={article.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs bg-white px-2 py-1 rounded border"
          >
            <ExternalLink className="w-3 h-3" />
            Read Original
          </a>
        </div>
      </div>
    </div>
  );

  const FilterControls = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filters & Sorting</h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <Filter className="w-4 h-4" />
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>
      
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Keyword Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🔍 Search Articles
            </label>
            <div className="flex">
              <input
                id="filter-search-input"
                type="text"
                defaultValue={filters.keyword}
                onBlur={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setFilters(prev => ({ ...prev, keyword: e.target.value }));
                  }
                }}
                className="flex-1 p-2 border border-gray-300 rounded-l text-sm"
                placeholder="Search titles, content, author, translations..."
              />
              <button
                onClick={() => {
                  const input = document.getElementById('filter-search-input');
                  setFilters(prev => ({ ...prev, keyword: input.value }));
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-r hover:bg-blue-700 border border-l-0 border-blue-600 hover:border-blue-700 text-sm font-medium"
              >
                Search
              </button>
            </div>
            {filters.keyword && (
              <div className="mt-1 text-xs text-gray-500">
                Found {filteredArticles.length} articles containing "{filters.keyword}"
              </div>
            )}
          </div>

          {/* Status Group Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Group</label>
            <select
              value={filters.statusGroup || 'all'}
              onChange={(e) => setFilters(prev => ({ ...prev, statusGroup: e.target.value, status: 'all' }))}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            >
              <option value="all">All Groups</option>
              <option value="unreviewed">📥 Unreviewed</option>
              <option value="in_process">⚙️ In Process</option>
              <option value="published">✅ Published</option>
            </select>
          </div>
          
          {/* Detailed Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="pending_synthesis">Pending Synthesis</option>
              <option value="title_review">Title Review</option>
              <option value="summary_review">Summary Review</option>
              <option value="ready_for_translation">Ready for Translation</option>
              <option value="chinese_translation_pending">🇨🇳 Chinese Pending</option>
              <option value="korean_translation_pending">🇰🇷 Korean Pending</option>
              <option value="translation_review">Translation Review</option>
              <option value="translations_approved">✅ Translations Approved</option>
              <option value="ready_for_image">Ready for Image</option>
              <option value="ready_for_publication">Ready for Publication</option>
              <option value="published">Published</option>
            </select>
          </div>

          {/* Topic Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
            <select
              value={filters.topic}
              onChange={(e) => setFilters(prev => ({ ...prev, topic: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            >
              <option value="all">All Topics</option>
              {getUniqueValues('topic').map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={filters.source}
              onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            >
              <option value="all">All Sources</option>
              {getUniqueValues('source').map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>

          {/* Relevance Score Range */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Relevance Score: {filters.relevanceMin} - {filters.relevanceMax}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={filters.relevanceMin}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  relevanceMin: parseFloat(e.target.value) 
                }))}
                className="flex-1"
              />
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={filters.relevanceMax}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  relevanceMax: parseFloat(e.target.value) 
                }))}
                className="flex-1"
              />
            </div>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            >
              <option value="date-desc">Date (Newest First)</option>
              <option value="date-asc">Date (Oldest First)</option>
              <option value="relevance-desc">Relevance (High to Low)</option>
              <option value="relevance-asc">Relevance (Low to High)</option>
              <option value="priority">Priority (High to Low)</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({
                  status: 'all',
                  statusGroup: 'all',
                  topic: 'all',
                  priority: 'all',
                  relevanceMin: 0,
                  relevanceMax: 10,
                  source: 'all',
                  keyword: ''
                });
                setSortBy('date-desc');
              }}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredArticles.length} of {articles.filter(a => a.status !== 'discarded').length} articles
      </div>
    </div>
  );
  
  const ArticlePipeline = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">Content Pipeline</h2>
            {lastUpdated && (
              <p className="text-sm text-gray-500">
                Last updated: {new Date(lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
          
          {/* Quick Search */}
          <div className="flex-1 max-w-md mx-4">
            <div className="relative flex">
              <div className="relative flex-1">
                <input
                  id="header-search-input"
                  type="text"
                  defaultValue={filters.keyword}
                  onBlur={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFilters(prev => ({ ...prev, keyword: e.target.value }));
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-l-lg text-sm"
                  placeholder="Search articles..."
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <button
                onClick={() => {
                  const input = document.getElementById('header-search-input');
                  setFilters(prev => ({ ...prev, keyword: input.value }));
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 border border-l-0 border-blue-600 hover:border-blue-700 text-sm font-medium"
              >
                Search
              </button>
            </div>
          </div>

          <button 
            onClick={() => setShowManualAdd(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Manual Add Article
          </button>
        </div>

      <FilterControls />
      
      {filteredArticles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Articles Found</h3>
          <p className="text-gray-600">
            {articles.filter(a => a.status !== 'discarded').length === 0 
              ? "Upload your dashboard_data.json file to GitHub to see your scraped articles here."
              : "Try adjusting your filters to see more articles."
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredArticles.map(article => (
            <div key={article.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(article.status)}`}>
                      {getStatusIcon(article.status)}
                      {article.status === 'chinese_translation_pending' ? '🇨🇳 Chinese Pending' :
                       article.status === 'korean_translation_pending' ? '🇰🇷 Korean Pending' :
                       article.status === 'translations_approved' ? '✅ Translations Approved' :
                       article.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-500">{article.source}</span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-500">{article.scrapedDate}</span>
                  </div>

                  {/* Article Preview for pending synthesis */}
                  {article.status === 'pending_synthesis' && (
                    <ArticlePreview article={article} />
                  )}
                  
                  {/* Title Section */}
                  <div className="mb-3">
                    <div className="mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {article.displayTitle || article.aiTitle || article.originalTitle}
                      </h3>
                      {(article.aiTitle || article.displayTitle) && article.originalTitle !== (article.displayTitle || article.aiTitle) && (
                        <p className="text-sm text-gray-500 mt-1">
                          Original: {article.originalTitle}
                        </p>
                      )}
                    </div>
                    
                    {article.aiTitle && article.status === 'title_review' && (
                      <div className="bg-blue-50 p-3 rounded-lg mb-3">
                        <div className="text-sm text-gray-700">
                          <strong>AI-Generated Title:</strong>
                          {article.editingTitle ? (
                            <div className="mt-2">
                              <input
                                id={`title-edit-${article.id}`}
                                type="text"
                                defaultValue={article.aiTitle}
                                onBlur={(e) => handleEditTitle(article.id, e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded text-base font-medium"
                              />
                              <div className="flex gap-2 mt-2">
                                <button 
                                  onClick={() => {
                                    console.log('APPROVE TITLE BUTTON CLICKED!', article.id);
                                    const input = document.getElementById(`title-edit-${article.id}`);
                                    console.log('Input found:', !!input);
                                    if (input) {
                                      console.log('Input value:', input.value);
                                      handleEditTitle(article.id, input.value);
                                      handleApproveTitle(article.id);
                                    }
                                  }}
                                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                >
                                  Approve Title
                                </button>
                                <button 
                                  onClick={() => {
                                    console.log('CANCEL TITLE BUTTON CLICKED!', article.id);
                                    setArticles(prev => prev.map(a => 
                                      a.id === article.id ? {...a, editingTitle: false} : a
                                    ));
                                  }}
                                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="mt-1 font-medium text-gray-900">
                                {article.aiTitle}
                              </div>
                              <div className="flex gap-2 mt-2">
                                <button 
                                  onClick={() => handleApproveTitle(article.id)}
                                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                >
                                  Approve Title
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setArticles(prev => prev.map(a => 
                                      a.id === article.id ? {...a, editingTitle: true} : a
                                    ));
                                  }}
                                  className="text-purple-600 hover:text-purple-800 font-medium text-xs"
                                >
                                  Edit Title
                                </button>
                                <button 
                                  onClick={() => handleGenerateTitle(article.id)}
                                  className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                                >
                                  Regenerate
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-2 space-y-2">
                    {/* Dateline Editor */}
                    <div>
                      {article.editingDateline ? (
                        <div className="flex items-center gap-2">
                          <input
                            id={`dateline-edit-${article.id}`}
                            type="text"
                            defaultValue={article.dateline || ''}
                            onBlur={(e) => handleEditDateline(article.id, e.target.value)}
                            className="flex-1 p-1 border border-gray-300 rounded text-sm font-bold uppercase"
                            placeholder="CITY NAME"
                          />
                          <button 
                            onClick={async () => {
                              const input = document.getElementById(`dateline-edit-${article.id}`);
                              if (input) {
                                await handleEditDateline(article.id, input.value.toUpperCase());
                                setArticles(prev => prev.map(a => 
                                  a.id === article.id ? {...a, editingDateline: false} : a
                                ));
                              }
                            }}
                            className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => {
                              setArticles(prev => prev.map(a => 
                                a.id === article.id ? {...a, editingDateline: false} : a
                              ));
                            }}
                            className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {article.dateline ? (
                            <p className="text-sm font-bold text-gray-900 uppercase">
                              {article.dateline} —
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No dateline</p>
                          )}
                          <button 
                            onClick={() => {
                              setArticles(prev => prev.map(a => 
                                a.id === article.id ? {...a, editingDateline: true} : a
                              ));
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                            title="Edit dateline"
                          >
                            📍
                          </button>
                        </div>
                      )}
                    </div>
                  
                    {/* Author Editor */}
                    <div>
                      {article.editingAuthor ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">By</span>
                          <input
                            id={`author-edit-${article.id}`}
                            type="text"
                            defaultValue={article.author || ''}
                            onBlur={(e) => handleEditAuthor(article.id, e.target.value)}
                            className="flex-1 p-1 border border-gray-300 rounded text-sm"
                            placeholder="Enter author name"
                          />
                          <button 
                            onClick={async () => {
                              const input = document.getElementById(`author-edit-${article.id}`);
                              if (input) {
                                try {
                                  // Save to backend
                                  const response = await fetch(window.location.origin + '/api/ai', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      action: 'update_content',
                                      articleId: article.id,
                                      updates: {
                                        author: input.value
                                      }
                                    }),
                                  });
                          
                                  if (response.ok) {
                                    handleEditAuthor(article.id, input.value);
                                    setArticles(prev => prev.map(a => 
                                      a.id === article.id ? {...a, editingAuthor: false} : a
                                    ));
                                    console.log('✅ Author saved successfully');
                                  } else {
                                    throw new Error('Failed to save author');
                                  }
                                } catch (error) {
                                  console.error('❌ Error saving author:', error);
                                  alert('Failed to save author. Please try again.');
                                }
                              }
                            }}
                            className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => {
                              setArticles(prev => prev.map(a => 
                                a.id === article.id ? {...a, editingAuthor: false} : a
                              ));
                            }}
                            className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-600">
                            By {getAuthorDisplay(article.author, article.source)}
                          </p>
                          <button 
                            onClick={() => {
                              setArticles(prev => prev.map(a => 
                                a.id === article.id ? {...a, editingAuthor: true} : a
                              ));
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                            title="Edit author"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Image Prompt Editor */}
                  {article.showPromptEditor && (
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <h4 className="font-medium text-blue-900 mb-2">🎨 Image Generation Prompt</h4>
                      <div className="text-sm text-blue-700 mb-2">
                        Review and edit the AI-generated prompt below, then click "Generate Image" to create the image.
                      </div>
                      <textarea
                        id={`image-prompt-${article.id}`}
                        defaultValue={article.imagePrompt || ''}
                        onBlur={(e) => handleEditImagePrompt(article.id, e.target.value)}
                        className="w-full p-3 border border-blue-200 rounded resize-none text-sm"
                        rows="4"
                        placeholder="Image generation prompt will appear here..."
                      />
                      <div className="flex gap-2 mt-3">
                        <button 
                          onClick={() => handleGenerateImage(article.id)}
                          disabled={!article.imagePrompt || article.imageGenerating}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
                        >
                          {article.imageGenerating ? 'Generating Image...' : 'Generate Image'}
                        </button>
                        <button 
                          onClick={() => setArticles(prev => prev.map(a => 
                            a.id === article.id ? {...a, showPromptEditor: false} : a
                          ))}
                          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Stock Photo Selector - Add this section */}
                  {article.showStockPhotoSelector && (
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-blue-900">📸 Choose a Stock Photo</h4>
                        <button 
                          onClick={() => setArticles(prev => prev.map(a => 
                            a.id === article.id ? {...a, showStockPhotoSelector: false} : a
                          ))}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ✕
                        </button>
                      </div>
                      
                      {article.searchTerms && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-blue-900">Search Terms:</label>
                            <button
                              onClick={() => setArticles(prev => prev.map(a => 
                                a.id === article.id ? {...a, editingSearchTerms: !a.editingSearchTerms} : a
                              ))}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              {article.editingSearchTerms ? 'Cancel' : 'Edit'}
                            </button>
                          </div>
                          
                          {article.editingSearchTerms ? (
                            <div>
                              <input
                                id={`search-terms-${article.id}`}
                                type="text"
                                defaultValue={article.searchTerms.join(', ')}
                                className="w-full p-2 border border-blue-200 rounded text-sm"
                                placeholder="Enter search terms separated by commas"
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById(`search-terms-${article.id}`);
                                  const newTerms = input.value.split(',').map(term => term.trim()).filter(term => term);
                                  handleSearchStockPhotosWithTerms(article.id, newTerms);
                                }}
                                className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                              >
                                Search with New Terms
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm text-blue-700">
                              {article.searchTerms.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                        {article.stockPhotos?.map((photo, index) => (
                          <div key={`${photo.source}-${photo.id}`} className="relative group cursor-pointer">
                            <div className="aspect-square overflow-hidden rounded border hover:border-blue-500 hover:shadow-lg transition-all">
                              <img 
                                src={photo.thumb || photo.url}
                                alt={photo.description}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onClick={() => handleSelectStockPhoto(article.id, photo)}
                              />
                            </div>
                            
                            {/* Preview overlay on hover */}
                            <div 
                              className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded flex items-center justify-center cursor-pointer"
                              onClick={() => handleSelectStockPhoto(article.id, photo)}
                            >
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                <div className="bg-white rounded-full p-2 shadow-lg">
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                            
                            {/* Info overlay */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white text-xs p-2 rounded-b opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="truncate font-medium">{photo.photographer}</div>
                              <div className="text-gray-300 capitalize">{photo.source}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {(!article.stockPhotos || article.stockPhotos.length === 0) && (
                        <div className="text-center py-4 text-blue-600">
                          No stock photos found. Try the AI image generator instead.
                        </div>
                      )}
                    </div>
                  )}
        
                  {/* Enhanced image display with attribution and change option */}
                  {article.imageUrl && (
                    <div className="mb-4">
                      <div className="relative group">
                        <img 
                          src={article.imageUrl} 
                          alt={`Image for: ${article.displayTitle || article.aiTitle || article.originalTitle}`}
                          className="w-full max-w-md mx-auto rounded-lg shadow-md"
                        />
                        
                        {/* Change image overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {article.imageSource === 'stock' && (
                              <button
                                onClick={() => setArticles(prev => prev.map(a => 
                                  a.id === article.id ? {
                                    ...a, 
                                    showStockPhotoSelector: true,
                                    stockPhotos: a.stockPhotos || [],
                                    searchTerms: a.searchTerms || ['news', 'current events']
                                  } : a
                                ))}
                                className="bg-white text-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors font-medium text-sm"
                              >
                                📸 Change Stock Photo
                              </button>
                            )}
                            {article.imageSource !== 'stock' && (
                              <button
                                onClick={() => setArticles(prev => prev.map(a => 
                                  a.id === article.id ? {
                                    ...a, 
                                    showPromptEditor: true,
                                    imagePrompt: a.imagePrompt || ''
                                  } : a
                                ))}
                                className="bg-white text-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors font-medium text-sm"
                              >
                                🎨 Change AI Image
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {article.imageAttribution && (
                        <div className="text-xs text-gray-500 mt-1 text-center">
                          Photo by{' '}
                          <a 
                            href={article.imageAttribution.photographerUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {article.imageAttribution.photographer}
                          </a>
                          {' '}on{' '}
                          <span className="capitalize">{article.imageAttribution.source}</span>
                        </div>
                      )}
                      
                      {/* Quick change buttons below image */}
                      <div className="flex justify-center gap-2 mt-2">
                        {article.imageSource === 'stock' && (
                          <button
                            onClick={() => setArticles(prev => prev.map(a => 
                              a.id === article.id ? {
                                ...a, 
                                showStockPhotoSelector: true,
                                stockPhotos: a.stockPhotos || [],
                                searchTerms: a.searchTerms || ['news', 'current events']
                              } : a
                            ))}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Choose Different Stock Photo
                          </button>
                        )}
                        <button
                          onClick={() => setArticles(prev => prev.map(a => 
                            a.id === article.id ? {
                              ...a, 
                              imageUrl: null,
                              imageAttribution: null,
                              imageSource: null,
                              status: 'ready_for_image'
                            } : a
                          ))}
                          className="text-xs text-red-600 hover:text-red-800 underline"
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {article.aiSummary && (
                    <div className="bg-gray-50 p-3 rounded-lg mb-3">
                      <div className="text-sm text-gray-700">
                        <strong>AI Summary:</strong> 
                        {article.editingSummary ? (
                          <div className="mt-2">
                            <textarea
                              id={`summary-edit-${article.id}`}
                              defaultValue={article.aiSummary.replace(/<br>/g, '\n')}
                              onBlur={(e) => handleEditSummary(article.id, e.target.value.replace(/\n/g, '<br>'))}
                              className="w-full p-2 border border-gray-300 rounded resize-none"
                              rows="6"
                            />
                            <div className="flex gap-2 mt-2">
                              <button 
                                onClick={() => {
                                  console.log('APPROVE BUTTON CLICKED!', article.id);
                                  const textarea = document.getElementById(`summary-edit-${article.id}`);
                                  console.log('Textarea found:', !!textarea);
                                  if (textarea) {
                                    console.log('Textarea value:', textarea.value);
                                    handleEditSummary(article.id, textarea.value.replace(/\n/g, '<br>'));
                                    handleApproveSummary(article.id);
                                  }
                                }}
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                              >
                                Approve Summary
                              </button>
                              <button 
                                onClick={() => {
                                  console.log('CANCEL BUTTON CLICKED!', article.id);
                                  setArticles(prev => prev.map(a => 
                                    a.id === article.id ? {...a, editingSummary: false} : a
                                  ));
                                }}
                                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div 
                              className="mt-1"
                              dangerouslySetInnerHTML={{
                                __html: article.showFullSummary || article.aiSummary.length <= 300
                                  ? article.aiSummary
                                  : `${article.aiSummary.substring(0, 300)}...`
                              }}
                            />
                            <div className="flex gap-2 mt-2">
                              {article.aiSummary.length > 300 && (
                                <button 
                                  onClick={() => {
                                    const updatedArticle = {...article, showFullSummary: !article.showFullSummary};
                                    setArticles(prev => prev.map(a => 
                                      a.id === article.id ? updatedArticle : a
                                    ));
                                  }}
                                  className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                                >
                                  {article.showFullSummary ? 'Show less' : 'Read more'}
                                </button>
                              )}
                              {article.status === 'summary_review' && (
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setArticles(prev => prev.map(a => 
                                      a.id === article.id ? {...a, editingSummary: true} : a
                                    ));
                                  }}
                                  className="text-purple-600 hover:text-purple-800 font-medium text-xs"
                                >
                                  Edit Summary
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">Topic: <span className="font-medium">{article.topic}</span></span>
                    <span className="text-gray-600">Priority: <span className={`font-medium ${article.priority === 'high' ? 'text-red-600' : article.priority === 'medium' ? 'text-orange-600' : 'text-gray-900'}`}>{article.priority}</span></span>
                    <span className="text-gray-600">Score: <span className="font-medium">{article.relevanceScore}</span></span>
                    {article.imageGenerated && <span className="text-green-600">✓ Image Ready</span>}
                    {article.imageGenerating && <span className="text-blue-600">🎨 Generating Image...</span>}
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <button 
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {(article.translations.chinese || article.translations.korean) && (
                <div className="border-t pt-3 mt-3">
                  <div className="space-y-3">
                    {article.translations.chinese && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-900 mb-1">Chinese Translation:</h4>
                        {article.editingChinese ? (
                          <div>
                            <div className="space-y-2">
                              {article.translatedTitles?.chinese && (
                                <div>
                                  <label className="text-xs font-medium text-gray-700">Chinese Title:</label>
                                  <input
                                    id={`chinese-title-edit-${article.id}`}
                                    type="text"
                                    defaultValue={article.translatedTitles.chinese}
                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                              )}
                              <div>
                                <label className="text-xs font-medium text-gray-700">Chinese Summary:</label>
                                <textarea
                                  id={`chinese-edit-${article.id}`}
                                  defaultValue={article.translations.chinese.replace(/<br><br>/g, '\n\n').replace(/<br>/g, '\n')}
                                  onBlur={(e) => handleEditTranslation(article.id, 'chinese', e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded resize-none text-sm"
                                  rows="4"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-1">
                              <button 
                                onClick={async (e) => {
                                  e.preventDefault();
                                  const textarea = document.getElementById(`chinese-edit-${article.id}`);
                                  const titleInput = document.getElementById(`chinese-title-edit-${article.id}`);
                                  
                                  if (textarea && titleInput) {
                                    try {
                                      // Save the translation content
                                      handleEditTranslation(article.id, 'chinese', textarea.value.replace(/\n/g, '<br>'));
                                      
                                      // Save the translated title to backend
                                      const response = await fetch(window.location.origin + '/api/ai', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          action: 'update_content',
                                          articleId: article.id,
                                          updates: {
                                            translatedTitles: {
                                              ...article.translatedTitles,
                                              chinese: titleInput.value
                                            }
                                          }
                                        }),
                                      });
                              
                                      if (response.ok) {
                                        // Update UI with saved title
                                        setArticles(prev => prev.map(a => 
                                          a.id === article.id ? {
                                            ...a, 
                                            editingChinese: false,
                                            translatedTitles: {
                                              ...a.translatedTitles,
                                              chinese: titleInput.value
                                            }
                                          } : a
                                        ));
                                        console.log('✅ Chinese title and translation saved successfully');
                                      } else {
                                        throw new Error('Failed to save Chinese title');
                                      }
                                    } catch (error) {
                                      console.error('❌ Error saving Chinese title:', error);
                                      alert('Failed to save Chinese title. Please try again.');
                                    }
                                  }
                                }}
                                className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm text-gray-700">
                              {article.translatedTitles?.chinese && (
                                <div className="mb-3 p-2 bg-blue-50 rounded">
                                  <strong>Title:</strong> {article.translatedTitles.chinese}
                                </div>
                              )}
                              <div>
                                <strong>Summary:</strong>
                                <div 
                                  className="mt-1"
                                  dangerouslySetInnerHTML={{
                                    __html: article.showFullChinese || article.translations.chinese.length <= 200
                                      ? article.translations.chinese
                                      : `${article.translations.chinese.substring(0, 200)}...`
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-1">
                              {article.translations.chinese.length > 200 && (
                                <button 
                                  onClick={() => {
                                    const updatedArticle = {...article, showFullChinese: !article.showFullChinese};
                                    setArticles(prev => prev.map(a => 
                                      a.id === article.id ? updatedArticle : a
                                    ));
                                  }}
                                  className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                                >
                                  {article.showFullChinese ? 'Show less' : 'Read more'}
                                </button>
                              )}
                              {(article.status === 'translation_review' || article.status === 'ready_for_translation') && article.translations.chinese && article.translations.chinese !== 'Translating...' && (
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setArticles(prev => prev.map(a => 
                                      a.id === article.id ? {...a, editingChinese: true} : a
                                    ));
                                  }}
                                  className="text-purple-600 hover:text-purple-800 font-medium text-xs"
                                >
                                  Edit
                                </button>
                              )}
                              {article.translations.chinese && article.translations.chinese !== 'Translating...' && (
                                <>
                                  {!article.chineseTranslationApproved && canUserPerformAction('approve_chinese_translation') && (
                                    <button 
                                      onClick={() => handleApproveChineseTranslation(article.id)}
                                      className="text-green-600 hover:text-green-800 font-medium text-xs"
                                    >
                                      ✅ Approve Chinese
                                    </button>
                                  )}
                                  {article.chineseTranslationApproved && (
                                    <span className="text-green-600 font-medium text-xs">
                                      ✅ Approved by {article.chineseApprovedBy}
                                    </span>
                                  )}
                                  <button 
                                    onClick={() => {
                                      // Force save any edits before re-translating
                                      if (article.editingSummary) {
                                        const textarea = document.getElementById(`summary-edit-${article.id}`);
                                        if (textarea) {
                                          handleEditSummary(article.id, textarea.value.replace(/\n/g, '<br>'));
                                        }
                                      }
                                      handleTranslateArticle(article.id, 'chinese');
                                    }}
                                    className="text-orange-600 hover:text-orange-800 font-medium text-xs"
                                  >
                                    Regenerate
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {article.translations.korean && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-900 mb-1">Korean Translation:</h4>
                        {article.editingKorean ? (
                          <div>
                            <div className="space-y-2">
                              {article.translatedTitles?.korean && (
                                <div>
                                  <label className="text-xs font-medium text-gray-700">Korean Title:</label>
                                  <input
                                    id={`korean-title-edit-${article.id}`}
                                    type="text"
                                    defaultValue={article.translatedTitles.korean}
                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                              )}
                              <div>
                                <label className="text-xs font-medium text-gray-700">Korean Summary:</label>
                                <textarea
                                  id={`korean-edit-${article.id}`}
                                  defaultValue={article.translations.korean.replace(/<br><br>/g, '\n\n').replace(/<br>/g, '\n')}
                                  onBlur={(e) => handleEditTranslation(article.id, 'korean', e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded resize-none text-sm"
                                  rows="4"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-1">
                              <button 
                                onClick={async (e) => {
                                  e.preventDefault();
                                  const textarea = document.getElementById(`korean-edit-${article.id}`);
                                  const titleInput = document.getElementById(`korean-title-edit-${article.id}`);
                                  
                                  if (textarea && titleInput) {
                                    try {
                                      // Save the translation content
                                      handleEditTranslation(article.id, 'korean', textarea.value.replace(/\n/g, '<br>'));
                                      
                                      // Save the translated title to backend
                                      const response = await fetch(window.location.origin + '/api/ai', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          action: 'update_content',
                                          articleId: article.id,
                                          updates: {
                                            translatedTitles: {
                                              ...article.translatedTitles,
                                              korean: titleInput.value
                                            }
                                          }
                                        }),
                                      });
                              
                                      if (response.ok) {
                                        // Update UI with saved title
                                        setArticles(prev => prev.map(a => 
                                          a.id === article.id ? {
                                            ...a, 
                                            editingKorean: false,
                                            translatedTitles: {
                                              ...a.translatedTitles,
                                              korean: titleInput.value
                                            }
                                          } : a
                                        ));
                                        console.log('✅ Korean title and translation saved successfully');
                                      } else {
                                        throw new Error('Failed to save Korean title');
                                      }
                                    } catch (error) {
                                      console.error('❌ Error saving Korean title:', error);
                                      alert('Failed to save Korean title. Please try again.');
                                    }
                                  }
                                }}
                                className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm text-gray-700">
                              {article.translatedTitles?.korean && (
                                <div className="mb-3 p-2 bg-blue-50 rounded">
                                  <strong>Title:</strong> {article.translatedTitles.korean}
                                </div>
                              )}
                              <div>
                                <strong>Summary:</strong>
                                <div 
                                  className="mt-1"
                                  dangerouslySetInnerHTML={{
                                    __html: article.showFullKorean || article.translations.korean.length <= 200
                                      ? article.translations.korean
                                      : `${article.translations.korean.substring(0, 200)}...`
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-1">
                              {article.translations.korean.length > 200 && (
                                <button 
                                  onClick={() => {
                                    const updatedArticle = {...article, showFullKorean: !article.showFullKorean};
                                    setArticles(prev => prev.map(a => 
                                      a.id === article.id ? updatedArticle : a
                                    ));
                                  }}
                                  className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                                >
                                  {article.showFullKorean ? 'Show less' : 'Read more'}
                                </button>
                              )}
                              {(article.status === 'translation_review' || article.status === 'ready_for_translation') && article.translations.korean && article.translations.korean !== 'Translating...' && (
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setArticles(prev => prev.map(a => 
                                      a.id === article.id ? {...a, editingKorean: true} : a
                                    ));
                                  }}
                                  className="text-purple-600 hover:text-purple-800 font-medium text-xs"
                                >
                                  Edit
                                </button>
                              )}
                              {article.translations.korean && article.translations.korean !== 'Translating...' && (
                                <>
                                  {!article.koreanTranslationApproved && canUserPerformAction('approve_korean_translation') && (
                                    <button 
                                      onClick={() => handleApproveKoreanTranslation(article.id)}
                                      className="text-green-600 hover:text-green-800 font-medium text-xs"
                                    >
                                      ✅ Approve Korean
                                    </button>
                                  )}
                                  {article.koreanTranslationApproved && (
                                    <span className="text-green-600 font-medium text-xs">
                                      ✅ Approved by {article.koreanApprovedBy}
                                    </span>
                                  )}
                                  <button 
                                    onClick={() => {
                                      // Force save any edits before re-translating
                                      if (article.editingSummary) {
                                        const textarea = document.getElementById(`summary-edit-${article.id}`);
                                        if (textarea) {
                                          handleEditSummary(article.id, textarea.value.replace(/\n/g, '<br>'));
                                        }
                                      }
                                      handleTranslateArticle(article.id, 'korean');
                                    }}
                                    className="text-orange-600 hover:text-orange-800 font-medium text-xs"
                                  >
                                    Regenerate
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="border-t pt-3 mt-3">
                <div className="flex gap-2 flex-wrap">
                  {article.status === 'pending_synthesis' && canUserPerformAction('generate_title') && (
                    <>
                      <button 
                        onClick={() => handleGenerateTitle(article.id)}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3" />
                        Generate Punchy Title
                      </button>
                      <button 
                        onClick={() => handleDiscardArticle(article.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Discard Article
                      </button>
                    </>
                  )}
                  {article.status === 'generating_title' && (
                    <button 
                      disabled
                      className="px-3 py-1 bg-gray-400 text-white rounded text-sm cursor-not-allowed flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3 animate-spin" />
                      Generating Title...
                    </button>
                  )}

                  {(article.status === 'pending_synthesis' && (article.aiTitle || article.displayTitle)) && 
                   canUserPerformAction('generate_summary') && (
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

                  {article.status === 'summary_review' && !article.editingSummary && (
                    <button 
                      onClick={() => handleApproveSummary(article.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Approve Summary for Translation
                    </button>
                  )}

                  {article.status === 'ready_for_translation' && 
                   !article.translations.chinese && 
                   (canUserPerformAction('approve_chinese_translation') || userRole === 'admin') && (
                    <button 
                      onClick={() => {
                        // Force save any edits before translating
                        if (article.editingSummary) {
                          const textarea = document.getElementById(`summary-edit-${article.id}`);
                          if (textarea) {
                            handleEditSummary(article.id, textarea.value.replace(/\n/g, '<br>'));
                          }
                        }
                        handleTranslateArticle(article.id, 'chinese');
                      }}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Translate to Chinese
                    </button>
                  )}
                  {article.status === 'ready_for_translation' && 
                   !article.translations.korean && 
                   (canUserPerformAction('approve_korean_translation') || userRole === 'admin') && (
                    <button 
                      onClick={() => {
                        // Force save any edits before translating
                        if (article.editingSummary) {
                          const textarea = document.getElementById(`summary-edit-${article.id}`);
                          if (textarea) {
                            handleEditSummary(article.id, textarea.value.replace(/\n/g, '<br>'));
                          }
                        }
                        handleTranslateArticle(article.id, 'korean');
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Translate to Korean
                    </button>
                  )}
                  {article.status === 'in_translation' && (
                    <button 
                      disabled
                      className="px-3 py-1 bg-gray-400 text-white rounded text-sm cursor-not-allowed"
                    >
                      Translating...
                    </button>
                  )}

                  {article.status === 'translation_review' && !article.editingChinese && !article.editingKorean && (
                    <button 
                      onClick={() => handleApproveTranslations(article.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Approve Translations for Image
                    </button>
                  )}

                  {article.status === 'translations_approved' && canUserPerformAction('generate_image') && (
                    <button 
                      onClick={async () => {
                        // Move to ready_for_image status
                        const response = await fetch(window.location.origin + '/api/ai', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'update_status',
                            articleId: article.id,
                            status: 'ready_for_image'
                          }),
                        });
                        
                        if (response.ok) {
                          setArticles(prev => prev.map(a => 
                            a.id === article.id ? { ...a, status: 'ready_for_image' } : a
                          ));
                        }
                      }}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      ✅ Approve for Image Generation
                    </button>
                  )}

                  {article.status === 'ready_for_image' && (
                    <>
                      <button 
                        onClick={() => handleSearchStockPhotos(article.id)}
                        disabled={article.searchingStockPhotos}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                      >
                        {article.searchingStockPhotos ? 'Searching...' : '📸 Find Stock Photos'}
                      </button>
                      <button 
                        onClick={() => handleGenerateImagePrompt(article.id)}
                        disabled={article.generatingPrompt}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 text-sm"
                      >
                        {article.generatingPrompt ? 'Generating Prompt...' : '🎨 Generate AI Image'}
                      </button>
                    </>
                  )}
                  {article.status === 'generating_image' && (
                    <button 
                      disabled
                      className="px-3 py-1 bg-gray-400 text-white rounded text-sm cursor-not-allowed"
                    >
                      Generating Image...
                    </button>
                  )}

                  {article.status === 'ready_for_publication' && (
                    <>
                      <button 
                        onClick={() => handleGenerateImagePrompt(article.id)}
                        disabled={article.generatingPrompt}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm disabled:bg-gray-400"
                      >
                        {article.generatingPrompt ? 'Generating Prompt...' : 'Regenerate Image Prompt'}
                      </button>
                      <button 
                        onClick={() => handleApproveForPublication(article.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        Approve for Publication
                      </button>
                    </>
                  )}

                  {article.status === 'published' && (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                        ✓ Published
                      </span>
                      <button 
                        onClick={async () => {
                          if (confirm('Are you sure you want to unpublish this article?')) {
                            try {
                              // Save unpublished status to backend
                              const response = await fetch(window.location.origin + '/api/ai', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  action: 'update_status',
                                  articleId: article.id,
                                  status: 'ready_for_publication'
                                }),
                              });
                        
                              if (response.ok) {
                                console.log('✅ Unpublished status saved to backend');
                                
                                // Update UI after successful save
                                setArticles(prev => prev.map(a => 
                                  a.id === article.id 
                                    ? { ...a, status: 'ready_for_publication' }
                                    : a
                                ));
                              } else {
                                throw new Error('Failed to save unpublished status');
                              }
                            } catch (error) {
                              console.error('Error unpublishing article:', error);
                              alert('Failed to unpublish article. Please try again.');
                            }
                          }
                        }}
                        className="px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-xs"
                        title="Unpublish article"
                      >
                        Undo
                      </button>
                    </div>
                  )}

                  {/* Start Over Button - Show for any article that has AI processing */}
                  {(article.aiTitle || article.aiSummary || article.translations.chinese || article.translations.korean || article.imageUrl) && (
                    <button 
                      onClick={() => handleStartOver(article.id)}
                      className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm flex items-center gap-1"
                      title="Reset article to original state"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Start Over
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

    // Calculate live analytics from current article state
    const liveAnalytics = {
      total_articles: articles.filter(a => a.status !== 'discarded').length,
      articles_scraped_today: articles.filter(a => 
        a.scrapedDate === new Date().toISOString().split('T')[0] && 
        a.status !== 'discarded'
      ).length,
      pending_translation: articles.filter(a => 
        a.status === 'ready_for_translation' || 
        a.status === 'in_translation' || 
        a.status === 'translation_review'
      ).length,
      published_articles: articles.filter(a => a.status === 'published').length
    };
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Articles Scraped Today</p>
                <p className="text-3xl font-bold text-gray-900">{liveAnalytics.articles_scraped_today}</p>
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
                <p className="text-3xl font-bold text-gray-900">{liveAnalytics.pending_translation}</p>
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
                <p className="text-3xl font-bold text-gray-900">{liveAnalytics.published_articles}</p>
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
                <p className="text-3xl font-bold text-gray-900">{liveAnalytics.total_articles}</p>
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

  const DeletedArticles = () => {
    const deletedArticles = articles.filter(a => a.status === 'deleted' || a.status === 'discarded');
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Deleted & Discarded Articles</h2>
            <p className="text-sm text-gray-500">
              Articles that have been deleted or discarded. You can restore or permanently delete them.
            </p>
          </div>
        </div>
        
        {deletedArticles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Deleted or Discarded Articles</h3>
            <p className="text-gray-600">
              Deleted and discarded articles will appear here. You can restore them or delete them permanently.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {deletedArticles.map(article => (
              <div key={article.id} className={`border rounded-lg p-6 ${
                article.status === 'discarded' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        article.status === 'discarded' 
                          ? 'text-yellow-600 bg-yellow-100' 
                          : 'text-red-600 bg-red-100'
                      }`}>
                        {article.status === 'discarded' ? '📋 Discarded' : '🗑️ Deleted'}
                      </span>
                      <span className="text-xs text-gray-500">{article.source}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">{article.scrapedDate}</span>
                      {(article.deleted_at || article.discarded_at) && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">
                            {article.status === 'discarded' ? 'Discarded' : 'Deleted'}: {new Date(article.deleted_at || article.discarded_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {article.displayTitle || article.aiTitle || article.originalTitle}
                    </h3>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">Topic: <span className="font-medium">{article.topic}</span></span>
                      <span className="text-gray-600">Priority: <span className={`font-medium ${article.priority === 'high' ? 'text-red-600' : article.priority === 'medium' ? 'text-orange-600' : 'text-gray-900'}`}>{article.priority}</span></span>
                      <span className="text-gray-600">Score: <span className="font-medium">{article.relevanceScore}</span></span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-3 mt-3">
                  <div className="flex gap-2 flex-wrap">
                    <button 
                      onClick={() => handleRestoreArticle(article.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-1"
                    >
                      ♻️ Restore Article
                    </button>
                    <button 
                      onClick={() => handlePermanentDelete(article.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm flex items-center gap-1"
                    >
                      💀 Delete Permanently
                    </button>
                    <a 
                      href={article.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Original
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
              <button 
                onClick={async () => {
                  const { createClientComponentClient } = await import('@supabase/auth-helpers-nextjs');
                  const supabase = createClientComponentClient();
                  await supabase.auth.signOut();
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

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
              activeTab === 'deleted' 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('deleted')}
          >
            Deleted Articles ({articles.filter(a => a.status === 'deleted' || a.status === 'discarded').length})
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

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'pipeline' && <ArticlePipeline />}
        {activeTab === 'deleted' && <DeletedArticles />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'settings' && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
            <p className="text-gray-600">Settings panel coming soon - configure scraping sources, translation preferences, and publishing workflows.</p>
          </div>
        )}
      </div>

      {selectedArticle && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedArticle(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
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
                  <h3 className="font-semibold text-gray-900">{selectedArticle.displayTitle || selectedArticle.aiTitle || selectedArticle.originalTitle}</h3>
                  {(selectedArticle.aiTitle || selectedArticle.displayTitle) && selectedArticle.originalTitle !== (selectedArticle.displayTitle || selectedArticle.aiTitle) && (
                    <p className="text-sm text-gray-600 mt-1">
                      Original: {selectedArticle.originalTitle}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    {selectedArticle.source} • {getAuthorDisplay(selectedArticle.author, selectedArticle.source)} • {selectedArticle.scrapedDate}
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
                
                {selectedArticle.imageUrl && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Generated Image</h4>
                    <img 
                      src={selectedArticle.imageUrl} 
                      alt={`Generated image for: ${selectedArticle.displayTitle || selectedArticle.aiTitle || selectedArticle.originalTitle}`}
                      className="w-full max-w-lg rounded-lg shadow-md"
                    />
                  </div>
                )}
                
                {selectedArticle.aiSummary && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">AI Summary</h4>
                    <div 
                      className="text-gray-700 bg-gray-50 p-3 rounded-lg"
                      dangerouslySetInnerHTML={{ __html: selectedArticle.aiSummary }}
                    />
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Article Modal */}
      {showManualAdd && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => handleCancelManualAdd()}
        >
          <div 
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Add Article Manually</h2>
                <button 
                  onClick={handleCancelManualAdd}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {/* URL Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Article URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={manualAddUrl}
                      onChange={(e) => setManualAddUrl(e.target.value)}
                      placeholder="https://example.com/article-url"
                      className="flex-1 p-3 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={handleManualAddUrl}
                      disabled={loadingPreview}
                      className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {loadingPreview ? 'Loading...' : 'Preview'}
                    </button>
                  </div>
                </div>

                {/* Preview */}
                {manualAddPreview && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="font-medium text-gray-900 mb-3">Article Preview</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Title:</strong> {manualAddPreview.originalTitle}</p>
                      <p><strong>Source:</strong> {manualAddPreview.source}</p>
                      <p><strong>Author:</strong> {manualAddPreview.author}</p>
                      {manualAddPreview.shortDescription && (
                        <p><strong>Description:</strong> {manualAddPreview.shortDescription}</p>
                      )}
                      <p><strong>URL:</strong> <a href={manualAddPreview.originalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{manualAddPreview.originalUrl}</a></p>
                      <p><strong>Date:</strong> {manualAddPreview.scrapedDate}</p>
                      <p><strong>Priority:</strong> {manualAddPreview.priority}</p>
                      <p><strong>Relevance Score:</strong> {manualAddPreview.relevanceScore}/10</p>
                      {manualAddPreview.fullContent && manualAddPreview.fullContent !== 'Content will need to be manually added.' && (
                        <div className="mt-3 p-2 bg-gray-100 rounded text-xs">
                          <strong>Content Preview:</strong>
                          <p className="mt-1">{manualAddPreview.fullContent.substring(0, 300)}...</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={handleApproveManualAdd}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Add to Dashboard
                      </button>
                      <button
                        onClick={() => setManualAddPreview(null)}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        Edit Preview
                      </button>
                    </div>
                  </div>
                )}

                {!manualAddPreview && !loadingPreview && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Enter a URL above and click "Preview" to see article details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}  
    </div>
  );
}

export default function AAVMDashboard() {
  return (
    <AuthWrapper>
      <AAVMDashboardContent />
    </AuthWrapper>
  );
}

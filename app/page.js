'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit3, Globe, CheckCircle, Clock, AlertCircle, BarChart3, Settings } from 'lucide-react';

export default function AAVMDashboard() {
  // Sample data - in production this would come from your backend
  const [articles, setArticles] = useState([
    {
      id: 1,
      originalTitle: "'Voting rights gave you power:' The Voting Rights Act turns 59",
      source: "Associated Press",
      author: "Sarah Johnson",
      scrapedDate: "2025-08-07",
      originalUrl: "https://apnews.com/sample-1",
      status: "pending_synthesis",
      topic: "Politics",
      aiSummary: null,
      translations: { chinese: null, korean: null },
      imageGenerated: false,
      priority: "medium",
      relevanceScore: 7.0
    },
    {
      id: 2,
      originalTitle: "Immigrants who are crime victims and waiting for visas now face deportation",
      source: "NPR", 
      author: "Michael Chen",
      scrapedDate: "2025-08-07",
      originalUrl: "https://npr.com/sample-2",
      status: "ready_for_translation",
      topic: "Immigration",
      aiSummary: "New immigration policies are affecting crime victims who previously had protected status while waiting for visa approvals. The changes could impact thousands of immigrants who cooperated with law enforcement investigations, creating concerns about public safety and community trust.",
      translations: { chinese: null, korean: null },
      imageGenerated: false,
      priority: "high",
      relevanceScore: 8.1
    },
    {
      id: 3,
      originalTitle: "US Senators Wyden, Warren launch probe into UnitedHealth's network",
      source: "Reuters",
      author: "Lisa Park",
      scrapedDate: "2025-08-06", 
      originalUrl: "https://reuters.com/sample-3",
      status: "published",
      topic: "Healthcare",
      aiSummary: "Senators are investigating UnitedHealth's provider network practices following complaints about access to care and billing practices that particularly impact immigrant communities and non-English speakers.",
      translations: { 
        chinese: "参议员们正在调查联合健康保险公司的提供商网络实践，此前有投诉称其在护理访问和计费实践方面特别影响移民社区和非英语使用者。",
        korean: "상원의원들은 이민자 공동체와 비영어 사용자들에게 특히 영향을 미치는 치료 접근과 청구 관행에 대한 불만이 제기된 후 유나이티드헬스의 제공자 네트워크 관행을 조사하고 있습니다."
      },
      imageGenerated: true,
      priority: "medium",
      relevanceScore: 6.5
    },
    {
      id: 4,
      originalTitle: "ICE detainee found hanging by neck in detention facility",
      source: "Bloomberg",
      author: "David Kim",
      scrapedDate: "2025-08-07",
      originalUrl: "https://bloomberg.com/sample-4",
      status: "pending_synthesis",
      topic: "Immigration",
      aiSummary: null,
      translations: { chinese: null, korean: null },
      imageGenerated: false,
      priority: "high",
      relevanceScore: 8.0
    },
    {
      id: 5,
      originalTitle: "Brown University strikes agreement with White House to restore federal funding",
      source: "Wall Street Journal",
      author: "Jennifer Wu",
      scrapedDate: "2025-08-06",
      originalUrl: "https://wsj.com/sample-5",
      status: "ready_for_translation",
      topic: "Education", 
      aiSummary: "Brown University reached a settlement with federal authorities to restore funding after disputes over campus policies. The agreement includes provisions for enhanced reporting on discrimination and harassment cases.",
      translations: { chinese: null, korean: null },
      imageGenerated: false,
      priority: "medium",
      relevanceScore: 7.0
    }
  ]);

  const [activeTab, setActiveTab] = useState('pipeline');
  const [selectedArticle, setSelectedArticle] = useState(null);

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

  const ArticlePipeline = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Content Pipeline</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Manual Add Article
        </button>
      </div>
      
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
                      <strong>AI Summary:</strong> {article.aiSummary}
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
                <div className="grid grid-cols-2 gap-4">
                  {article.translations.chinese && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-900 mb-1">Chinese Translation:</h4>
                      <p className="text-sm text-gray-700 line-clamp-2">{article.translations.chinese}</p>
                    </div>
                  )}
                  {article.translations.korean && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-900 mb-1">Korean Translation:</h4>
                      <p className="text-sm text-gray-700 line-clamp-2">{article.translations.korean}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const Analytics = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Articles Scraped Today</p>
              <p className="text-3xl font-bold text-gray-900">33</p>
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
              <p className="text-3xl font-bold text-gray-900">8</p>
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
              <p className="text-3xl font-bold text-gray-900">156</p>
            </div>
            <div className="bg-green-100 p-2 rounded">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Reach</p>
              <p className="text-3xl font-bold text-gray-900">8.2K</p>
            </div>
            <div className="bg-purple-100 p-2 rounded">
              <Eye className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Content Performance by Topic</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Immigration articles</span>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div className="bg-red-600 h-2 rounded-full" style={{width: '85%'}}></div>
              </div>
              <span className="text-sm font-medium">85%</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Healthcare articles</span>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{width: '78%'}}></div>
              </div>
              <span className="text-sm font-medium">78%</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Politics articles</span>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{width: '72%'}}></div>
              </div>
              <span className="text-sm font-medium">72%</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Education articles</span>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{width: '68%'}}></div>
              </div>
              <span className="text-sm font-medium">68%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Article Details</h2>
                <button 
                  onClick={() => setSelectedArticle(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ×
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

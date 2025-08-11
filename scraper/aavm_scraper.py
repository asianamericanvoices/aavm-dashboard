import requests
import json
import sqlite3
import hashlib
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import time

class AAVMNewsScraper:
    def __init__(self, api_key: str, db_path: str = "aavm_articles.db"):
        """
        Initialize the AAVM News Scraper with Daily Snapshot System
        
        Args:
            api_key: Your Event Registry API key
            db_path: Path to SQLite database file
        """
        self.api_key = api_key
        self.db_path = db_path
        self.base_url = "https://eventregistry.org/api/v1/article/getArticles"
        
        # Create daily snapshots directory
        self.snapshots_dir = "daily_snapshots"
        os.makedirs(self.snapshots_dir, exist_ok=True)
        
        # Initialize database
        self.init_database()
        
        # Keywords for Asian American community relevance
        self.aa_keywords = [
            "asian american", "chinese american", "korean american", "vietnamese american",
            "immigration", "medicare", "healthcare", "education", "voting", "election",
            "hate crime", "discrimination", "cultural festival", "community center",
            "small business", "chinatown", "koreatown", "language access", "translation",
            "diaspora", "green card", "naturalization", "intergenerational"
        ]
        
        # Trusted news sources
        self.trusted_sources = [
            "reuters.com", "apnews.com", "bloomberg.com", "wsj.com", "npr.org",
            "nbcnews.com", "usatoday.com", "abcnews.go.com", "cnn.com", "politico.com"
        ]

    def init_database(self):
        """Initialize SQLite database with articles table"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                content TEXT,
                url TEXT UNIQUE NOT NULL,
                source_name TEXT,
                author TEXT,
                published_at TEXT,
                scraped_at TEXT,
                relevance_score REAL,
                status TEXT DEFAULT 'pending_synthesis',
                topic TEXT,
                priority TEXT DEFAULT 'medium',
                hash TEXT UNIQUE,
                daily_snapshot TEXT,
                in_dashboard BOOLEAN DEFAULT 1
            )
        ''')
        
        # Add new columns if they don't exist (for existing DBs)
        try:
            cursor.execute('ALTER TABLE articles ADD COLUMN daily_snapshot TEXT')
            cursor.execute('ALTER TABLE articles ADD COLUMN in_dashboard BOOLEAN DEFAULT 1')
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Columns already exist
        
        conn.commit()
        conn.close()

    def calculate_relevance_score(self, title: str, description: str = "") -> float:
        """Calculate relevance score - Enhanced for broader capture"""
        text = f"{title} {description}".lower()
        score = 2.0  # Base score
        
        # Direct AA keywords
        for keyword in self.aa_keywords:
            if keyword in text:
                if "asian american" in keyword:
                    score += 4.0
                else:
                    score += 2.0
        
        # Topic scoring
        high_relevance = ["immigration", "healthcare", "education", "voting", "discrimination", "policy"]
        medium_relevance = ["economy", "business", "community", "cultural", "federal", "government"]
        
        for topic in high_relevance:
            if topic in text:
                score += 1.5
                
        for topic in medium_relevance:
            if topic in text:
                score += 0.8
        
        # Geographic relevance
        locations = ["california", "new york", "texas", "georgia", "virginia", "washington", "hawaii"]
        for location in locations:
            if location in text:
                score += 0.3
        
        # News value boost
        score += 1.0
        
        return min(score, 10.0)

    def classify_topic(self, title: str, description: str = "") -> str:
        """Classify article topic"""
        text = f"{title} {description}".lower()
        
        if any(word in text for word in ["health", "medicare", "insurance", "hospital", "medical"]):
            return "Healthcare"
        elif any(word in text for word in ["economy", "job", "employment", "business", "market", "trade"]):
            return "Economy"
        elif any(word in text for word in ["election", "voting", "politics", "government", "policy"]):
            return "Politics"
        elif any(word in text for word in ["school", "education", "student", "university", "college"]):
            return "Education"
        elif any(word in text for word in ["immigration", "visa", "citizen", "border"]):
            return "Immigration"
        elif any(word in text for word in ["culture", "festival", "community", "celebration", "tradition"]):
            return "Culture"
        else:
            return "General"

    def determine_priority(self, relevance_score: float, published_hours_ago: float) -> str:
        """Determine priority based on relevance and recency"""
        if relevance_score >= 6.0 and published_hours_ago <= 24:
            return "high"
        elif relevance_score >= 4.0 and published_hours_ago <= 48:
            return "medium"
        else:
            return "low"

    def search_articles_by_topic(self, search_terms: List[str], max_articles: int = 50) -> List[Dict]:
        """Search for articles with enhanced parameters"""
        articles = []
        headers = {"Content-Type": "application/json"}
        
        for term in search_terms:
            payload = {
                "query": {
                    "$query": {
                        "$and": [
                            {
                                "$or": [
                                    {"keyword": term, "keywordLoc": "title"},
                                    {"keyword": term, "keywordLoc": "body"}
                                ]
                            },
                            {"$or": [{"sourceUri": src} for src in self.trusted_sources]}
                        ]
                    },
                    "$filter": {"forceMaxDataTimeWindow": "2"}  # Today + yesterday
                },
                "resultType": "articles",
                "articlesSortBy": "date",
                "articlesCount": 15,
                "apiKey": self.api_key
            }
            
            try:
                print(f"🔍 Searching for: {term}")
                response = requests.post(self.base_url, json=payload, headers=headers)
                response.raise_for_status()
                
                data = response.json()
                
                if 'articles' in data and 'results' in data['articles']:
                    results = data['articles']['results']
                    print(f"   Found {len(results)} articles")
                    articles.extend(results)
                else:
                    print(f"   No articles found for: {term}")
                
                time.sleep(1)
                
            except requests.exceptions.RequestException as e:
                print(f"❌ Error fetching articles for term '{term}': {e}")
                continue
            
            if len(articles) >= max_articles:
                break
        
        return articles[:max_articles]

    def search_general_headlines(self, max_per_source: int = 5) -> List[Dict]:
        """Fetch general headlines from today"""
        articles = []
        headers = {"Content-Type": "application/json"}
        
        for source in self.trusted_sources[:7]:
            payload = {
                "query": {
                    "$query": {
                        "$and": [
                            {"sourceUri": source}
                        ]
                    },
                    "$filter": {"forceMaxDataTimeWindow": "1"}  # Today only
                },
                "resultType": "articles",
                "articlesSortBy": "date",
                "articlesCount": max_per_source,
                "apiKey": self.api_key
            }
            
            try:
                print(f"🔍 Fetching today's headlines from: {source}")
                response = requests.post(self.base_url, json=payload, headers=headers)
                response.raise_for_status()
                
                data = response.json()
                
                if 'articles' in data and 'results' in data['articles']:
                    results = data['articles']['results']
                    print(f"   Found {len(results)} articles")
                    articles.extend(results)
                
                time.sleep(1)
                
            except requests.exceptions.RequestException as e:
                print(f"❌ Error fetching from {source}: {e}")
                continue
        
        return articles

    def process_article(self, article_data: Dict, daily_snapshot: str) -> Optional[Dict]:
        """Process article and add snapshot info"""
        try:
            title = article_data.get('title', '')
            description = article_data.get('body', '')[:500] if article_data.get('body') else ''
            url = article_data.get('url', '')
            
            if not title or not url:
                return None
            
            relevance_score = self.calculate_relevance_score(title, description)
            
            if relevance_score < 1.5:
                return None
            
            # Extract fields
            source_info = article_data.get('source', {})
            source_name = source_info.get('title', '') if source_info else ''
            author = article_data.get('author', '') or 'N/A'
            published_at = article_data.get('date', '')
            
            # Calculate hours since publication
            try:
                if published_at:
                    pub_date = datetime.fromisoformat(published_at.replace('Z', ''))
                    hours_ago = (datetime.now() - pub_date).total_seconds() / 3600
                else:
                    hours_ago = 24
            except:
                hours_ago = 24
            
            topic = self.classify_topic(title, description)
            priority = self.determine_priority(relevance_score, hours_ago)
            content_hash = hashlib.md5(f"{title}{url}".encode()).hexdigest()
            
            return {
                'title': title,
                'description': description,
                'content': article_data.get('body', ''),
                'url': url,
                'source_name': source_name,
                'author': author,
                'published_at': published_at,
                'relevance_score': relevance_score,
                'topic': topic,
                'priority': priority,
                'hash': content_hash,
                'daily_snapshot': daily_snapshot
            }
            
        except Exception as e:
            print(f"❌ Error processing article: {e}")
            return None

    def save_article(self, article: Dict) -> bool:
        """Save article to database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO articles 
                (title, description, content, url, source_name, author, published_at, 
                 scraped_at, relevance_score, topic, priority, hash, daily_snapshot, in_dashboard)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                article['title'],
                article['description'], 
                article['content'],
                article['url'],
                article['source_name'],
                article['author'],
                article['published_at'],
                datetime.now().isoformat(),
                article['relevance_score'],
                article['topic'],
                article['priority'],
                article['hash'],
                article['daily_snapshot'],
                1  # in_dashboard = True initially
            ))
            
            conn.commit()
            conn.close()
            return True
            
        except sqlite3.IntegrityError:
            print(f"   🔄 Duplicate: {article['title'][:50]}...")
            return False
        except Exception as e:
            print(f"❌ Error saving article: {e}")
            return False

    def run_daily_scrape(self, target_date: str = None) -> Dict:
        """
        Run daily scraping and create snapshot
        
        Args:
            target_date: Date string (YYYY-MM-DD), defaults to today
        """
        if target_date is None:
            target_date = datetime.now().strftime("%Y-%m-%d")
        
        print(f"🚀 Starting daily scrape for {target_date}")
        snapshot_filename = f"{target_date}_articles.json"
        snapshot_path = os.path.join(self.snapshots_dir, snapshot_filename)
        
        # Check if snapshot already exists
        if os.path.exists(snapshot_path):
            print(f"⚠️  Snapshot for {target_date} already exists!")
            response = input("Overwrite existing snapshot? (y/N): ")
            if response.lower() != 'y':
                print("❌ Scraping cancelled")
                return {}
        
        # Enhanced search terms
        search_terms = [
            "asian american", "immigration", "healthcare", "education policy",
            "voting rights", "hate crime", "medicare", "small business",
            "federal policy", "discrimination"
        ]
        
        print("\n🎯 Searching for targeted articles...")
        targeted_articles = self.search_articles_by_topic(search_terms, max_articles=50)
        
        print("\n📰 Fetching general headlines...")
        general_articles = self.search_general_headlines(max_per_source=5)
        
        # Combine and deduplicate
        all_articles = targeted_articles + general_articles
        seen_urls = set()
        unique_articles = []
        for article in all_articles:
            url = article.get('url', '')
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_articles.append(article)
        
        print(f"\n📊 Processing {len(unique_articles)} unique articles...")
        
        # Process articles
        daily_articles = []
        saved_to_db = []
        skipped_count = 0
        duplicate_count = 0
        
        for raw_article in unique_articles:
            processed = self.process_article(raw_article, target_date)
            
            if processed:
                # Always add to daily snapshot
                daily_articles.append({
                    'title': processed['title'],
                    'source': processed['source_name'],
                    'author': processed['author'],
                    'url': processed['url'],
                    'published_at': processed['published_at'],
                    'relevance_score': processed['relevance_score'],
                    'topic': processed['topic'],
                    'priority': processed['priority'],
                    'description': processed['description'][:200]
                })
                
                # Try to save to database (adds to master list)
                if self.save_article(processed):
                    saved_to_db.append(processed)
                    print(f"✅ Added to master: {processed['title'][:60]}... "
                          f"(Score: {processed['relevance_score']:.1f})")
                else:
                    duplicate_count += 1
            else:
                skipped_count += 1
        
        # Create daily snapshot
        snapshot_data = {
            'date': target_date,
            'scraped_at': datetime.now().isoformat(),
            'total_found': len(unique_articles),
            'total_processed': len(daily_articles),
            'added_to_master': len(saved_to_db),
            'duplicates': duplicate_count,
            'skipped': skipped_count,
            'articles': daily_articles
        }
        
        # Save daily snapshot
        with open(snapshot_path, 'w', encoding='utf-8') as f:
            json.dump(snapshot_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n📸 Daily snapshot saved: {snapshot_path}")
        print(f"📊 Snapshot contains {len(daily_articles)} articles")
        print(f"🔄 Added {len(saved_to_db)} new articles to master list")
        
        # Update dashboard
        self.export_dashboard()
        
        return snapshot_data

    def remove_from_dashboard(self, article_ids: List[int]) -> int:
        """Remove approved articles from dashboard view"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.executemany('''
            UPDATE articles 
            SET in_dashboard = 0
            WHERE id = ?
        ''', [(aid,) for aid in article_ids])
        
        affected = cursor.rowcount
        conn.commit()
        conn.close()
        
        print(f"📤 Removed {affected} articles from dashboard")
        return affected

    def export_dashboard(self, output_file="dashboard_data.json"):
        """Export current dashboard articles (in_dashboard = 1)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Only get articles that should be in dashboard
        cursor.execute('''
            SELECT id, title, description, content, url, source_name, author, 
                   published_at, scraped_at, relevance_score, status, topic, priority, hash
            FROM articles 
            WHERE in_dashboard = 1
            ORDER BY scraped_at DESC
            LIMIT 100
        ''')
        
        columns = [desc[0] for desc in cursor.description]
        articles = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        # Get analytics
        cursor.execute('''
            SELECT 
                COUNT(*) as total_articles,
                COUNT(CASE WHEN date(scraped_at) = date('now') THEN 1 END) as today_articles,
                COUNT(CASE WHEN status = 'pending_synthesis' THEN 1 END) as pending_synthesis,
                COUNT(CASE WHEN status = 'ready_for_translation' THEN 1 END) as pending_translation,
                COUNT(CASE WHEN status = 'published' THEN 1 END) as published_articles
            FROM articles
            WHERE in_dashboard = 1
        ''')
        
        analytics_row = cursor.fetchone()
        analytics = {
            'total_articles': analytics_row[0],
            'today_articles': analytics_row[1],
            'pending_synthesis': analytics_row[2],
            'pending_translation': analytics_row[3],
            'published_articles': analytics_row[4]
        }
        
        conn.close()
        
        # Format for dashboard
        dashboard_data = {
            'articles': [
                {
                    'id': article['id'],
                    'originalTitle': article['title'],
                    'source': article['source_name'],
                    'author': article['author'] or 'N/A',
                    'scrapedDate': article['scraped_at'][:10] if article['scraped_at'] else '',
                    'originalUrl': article['url'],
                    'status': article['status'],
                    'topic': article['topic'],
                    'fullContent': article['content'] if article['content'] else None,
                    'shortDescription': article['description'][:200] if article['description'] else None,
                    'aiSummary': None,
                    'aiTitle': None,
                    'displayTitle': None,
                    'translations': {'chinese': None, 'korean': None},
                    'translatedTitles': {'chinese': None, 'korean': None},
                    'imageGenerated': False,
                    'imageUrl': None,
                    'priority': article['priority'],
                    'relevanceScore': round(article['relevance_score'], 1) if article['relevance_score'] else 0
                }
                for article in articles
            ],
            'analytics': analytics,
            'last_updated': datetime.now().isoformat()
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(dashboard_data, f, indent=2, ensure_ascii=False)
        
        print(f"📊 Dashboard updated: {len(articles)} articles available for review")
        return dashboard_data

    def list_daily_snapshots(self):
        """List all available daily snapshots"""
        snapshots = []
        for filename in os.listdir(self.snapshots_dir):
            if filename.endswith('_articles.json'):
                date_str = filename.replace('_articles.json', '')
                snapshots.append(date_str)
        
        snapshots.sort(reverse=True)
        print(f"📅 Available daily snapshots:")
        for snapshot in snapshots:
            snapshot_path = os.path.join(self.snapshots_dir, f"{snapshot}_articles.json")
            with open(snapshot_path, 'r') as f:
                data = json.load(f)
                print(f"   {snapshot}: {data['total_processed']} articles ({data['added_to_master']} new)")
        
        return snapshots


# Example usage
if __name__ == "__main__":
    API_KEY = "4eb948c5-510c-4d2e-abdb-71e1968f814e"
    scraper = AAVMNewsScraper(API_KEY)
    
    print("🚀 AAVM Daily Snapshot Scraper")
    print("=" * 50)
    
    # Run today's scrape
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"Running scrape for {today}...")
    
    snapshot_data = scraper.run_daily_scrape()
    
    print(f"\n✅ Daily scraping complete!")
    print(f"📸 Snapshot: {snapshot_data.get('total_processed', 0)} articles")
    print(f"🔄 Dashboard: {snapshot_data.get('added_to_master', 0)} new articles")
    
    # List all snapshots
    print(f"\n" + "=" * 50)
    scraper.list_daily_snapshots()

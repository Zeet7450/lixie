# 🦊 Lixie - Personal News Aggregator PWA

A beautiful, modern Progressive Web App for aggregating global news from 15 verified sources across 5 regions, powered by Groq AI with elegant glass-morphism design and smooth animations.

---

## ✨ Features

- 🌍 **Global News Sources** - News from 15 verified sources across Indonesia, China, Japan, Korea, and International
- 🤖 **AI-Powered Aggregation** - Groq AI analyzes and summarizes news automatically
- ✨ **Glass-morphism UI** - Modern design with elegant transparency effects
- 🎬 **Smooth Animations** - Every interaction has delightful animations
- 📱 **Fully Responsive** - Perfect on desktop, tablet, and mobile
- 🌙 **Dark Mode** - Eye-friendly dark theme with FOUC prevention
- 🌐 **Multi-language** - Indonesian & English support based on region
- 📚 **Favorites** - Save your favorite articles
- 🔥 **Breaking News** - Special highlighting for urgent news
- 📊 **Analytics Dashboard** - Track reading statistics, favorite categories, and clicks
- 🔔 **PWA Notifications** - Get notified for hot news from each region
- 📴 **Offline Support** - Read cached articles without internet

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Groq API Key ([Get one here](https://console.groq.com/))
- Neon PostgreSQL Database ([Get one here](https://console.neon.tech/))

### Installation

```bash
# Clone repository
git clone <repository-url>
cd news-pwa-aggregator

# Install dependencies
pnpm install
```

### Environment Setup

Create `.env.local` file in the root directory:

```bash
# Groq API Key (required)
NEXT_PUBLIC_GROQ_API_KEY=your_groq_api_key_here
# OR
GROQ_API_KEY=your_groq_api_key_here

# Neon Database Connection (required)
DATABASE_URL='postgresql://user:password@host.neon.tech/dbname?sslmode=require&channel_binding=require'
# OR
NEXT_PUBLIC_NEON_CONNECTION_STRING='postgresql://user:password@host.neon.tech/dbname?sslmode=require'
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
pnpm build
pnpm start
```

---

## 🏗️ Project Structure

```
├── app/                    # Next.js app router pages
│   ├── api/               # API routes (scheduler, articles, debug)
│   ├── article/[id]/      # Article detail page
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── common/           # Shared components (SplashScreen, EmptyState, etc.)
│   ├── features/          # Feature components (NewsFeed, CategoryTabs)
│   ├── layout/           # Layout components (Header, Sidebar)
│   └── cards/            # Card components (ArticleCard)
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── api-scheduler.ts  # Automatic news fetching system
│   ├── database.ts       # Database connection & queries
│   ├── model-quota.ts    # AI model quota management
│   └── notifications.ts  # PWA notifications
├── store/                # Zustand state management
├── types/                # TypeScript types
└── config/               # Configuration files
```

---

## 📰 News Sources

### 🇮🇩 Indonesia (3 sources)

- **Kompas** - https://www.kompas.com
- **Detik** - https://www.detik.com
- **CNN Indonesia** - https://www.cnnindonesia.com

### 🇨🇳 China (2 sources)

- **Xinhua (English)** - http://www.xinhuanet.com/english/
- **China Daily** - https://www.chinadaily.com.cn

### 🇯🇵 Japan (3 sources)

- **NHK World** - https://www3.nhk.or.jp/nhkworld/
- **The Asahi Shimbun** - https://www.asahi.com
- **The Japan Times** - https://www.japantimes.co.jp

### 🇰🇷 Korea (2 sources)

- **Yonhap News Agency** - https://en.yna.co.kr
- **KBS News** - https://news.kbs.co.kr

### 🌍 International (5 sources)

- **BBC News** - https://www.bbc.com/news
- **Reuters** - https://www.reuters.com
- **AP News** - https://apnews.com
- **The Guardian** - https://www.theguardian.com
- **Al Jazeera English** - https://www.aljazeera.com

**Total: 15 verified news sources**

---

## 🤖 AI Model Configuration

The system uses a combination of Groq AI models with intelligent quota management:

### Primary Model (Priority 1 - Best Accuracy)

- **deepseek-r1-distill-llama-70b**
- Quota: 1,000 requests/day
- Used first for maximum accuracy
- Best for complex news analysis

### Backup Model 1 (Priority 2 - High Quality)

- **llama-3.3-70b-versatile**
- Quota: 1,000 requests/day
- Automatic fallback when primary quota exhausted
- Accuracy nearly equal to DeepSeek

### Backup Model 2 (Priority 3 - High Volume)

- **mixtral-8x7b-32768**
- Quota: 14,400 requests/day
- Used when both 70B models are exhausted
- Best for high volume or simple articles
- Large context window (32,768 tokens)

**Total: 16,400 requests/day across all three models**

The system automatically:

- Selects available model based on quota and priority
- Falls back to next model if current one fails or quota exhausted
- Tracks usage and resets daily
- Logs quota status for monitoring
- Uses high-volume model for simple articles when needed

---

## 🔄 API Scheduler System

### Overview

Automatic news fetching system that processes news from all regions every 25 minutes using Groq AI.

### Rate Limiting

- **25 requests per region per 25 minutes** (flexible, can go up to 30)
- **5 regions**: Indonesia, China, Japan, Korea, International
- **Cycle duration**: 25 minutes
- **Target**: 5-10 articles per region per cycle
- **Reserve requests**: 20 requests for retries and additional needs

### How It Works

1. **Auto-start**: Scheduler starts automatically when web is opened
2. **Fetch cycle**: Every 25 minutes, fetches news from all regions
3. **AI processing**: Groq AI analyzes and summarizes articles
4. **Immediate upload**: Articles uploaded to database immediately after processing
5. **Error handling**: Automatic retry with reserve requests

### Request Distribution

```
Per 25 Minutes:
├── Indonesia: 25 requests (distributed over 25 min)
├── China: 25 requests
├── Japan: 25 requests
├── Korea: 25 requests
└── International: 25 requests
Total: 125 requests per cycle
```

### Monitoring

Check scheduler status:

- **API Endpoint**: `/api/debug/status`
- **Quota Status**: `/api/debug/quota`
- **Console Logs**: Check terminal for detailed logs

---

## 🗄️ Database Schema

### Overview

Neon PostgreSQL database with 5 separate tables based on news region.

### Tables

1. **indonesia** - News from Indonesia
2. **china** - News from China
3. **japan** - News from Japan
4. **korea** - News from South Korea
5. **international** - International news (Europe & America)

### Schema

```sql
CREATE TABLE [table_name] (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,                    -- Title from source (EXACT, not modified)
  description TEXT,                       -- Brief description
  summary TEXT,                           -- 3-5 paragraph summary
  content TEXT,                           -- Full content (optional)
  image_url TEXT,                         -- Article image URL
  preview_image_url TEXT,                 -- Preview image URL
  source_url TEXT NOT NULL,               -- Original article URL
  source_id TEXT NOT NULL,                -- Source name (e.g., "Kompas", "BBC")
  category TEXT NOT NULL,                 -- Article category
  language TEXT DEFAULT '[default]',      -- Language: 'id', 'zh', 'ja', 'ko', 'en'
  hotness_score INTEGER DEFAULT 0,       -- Hotness score 0-100
  is_breaking BOOLEAN DEFAULT FALSE,      -- Breaking news flag
  is_trending BOOLEAN DEFAULT FALSE,     -- Trending flag
  views INTEGER DEFAULT 0,               -- View count
  shares INTEGER DEFAULT 0,              -- Share count
  comments INTEGER DEFAULT 0,            -- Comment count
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- Publish date
  aggregated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- Aggregation time
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes

Each table has indexes for performance:

- `idx_[table]_category` - Category filtering
- `idx_[table]_published` - Date sorting
- `idx_[table]_hotness` - Hotness score sorting

### Date Filtering

Only articles from **December 14, 2025 onwards** are stored and displayed. Older articles are automatically filtered out.

---

## 🎨 Design System

### Colors

- **Soft Lavender** (#D8BFD8) - Primary accent
- **Dusty Rose** (#DCAE96) - CTAs and highlights
- **Creamy Ivory** (#FFFDD0) - Light mode background
- **Slate 900** (#0f172a) - Dark mode background
- **Muted Emerald** (#6B8E6F) - Text and depth
- **Sage Green** (#9DC183) - Success states

### Animations

All animations follow the "Elegant Freshness" philosophy:

- Smooth, purposeful transitions
- 60 FPS performance
- Respects `prefers-reduced-motion`
- FOUC (Flash of Unstyled Content) prevention for dark mode

### Responsive Breakpoints

- **Mobile**: < 640px (1 column)
- **Tablet**: 640px - 1023px (2 columns)
- **Desktop**: ≥ 1024px (3 columns)

---

## 🔧 Tech Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Framer Motion** - Animations
- **Tailwind CSS** - Styling
- **Zustand** - State management with persist
- **Groq SDK** - AI-powered news analysis
- **PostgreSQL (Neon)** - Database
- **pg (node-postgres)** - Database client

---

## 📊 Features Detail

### Analytics Dashboard

- **Reading Statistics**: Bar chart showing percentage of news read by category
- **Favorite Categories**: Table of most liked categories
- **Click Statistics**: Total clicked articles count
- **Time Filters**: All time, 1 day, 7 days, 1 month, 1 year
- **Auto-reset**: Analytics reset to 0 on component mount

### PWA Notifications

- **Hot News Alerts**: Notifications for breaking/trending news (hotness_score ≥ 80)
- **Region-based**: Shows region name in notification title
- **Permission Prompt**: Asks user for notification permission
- **Background Service**: Works even when app is closed

### Splash Screen

- **10-second animation**: Logo animation GIF plays for 10 seconds on first load
- **Smooth transitions**: Fade in/out animations
- **Responsive**: Adapts to screen size

### Region Selector

- **5 Regions**: ID, EN, CN, JP, KR
- **Language Auto-switch**: Indonesian for ID, English for others
- **News Filtering**: Only shows news from selected region

---

## 🔍 Debugging & Monitoring

### API Endpoints

- **`/api/debug/status`** - Check system status (database, scheduler, articles count)
- **`/api/debug/quota`** - Check AI model quota status
- **`/api/debug/test-groq`** - Test Groq API connection
- **`/api/scheduler/start`** - Start/check scheduler status

### Console Logs

Check terminal for detailed logs:

- `✓ Neon database connected successfully` - Database OK
- `✅ API Scheduler started with Groq API key configured` - Scheduler OK
- `📊 Quota Status:` - Model quota information
- `✓ Fetched X articles, uploaded Y to database` - Fetching status

### Common Issues

**"Belum ada berita di database"**

- ✅ Normal - Scheduler is processing, just wait 5-30 minutes
- Check `/api/debug/status` for detailed status

**"Database connection timeout"**

- Check connection string in `.env.local`
- Verify Neon database is accessible
- Check network/firewall settings

**"Groq API key tidak dikonfigurasi"**

- Ensure `.env.local` has `NEXT_PUBLIC_GROQ_API_KEY` or `GROQ_API_KEY`
- Restart dev server after adding env variable

---

## 🚀 Deployment

### Build for Production

```bash
pnpm build
pnpm start
```

### Environment Variables

Make sure to set all required environment variables in your deployment platform:

- `NEXT_PUBLIC_GROQ_API_KEY` or `GROQ_API_KEY`
- `DATABASE_URL` or `NEXT_PUBLIC_NEON_CONNECTION_STRING`

### PWA Configuration

The app is configured as a PWA with:

- Service Worker (`/public/sw.js`)
- Manifest file (`/public/manifest.json`)
- Offline support
- Push notifications

---

## 📝 Notes

- **Title Preservation**: Article titles are stored exactly as from source websites (not modified)
- **Date Filtering**: Only articles from December 14, 2025 onwards are displayed
- **Image Validation**: Images are validated to ensure they're from legitimate sources
- **Summary Quality**: AI generates 3-5 paragraph summaries in appropriate language
- **Category Mapping**: Source categories are mapped to LIXIE category system
- **Offline Support**: Cached articles available without internet connection

---

## 📄 License

Personal use project.

---

## 🙏 Acknowledgments

- **Groq** - For AI-powered news analysis
- **Neon** - For cloud-native PostgreSQL database
- **All News Sources** - For providing quality news content

---

**Dibuat dengan ❤️ untuk pengalaman membaca berita yang lebih baik**

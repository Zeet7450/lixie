import axios from 'axios';
import type { Article } from '@/types';
import { translateArticleForRegion } from './article-translator';

// API Configuration
// Use environment variable if set, otherwise use relative URL for production
// In production (Vercel), relative URLs work automatically
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' ? '/api' : 'http://localhost:3000/api');

export type NewsRegion = 'id' | 'cn' | 'jp' | 'kr' | 'intl';

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

/**
 * Fetch a single article detail by ID from API
 * Includes full summary and preview image from source
 */
export async function fetchArticleDetail(articleId: number): Promise<Article | null> {
  try {
    const response = await axios.get<ApiResponse<Article>>(`${API_BASE_URL}/articles/${articleId}`, {
      timeout: 10000,
    });

    if (response.data.success && response.data.data) {
      // Cache article detail
      if (typeof window !== 'undefined') {
        try {
          const cacheKey = `lixie-article-${articleId}`;
          const cacheData = {
            article: response.data.data,
            timestamp: Date.now(),
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
          console.warn('Failed to cache article detail:', e);
        }
      }
      return response.data.data;
    }
    
    return null;
  } catch (error) {
    // Try to load from cache
    if (typeof window !== 'undefined') {
      try {
        const cacheKey = `lixie-article-${articleId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cacheData = JSON.parse(cached);
          if (Date.now() - cacheData.timestamp < 60 * 60 * 1000) {
            console.log('Loading article detail from cache (offline mode)');
            return cacheData.article;
          }
        }
      } catch (e) {
        console.warn('Failed to load article detail from cache:', e);
      }
    }
    
    console.warn('Failed to fetch article detail:', error);
    return null;
  }
}

/**
 * Fetch articles from multiple news sources (Indonesia, China, Japan, Korea, International)
 * System analyzes and aggregates news from various websites
 * Articles are stored in separate tables by region in Neon database
 */
export async function fetchArticles(
  category?: string,
  region?: NewsRegion
): Promise<Article[]> {
  try {
    // Fetch from API route (server-side only, uses database)
    const params = new URLSearchParams();
    if (category && category !== 'all') {
      params.append('category', category);
    }
    if (region) {
      params.append('region', region);
    }
    
    const url = `${API_BASE_URL}/articles${params.toString() ? `?${params.toString()}` : ''}`;
    
    const response = await axios.get<ApiResponse<Article[]>>(url, {
      timeout: 10000,
    });

    if (response.data.success && response.data.data) {
      const articles = response.data.data || [];
      
      // Filter articles to only include from December 14, 2025 onwards
      const minDate = new Date('2025-12-14T00:00:00.000Z').getTime();
      const filteredArticles = articles.filter((article: Article) => {
        try {
          const publishedTime = new Date(article.published_at).getTime();
          return publishedTime >= minDate;
        } catch {
          return false;
        }
      });

      // Cache articles for offline access
      if (typeof window !== 'undefined') {
        try {
          const cacheKey = `lixie-articles-${category || 'all'}-${region || 'all'}`;
          const cacheData = {
            articles: filteredArticles,
            timestamp: Date.now(),
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
          console.warn('Failed to cache articles:', e);
        }
      }
      return filteredArticles;
    }
    
    throw new Error('Invalid API response');
  } catch (error) {
    // No cache fallback - only use fresh data from Groq API via database
    console.warn('API fetch failed, no data available. Waiting for Groq API to fetch news...');
    return [];
  }
}

/**
 * Get mock articles for development/fallback
 * Includes articles from Indonesia, China, Japan, Korea, and International sources
 */
function getMockArticles(category?: string, region?: NewsRegion): Article[] {
  const allArticles: Article[] = [
    {
      id: 1,
      title: 'Jaringan Cybercrime Nasional Beroperasi 14 Tahun Berhasil Dibongkar di Indonesia',
      description: 'Peneliti keamanan dari Malanta.ai berhasil membongkar jaringan cybercrime besar yang telah beroperasi selama lebih dari 14 tahun di Indonesia.',
      summary: 'Jaringan cybercrime nasional yang telah beroperasi selama lebih dari 14 tahun di Indonesia akhirnya berhasil dibongkar oleh peneliti keamanan dari Malanta.ai. Jaringan ini mengendalikan lebih dari 320.000 domain dan berhasil membobol lebih dari 1.400 subdomain, termasuk beberapa milik server pemerintah dan perusahaan. Operasi ini merupakan salah satu jaringan cybercrime terbesar yang pernah ditemukan di Indonesia. Para peneliti menemukan bahwa jaringan ini menggunakan teknik canggih untuk menghindari deteksi selama bertahun-tahun. Investigasi lebih lanjut masih dilakukan untuk mengidentifikasi semua pihak yang terlibat dalam operasi kriminal ini.',
      source_url: 'https://www.techradar.com/pro/security/national-cybercrime-network-operating-for-14-years-dismantled-in-indonesia',
      source_id: 'TechRadar',
      category: 'technology',
      language: 'id',
      hotness_score: 95,
      is_breaking: true,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200',
      views: 1250,
      shares: 340,
      comments: 89,
      published_at: new Date().toISOString(),
    },
    {
      id: 2,
      title: 'Indonesia Targetkan Selesaikan Negosiasi Tarif dengan AS Akhir 2025',
      description: 'Delegasi Indonesia akan mengunjungi Washington untuk melanjutkan pembahasan negosiasi tarif dengan Amerika Serikat.',
      summary: 'Indonesia menargetkan untuk menyelesaikan negosiasi tarif dengan Amerika Serikat pada akhir tahun 2025. Sebuah delegasi akan mengunjungi Washington untuk melanjutkan pembahasan yang bertujuan memenuhi kesepakatan yang telah disepakati dalam deklarasi pemimpin pada 22 Juli lalu. Negosiasi ini merupakan bagian penting dari hubungan perdagangan antara kedua negara. Pemerintah Indonesia berharap kesepakatan ini dapat meningkatkan volume perdagangan dan investasi antara Indonesia dan AS. Para ahli memperkirakan bahwa kesepakatan ini akan membawa dampak positif bagi perekonomian Indonesia.',
      source_url: 'https://www.reuters.com/world/asia-pacific/indonesia-expects-complete-tariff-negotiations-with-us-by-year-end-official-says-2025-12-12',
      source_id: 'Reuters',
      category: 'economy',
      language: 'id',
      hotness_score: 88,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200',
      views: 890,
      shares: 120,
      comments: 45,
      published_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 3,
      title: 'Pejabat Indonesia Soroti Peran AI dalam Mendorong Ekonomi Digital',
      description: 'Wakil Menteri Komunikasi dan Informatika Nezar Patria menekankan peran penting AI sebagai penggerak utama ekonomi digital Indonesia.',
      summary: 'Wakil Menteri Komunikasi dan Informatika Nezar Patria menekankan peran penting artificial intelligence (AI) sebagai penggerak utama ekonomi digital Indonesia. Ia mendorong para mahasiswa untuk memperdalam keahlian mereka dalam teknologi AI agar dapat berkontribusi aktif dalam pergeseran digital global yang sedang berlangsung. Patria menyatakan bahwa AI bukan hanya teknologi masa depan, tetapi sudah menjadi kebutuhan saat ini. Pemerintah Indonesia berkomitmen untuk mendukung pengembangan ekosistem AI di dalam negeri melalui berbagai program dan kebijakan. Para ahli memperkirakan bahwa adopsi AI yang lebih luas akan meningkatkan produktivitas dan daya saing ekonomi Indonesia di pasar global.',
      source_url: 'https://en.antaranews.com/news/352253/indonesian-official-highlights-ais-role-in-boosting-digital-economy',
      source_id: 'Antara News',
      category: 'technology',
      language: 'id',
      hotness_score: 85,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200',
      views: 650,
      shares: 145,
      comments: 67,
      published_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 4,
      title: 'Prabowo Resmikan Dana Kekayaan Negara Baru dengan Investasi Awal 20 Miliar Dolar',
      description: 'Presiden Prabowo Subianto secara resmi meluncurkan dana kekayaan negara baru Daya Anagata Nusantara Indonesia (Danantara) dengan investasi awal 20 miliar dolar AS.',
      summary: 'Presiden Prabowo Subianto secara resmi meluncurkan dana kekayaan negara baru yang diberi nama Daya Anagata Nusantara Indonesia (Danantara) dengan investasi awal sebesar 20 miliar dolar AS. Dana ini akan dialokasikan untuk lebih dari 20 proyek strategis yang mencakup berbagai sektor penting seperti pengolahan logam, artificial intelligence, kilang minyak, energi terbarukan, dan produksi pangan. Peluncuran dana ini diharapkan dapat mempercepat pembangunan infrastruktur dan meningkatkan daya saing ekonomi Indonesia. Para ahli memperkirakan bahwa investasi ini akan menciptakan ribuan lapangan kerja baru dan mendorong pertumbuhan ekonomi yang berkelanjutan.',
      source_url: 'https://www.reuters.com/world/asia-pacific/indonesias-prabowo-officially-establishes-new-sovereign-wealth-fund-2025-02-24',
      source_id: 'Reuters',
      category: 'economy',
      language: 'id',
      hotness_score: 92,
      is_breaking: true,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200',
      views: 2100,
      shares: 580,
      comments: 234,
      published_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 5,
      title: 'Menteri Keuangan Tolak Anggaran Nasional untuk Bayar Utang Kereta Cepat Indonesia-China',
      description: 'Menteri Keuangan Purbaya Yudhi Sadewa menyatakan penolakan keras terhadap penggunaan anggaran nasional untuk membayar utang proyek kereta cepat Indonesia-China.',
      summary: 'Menteri Keuangan Purbaya Yudhi Sadewa menyatakan penolakan keras terhadap penggunaan anggaran nasional untuk membayar utang yang terkait dengan proyek kereta cepat Indonesia-China. Ia mengungkapkan keprihatinan serius mengenai kelayakan finansial proyek ini, mencatat bahwa biaya operasional dan pembayaran utang tidak seimbang dengan pendapatan yang dihasilkan. Proyek kereta cepat yang menghubungkan Jakarta dan Bandung ini telah menjadi perdebatan panjang terkait pembiayaannya. Purbaya menekankan pentingnya transparansi dan evaluasi menyeluruh terhadap proyek infrastruktur besar seperti ini sebelum menggunakan dana publik.',
      source_url: 'https://en.wikipedia.org/wiki/High-speed_rail_in_Indonesia',
      source_id: 'Wikipedia',
      category: 'politics',
      language: 'id',
      hotness_score: 78,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200',
      views: 1100,
      shares: 280,
      comments: 156,
      published_at: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      id: 6,
      title: 'Prabowo Lakukan Reshuffle Kabinet untuk Kedua Kalinya di 2025',
      description: 'Presiden Prabowo Subianto melakukan reshuffle kabinet untuk kedua kalinya pada tahun 2025 dengan mengganti lima menteri.',
      summary: 'Presiden Prabowo Subianto melakukan reshuffle kabinet untuk kedua kalinya pada tahun 2025. Reshuffle pertama dilakukan pada 19 Februari setelah pengunduran diri Menteri Pendidikan Tinggi, Riset, dan Teknologi. Reshuffle kedua dilakukan pada 8 September dengan mengganti lima menteri, termasuk menteri yang mengawasi keuangan dan perlindungan pekerja migran. Perubahan kabinet ini dilakukan untuk meningkatkan efektivitas pemerintahan dan menyesuaikan dengan prioritas pembangunan nasional. Para analis politik memperkirakan bahwa reshuffle ini akan membawa perubahan signifikan dalam kebijakan pemerintahan.',
      source_url: 'https://en.wikipedia.org/wiki/Red_and_White_Cabinet',
      source_id: 'Wikipedia',
      category: 'politics',
      language: 'id',
      hotness_score: 82,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=1200',
      views: 980,
      shares: 210,
      comments: 78,
      published_at: new Date(Date.now() - 5400000).toISOString(),
    },
    {
      id: 7,
      title: 'Saham Teknologi Meningkat Pesat, Apa yang Terjadi?',
      description: 'Indeks saham teknologi di Bursa Efek Indonesia mengalami kenaikan signifikan dalam beberapa hari terakhir.',
      summary: 'Indeks saham teknologi di Bursa Efek Indonesia mengalami kenaikan pesat dalam beberapa hari terakhir, mencatat kenaikan hingga 5 persen dalam satu hari perdagangan. Para analis mengaitkan kenaikan ini dengan beberapa faktor utama, termasuk optimisme investor terhadap prospek digitalisasi di Indonesia, dukungan kebijakan pemerintah untuk sektor teknologi, dan laporan keuangan positif dari beberapa perusahaan teknologi besar. Kenaikan ini juga dipicu oleh minat investor asing yang meningkat terhadap pasar teknologi Indonesia. Namun, para ahli mengingatkan investor untuk tetap waspada terhadap volatilitas pasar dan melakukan analisis fundamental sebelum mengambil keputusan investasi.',
      source_url: 'https://www.kompas.com',
      source_id: 'Kompas',
      category: 'business',
      language: 'id',
      hotness_score: 88,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200',
      views: 1350,
      shares: 320,
      comments: 167,
      published_at: new Date(Date.now() - 9000000).toISOString(),
    },
    {
      id: 8,
      title: 'Inovasi Telemedicine Ubah Akses Kesehatan di Indonesia',
      description: 'Platform telemedicine semakin populer dan mengubah cara masyarakat Indonesia mengakses layanan kesehatan.',
      summary: 'Platform telemedicine di Indonesia mengalami pertumbuhan pesat dan mengubah cara masyarakat mengakses layanan kesehatan. Dengan teknologi ini, pasien dapat berkonsultasi dengan dokter tanpa harus datang ke rumah sakit atau klinik. Inovasi ini sangat membantu terutama di daerah terpencil yang memiliki keterbatasan akses ke fasilitas kesehatan. Banyak rumah sakit dan klinik di Indonesia telah mengadopsi teknologi telemedicine untuk meningkatkan jangkauan layanan mereka. Para ahli kesehatan memprediksi bahwa telemedicine akan menjadi bagian integral dari sistem kesehatan Indonesia di masa depan. Namun, masih ada tantangan yang perlu diatasi, termasuk infrastruktur internet dan regulasi yang lebih jelas.',
      source_url: 'https://www.detik.com',
      source_id: 'Detik',
      category: 'health',
      language: 'id',
      hotness_score: 75,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200',
      views: 890,
      shares: 178,
      comments: 67,
      published_at: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: 9,
      title: 'Platform Streaming Lokal Bersaing dengan Layanan Internasional',
      description: 'Platform streaming lokal Indonesia mulai menunjukkan daya saing yang kuat melawan layanan streaming internasional.',
      summary: 'Platform streaming lokal Indonesia mulai menunjukkan daya saing yang kuat dalam menghadapi dominasi layanan streaming internasional. Dengan konten lokal yang berkualitas dan harga yang lebih terjangkau, platform-platform ini berhasil menarik perhatian penonton Indonesia. Beberapa platform bahkan telah berhasil memproduksi konten original yang mendapat apresiasi tinggi dari penonton. Industri entertainment digital Indonesia diperkirakan akan terus berkembang dengan dukungan dari pemerintah dan minat investor. Para ahli memprediksi bahwa dalam beberapa tahun ke depan, platform streaming lokal akan memiliki porsi pasar yang lebih besar di Indonesia.',
      source_url: 'https://www.tempo.co',
      source_id: 'Tempo',
      category: 'entertainment',
      language: 'id',
      hotness_score: 72,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200',
      views: 720,
      shares: 95,
      comments: 34,
      published_at: new Date(Date.now() - 2700000).toISOString(),
    },
    {
      id: 10,
      title: 'Program Beasiswa Digital Dukung Pendidikan Teknologi di Indonesia',
      description: 'Pemerintah meluncurkan program beasiswa digital untuk meningkatkan kualitas pendidikan teknologi di Indonesia.',
      summary: 'Pemerintah Indonesia meluncurkan program beasiswa digital baru yang bertujuan untuk meningkatkan kualitas pendidikan teknologi di dalam negeri. Program ini menyediakan beasiswa untuk mahasiswa yang ingin menempuh pendidikan di bidang teknologi informasi, artificial intelligence, dan ilmu komputer. Program ini diharapkan dapat menghasilkan lebih banyak talenta digital yang berkualitas dan siap bersaing di pasar global. Beberapa universitas terkemuka di Indonesia telah bekerja sama dengan pemerintah untuk menyelenggarakan program ini. Para ahli pendidikan memprediksi bahwa program ini akan membawa dampak positif jangka panjang bagi pengembangan ekosistem teknologi Indonesia.',
      source_url: 'https://www.kompas.com',
      source_id: 'Kompas',
      category: 'education',
      language: 'id',
      hotness_score: 78,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200',
      views: 980,
      shares: 210,
      comments: 78,
      published_at: new Date(Date.now() - 6300000).toISOString(),
    },
    {
      id: 11,
      title: 'Inisiatif Energi Terbarukan Dapatkan Dukungan Penuh Pemerintah',
      description: 'Pemerintah memberikan dukungan penuh untuk pengembangan energi terbarukan di Indonesia.',
      summary: 'Pemerintah Indonesia memberikan dukungan penuh untuk pengembangan energi terbarukan sebagai bagian dari komitmen mengurangi emisi karbon. Beberapa proyek besar energi terbarukan sedang dalam tahap pengembangan, termasuk pembangkit listrik tenaga surya dan angin. Pemerintah juga telah mengeluarkan berbagai kebijakan insentif untuk menarik investasi di sektor energi terbarukan. Para ahli memperkirakan bahwa dengan dukungan ini, Indonesia dapat mencapai target energi terbarukan lebih cepat dari yang direncanakan. Inisiatif ini juga diharapkan dapat menciptakan ribuan lapangan kerja baru di sektor energi hijau.',
      source_url: 'https://www.detik.com',
      source_id: 'Detik',
      category: 'environment',
      language: 'id',
      hotness_score: 80,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=1200',
      views: 1100,
      shares: 280,
      comments: 156,
      published_at: new Date(Date.now() - 2400000).toISOString(),
    },
    {
      id: 12,
      title: 'Industri Kuliner Lokal Manfaatkan Teknologi untuk Ekspansi',
      description: 'Banyak bisnis kuliner lokal yang mulai memanfaatkan teknologi digital untuk memperluas jangkauan bisnis mereka.',
      summary: 'Industri kuliner lokal Indonesia semakin memanfaatkan teknologi digital untuk memperluas jangkauan bisnis mereka. Banyak restoran dan warung makan yang mulai menggunakan aplikasi pesan-antar online, sistem pemesanan digital, dan media sosial untuk memasarkan produk mereka. Teknologi ini telah membantu banyak pelaku usaha kuliner untuk bertahan dan bahkan berkembang selama masa sulit. Beberapa platform teknologi lokal telah muncul untuk mendukung ekosistem kuliner digital Indonesia. Para ahli bisnis memprediksi bahwa adopsi teknologi di sektor kuliner akan terus meningkat dan menjadi standar baru dalam industri ini.',
      source_url: 'https://www.tempo.co',
      source_id: 'Tempo',
      category: 'food',
      language: 'id',
      hotness_score: 68,
      is_breaking: false,
      is_trending: false,
      image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200',
      views: 720,
      shares: 95,
      comments: 34,
      published_at: new Date(Date.now() - 4200000).toISOString(),
    },
    // CHINA ARTICLES
    {
      id: 13,
      title: 'China\'s AI Industry Projected to Reach 1.73 Trillion Yuan by 2035',
      description: 'China\'s artificial intelligence market is expected to account for 30.6% of the global total by 2035.',
      summary: 'China\'s artificial intelligence industry is projected to reach a market scale of 1.73 trillion yuan ($240.4 billion) by 2035, accounting for 30.6% of the global total. By December 2023, the number of large language models with over 1 billion parameters in China reached 234, with generative AI technologies increasingly applied across sectors such as media, finance, retail, healthcare, and intelligent manufacturing. Beijing\'s digital economy contributed 2 trillion yuan in 2024, reflecting a 7.5% year-on-year growth. The city now hosts over 2,400 artificial intelligence companies, highlighting its status as a hub for technological innovation. The Chinese government has initiated a government-approved list of AI hardware suppliers, currently including domestic firms like Cambricon and Huawei, while excluding foreign competitors such as Nvidia and AMD.',
      source_url: 'https://www.ecns.cn/business/2024-01-18/detail-ihcwvwfu7682108.shtml',
      source_id: 'ECNS',
      category: 'technology',
      language: 'zh',
      hotness_score: 90,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200',
      views: 1850,
      shares: 420,
      comments: 156,
      published_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 14,
      title: 'China Adds 277 Gigawatts of Solar Power in 2024',
      description: 'China added solar capacity equivalent to 15% of the world\'s total cumulative installed solar capacity in 2024.',
      summary: 'China added 277 gigawatts (GW) of solar power in 2024, equivalent to 15% of the world\'s total cumulative installed solar capacity. This massive expansion underscores China\'s commitment to renewable energy and its leadership in the global solar industry. The country has become the world\'s largest producer and installer of solar panels, driving down costs globally. Chinese firms invested approximately $80 billion in overseas clean technology projects over the past year, bringing total green tech foreign direct investment to over $180 billion since early 2023. This surge is driven by China\'s overcapacity in sectors like solar panels and batteries, prompting companies to seek overseas markets. The renewable energy push is part of China\'s broader strategy to reduce carbon emissions and achieve carbon neutrality by 2060.',
      source_url: 'https://en.wikipedia.org/wiki/Solar_power_in_China',
      source_id: 'Wikipedia',
      category: 'environment',
      language: 'zh',
      hotness_score: 85,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=1200',
      views: 1420,
      shares: 380,
      comments: 134,
      published_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 15,
      title: 'China\'s GDP Reaches 134.9 Trillion Yuan in 2024',
      description: 'China\'s economy grew 5% in 2024, accounting for approximately 30% of global economic expansion.',
      summary: 'China\'s Gross Domestic Product (GDP) reached 134.9 trillion yuan (over $18.6 trillion) in 2024, marking a 5% increase from the previous year. This growth accounted for approximately 30% of global economic expansion, underscoring China\'s pivotal role in the world economy. Despite global economic uncertainties, China has maintained steady growth through various policy measures and infrastructure investments. The country continues to be a major driver of global economic growth, with strong performance in manufacturing, technology, and services sectors. However, challenges remain including trade tensions, demographic changes, and the need for economic restructuring towards more sustainable growth models.',
      source_url: 'https://www.ciie.org/zbh/en/news/exhibition/news/20250311/48556.html',
      source_id: 'CIIE',
      category: 'economy',
      language: 'zh',
      hotness_score: 88,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200',
      views: 1650,
      shares: 450,
      comments: 189,
      published_at: new Date(Date.now() - 5400000).toISOString(),
    },
    // KOREA ARTICLES
    {
      id: 16,
      title: 'South Korea to Require Advertisers to Label AI-Generated Ads',
      description: 'Starting in early 2026, all advertisements created using artificial intelligence must be clearly labeled in South Korea.',
      summary: 'South Korea announced that starting in early 2026, all advertisements created using artificial intelligence must be clearly labeled. This measure aims to combat deceptive online ads featuring deepfake celebrities or fabricated experts promoting various products. The new regulation is part of South Korea\'s broader efforts to regulate AI technology and protect consumers from misleading content. Advertisers will be required to disclose when AI technology is used to create or modify advertisements, including the use of deepfake technology. This move comes as AI-generated content becomes increasingly sophisticated and difficult to distinguish from real content. The regulation is expected to enhance transparency in advertising and protect consumer rights.',
      source_url: 'https://apnews.com/article/6df668ae93489da7d448c66e53905bbb',
      source_id: 'AP News',
      category: 'technology',
      language: 'ko',
      hotness_score: 82,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200',
      views: 1120,
      shares: 290,
      comments: 98,
      published_at: new Date(Date.now() - 2700000).toISOString(),
    },
    {
      id: 17,
      title: 'South Korea to Consider Setting Up $3.1 Bln Foundry to Grow Local Chip Sector',
      description: 'South Korea unveiled plans to establish a 4.5 trillion won semiconductor foundry to bolster the country\'s chip industry.',
      summary: 'South Korea unveiled plans to establish a 4.5 trillion won ($3.06 billion) semiconductor foundry. This initiative seeks to bolster the country\'s chip industry, particularly in response to the growing global demand for AI chips. The foundry will help South Korea maintain its competitive position in the global semiconductor market and reduce dependence on foreign chip manufacturers. The government plans to provide financial support and regulatory incentives to attract investment in the semiconductor sector. This move comes as countries worldwide are investing heavily in semiconductor manufacturing to secure supply chains and support their technology industries. The foundry is expected to create thousands of jobs and strengthen South Korea\'s position as a leading semiconductor producer.',
      source_url: 'https://www.reuters.com/world/asia-pacific/south-korea-consider-setting-up-31-bln-foundry-grow-local-chip-sector-2025-12-10',
      source_id: 'Reuters',
      category: 'technology',
      language: 'ko',
      hotness_score: 87,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200',
      views: 1380,
      shares: 360,
      comments: 145,
      published_at: new Date(Date.now() - 4500000).toISOString(),
    },
    {
      id: 18,
      title: 'Aespa Wins Seven Awards at 2024 Melon Music Awards',
      description: 'Aespa won seven awards including three Daesangs at the 2024 Melon Music Awards held on November 30.',
      summary: 'The 2024 Melon Music Awards were held on November 30, 2024, with Aespa, IU, and TWS each receiving seven nominations. Aespa emerged as the biggest winner, taking home seven awards including three Daesangs for Song of the Year, Artist of the Year, and Album of the Year. This marks a significant achievement for the K-pop group, solidifying their position as one of the top acts in the Korean music industry. The awards ceremony celebrated the best in Korean music, with performances from top artists and recognition of outstanding achievements in various categories. Despite a decline in physical album sales in 2024, the K-pop industry continues to show strong global influence and digital performance.',
      source_url: 'https://en.wikipedia.org/wiki/2024_Melon_Music_Awards',
      source_id: 'Wikipedia',
      category: 'entertainment',
      language: 'ko',
      hotness_score: 79,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200',
      views: 980,
      shares: 240,
      comments: 112,
      published_at: new Date(Date.now() - 7200000).toISOString(),
    },
    // JAPAN ARTICLES
    {
      id: 19,
      title: 'Japan Proposes $65 Billion Plan to Aid Domestic Chip Industry',
      description: 'The Japanese government unveiled a $65 billion initiative to bolster the semiconductor and AI industries through fiscal 2030.',
      summary: 'The Japanese government unveiled a $65 billion initiative in November 2024 to bolster the semiconductor and AI industries. This plan, extending through fiscal 2030, includes subsidies and financial incentives aimed at strengthening Japan\'s chip supply chain amid global disruptions. A key component is supporting the chip foundry Rapidus, which, in collaboration with IBM and Belgium\'s Imec, aims to mass-produce advanced chips in Hokkaido by 2027. The initiative is projected to generate an economic impact of approximately 160 trillion yen. In addition, the government allocated an extra $9.9 billion in November 2024 to advance chip and AI endeavors, including support for Rapidus Corp. This budget earmarked funds for developing next-generation chips and quantum computers, as well as supporting domestic advanced chip production.',
      source_url: 'https://www.reuters.com/world/japan/japan-propose-65-bln-plan-aid-domestic-chip-industry-draft-shows-2024-11-11',
      source_id: 'Reuters',
      category: 'technology',
      language: 'ja',
      hotness_score: 91,
      is_breaking: true,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200',
      views: 1950,
      shares: 520,
      comments: 201,
      published_at: new Date(Date.now() - 900000).toISOString(),
    },
    {
      id: 20,
      title: 'SoftBank Partners with OpenAI to Establish SB OpenAI Japan',
      description: 'SoftBank Group announced the establishment of SB OpenAI Japan in partnership with OpenAI, committing $3 billion annually.',
      summary: 'SoftBank Group, in partnership with OpenAI, announced the establishment of SB OpenAI Japan in February 2025. This joint venture aims to develop "Advanced Enterprise AI" called "Cristal intelligence," with SoftBank committing $3 billion annually to deploy OpenAI solutions across its companies. The partnership represents a significant investment in AI technology and demonstrates Japan\'s commitment to advancing in the AI sector. The joint venture will focus on developing enterprise AI solutions tailored for Japanese businesses, combining OpenAI\'s advanced AI capabilities with SoftBank\'s extensive business network. This initiative is part of Japan\'s broader strategy to invest at least $66 billion in the AI sector by 2030, offering corporate tax relief and subsidies for data centers.',
      source_url: 'https://en.wikipedia.org/wiki/SoftBank_Group',
      source_id: 'Wikipedia',
      category: 'technology',
      language: 'ja',
      hotness_score: 89,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200',
      views: 1720,
      shares: 480,
      comments: 178,
      published_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 21,
      title: 'Japan Business Mood Hits 4-Year High',
      description: 'Japanese business sentiment reached its highest level in four years, keeping alive expectations for a Bank of Japan rate hike.',
      summary: 'Japanese business mood hit a 4-year high, keeping alive expectations for a Bank of Japan rate hike. The positive business sentiment reflects improving economic conditions and strong demand, particularly in the semiconductor sector. Despite concerns about strained diplomatic relations with China, 40% of companies anticipate earnings growth in the upcoming fiscal year, mainly due to the ability to pass on rising costs and strong semiconductor demand. The government has also announced plans for new tax breaks to spur capital spending, despite concerns about Japan\'s high debt levels. Tokyo Electron, a leading semiconductor equipment maker, announced a 40% increase in starting salaries in early 2024 to secure talent and compete with foreign companies.',
      source_url: 'https://www.reuters.com/world/asia-pacific/japan-business-mood-hits-4-year-high-keeps-boj-rate-hike-view-alive-2025-12-15',
      source_id: 'Reuters',
      category: 'economy',
      language: 'ja',
      hotness_score: 84,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200',
      views: 1280,
      shares: 320,
      comments: 134,
      published_at: new Date(Date.now() - 6300000).toISOString(),
    },
    // INTERNATIONAL ARTICLES
    {
      id: 22,
      title: 'Europe\'s AI Progress Insufficient to Compete with US and China, French Report Says',
      description: 'A French parliamentary report highlighted the EU\'s insufficient progress in artificial intelligence compared to the U.S. and China.',
      summary: 'A French parliamentary report highlighted the EU\'s insufficient progress in artificial intelligence compared to the U.S. and China, warning of the risk of becoming a "digital colony." The report emphasizes the urgent need for Europe to accelerate its AI development and investment to remain competitive globally. In response, the European High-Performance Computing Joint Undertaking announced the construction of seven new data centers for AI infrastructure, aiming to bolster the continent\'s digital capabilities. The European Union\'s Artificial Intelligence Act entered into force on August 1, 2024, creating a risk-based legal framework for AI systems. European tech CEOs have urged for a "Europe-first" approach to technology, emphasizing the need for the continent to step up and be more aggressive in countering U.S. Big Tech firms\' dominance.',
      source_url: 'https://www.euronews.com/next/2024/12/10/europes-ai-progress-insufficient-to-compete-with-us-and-china-french-report-says',
      source_id: 'Euronews',
      category: 'technology',
      language: 'en',
      hotness_score: 86,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200',
      views: 1520,
      shares: 410,
      comments: 167,
      published_at: new Date(Date.now() - 5400000).toISOString(),
    },
    {
      id: 23,
      title: 'German Leader Says US Strategy Shows Need for More European Security Independence',
      description: 'German Chancellor Friedrich Merz emphasized the need for Europe to become more independent in security matters.',
      summary: 'German Chancellor Friedrich Merz emphasized the need for Europe to become more independent in security matters, rejecting the notion that European democracy requires U.S. intervention. This comes after the Trump administration released a new national security strategy that has strained U.S.-Europe relations. The document criticizes European policies on free speech and migration, supports far-right parties, and portrays European allies as weak. Similarly, European Council President António Costa warned against U.S. interference in European politics, stressing that only European citizens should determine their political leaders. The 2024 Washington NATO Summit focused on transatlantic security and the ongoing conflict in Ukraine, with several NATO nations providing Ukraine with equipment for air defense systems.',
      source_url: 'https://apnews.com/article/11a5042d7f7cdb39f8fa020b83aead55',
      source_id: 'AP News',
      category: 'politics',
      language: 'en',
      hotness_score: 92,
      is_breaking: true,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=1200',
      views: 2100,
      shares: 580,
      comments: 234,
      published_at: new Date(Date.now() - 1200000).toISOString(),
    },
    {
      id: 24,
      title: 'NATO Summit Addresses Ukraine Conflict and Indo-Pacific Security',
      description: 'The 2024 Washington NATO Summit focused on transatlantic security and the ongoing conflict in Ukraine.',
      summary: 'The 2024 Washington NATO Summit, held from July 9–11, focused on transatlantic security and the ongoing conflict in Ukraine. U.S. President Joe Biden accused Russian President Vladimir Putin of attempting to erase Ukraine off the map and announced that several NATO nations, including the United States, the Netherlands, Germany, Italy, and Romania, would provide Ukraine with equipment for five air defense systems. The alliance also addressed perceived threats posed by China and the security situation in the Indo-Pacific region. The summit highlighted the importance of transatlantic cooperation while also revealing tensions between the U.S. and European allies over security strategy and policy approaches.',
      source_url: 'https://en.wikipedia.org/wiki/2024_Washington_NATO_summit',
      source_id: 'Wikipedia',
      category: 'politics',
      language: 'en',
      hotness_score: 88,
      is_breaking: false,
      is_trending: true,
      image_url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800',
      preview_image_url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=1200',
      views: 1780,
      shares: 490,
      comments: 201,
      published_at: new Date(Date.now() - 8100000).toISOString(),
    },
  ];

  // Filter by region if specified
  let filteredArticles = allArticles;
  if (region) {
    // Map articles to regions based on language and source
    filteredArticles = allArticles.filter(article => {
      const articleLanguage = article.language || 'en';
      const articleSource = article.source_id?.toLowerCase() || '';
      
      // Map based on language and source patterns
      if (region === 'id') {
        return articleLanguage === 'id' || 
               articleSource.includes('kompas') || 
               articleSource.includes('detik') || 
               articleSource.includes('tempo') ||
               articleSource.includes('antara');
      } else if (region === 'cn') {
        return articleLanguage === 'zh' || 
               articleSource.includes('ecns') || 
               articleSource.includes('chinadaily') ||
               articleSource.includes('ciie');
      } else if (region === 'jp') {
        return articleLanguage === 'ja' || 
               articleSource.includes('reuters') && article.title.includes('Japan');
      } else if (region === 'kr') {
        return articleLanguage === 'ko' || 
               articleSource.includes('ap news') && article.title.includes('South Korea') ||
               article.title.includes('Korea') || 
               article.title.includes('K-pop') ||
               article.title.includes('Aespa');
      } else if (region === 'intl') {
        return (articleLanguage === 'en' && 
                !articleSource.includes('kompas') && 
                !articleSource.includes('detik') &&
                !articleSource.includes('tempo')) ||
               articleSource.includes('euronews') ||
               articleSource.includes('ap news') && article.title.includes('Europe') ||
               articleSource.includes('reuters') && (article.title.includes('NATO') || article.title.includes('Europe'));
      }
      return false;
    });
  }

  // Filter by category if specified
  if (category && category !== 'all') {
    if (category === 'hot') {
      return filteredArticles.filter(article => article.is_breaking);
    }
    return filteredArticles.filter(article => article.category === category);
  }

  return filteredArticles;
}

/**
 * Sort articles by relevance (hotness score, breaking status, trending, views)
 */
/**
 * Sort articles with intelligent algorithm
 * Prioritizes: recency (yesterday onwards), breaking news, hotness, trending, views
 * Filters out articles older than yesterday
 */
export function sortArticles(articles: Article[]): Article[] {
  // Filter: Only include articles from December 14, 2025 onwards
  const minDate = new Date('2025-12-14T00:00:00.000Z');
  const minDateTime = minDate.getTime();

  const recentArticles = articles.filter((article) => {
    try {
      const publishedTime = new Date(article.published_at).getTime();
      const isValid = publishedTime >= minDateTime;
      if (!isValid && article.published_at) {
        console.log(`Sort: Filtered out old article: ${article.title} (${article.published_at})`);
      }
      return isValid;
    } catch (error) {
      // If date parsing fails, exclude it (invalid date)
      console.log(`Sort: Filtered out article with invalid date: ${article.title}`, error);
      return false;
    }
  });

  console.log(`Sort: ${articles.length} total articles, ${recentArticles.length} after date filter`);

  // Sort with intelligent algorithm
  const sorted = [...recentArticles].sort((a, b) => {
    // First priority: Published date (newest first - TODAY articles first)
    const aDate = new Date(a.published_at).getTime();
    const bDate = new Date(b.published_at).getTime();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // Articles from today get highest priority
    const aIsToday = aDate >= oneDayAgo;
    const bIsToday = bDate >= oneDayAgo;
    if (aIsToday !== bIsToday) {
      return aIsToday ? -1 : 1;
    }

    // Second priority: Breaking news (hot)
    if (a.is_breaking && !b.is_breaking) return -1;
    if (!a.is_breaking && b.is_breaking) return 1;

    // Third priority: Hotness score
    if (a.hotness_score !== b.hotness_score) {
      return b.hotness_score - a.hotness_score;
    }

    // Fourth priority: Trending status
    if (a.is_trending && !b.is_trending) return -1;
    if (!a.is_trending && b.is_trending) return 1;

    // Fifth priority: Views
    if (a.views !== b.views) {
      return b.views - a.views;
    }

    // Finally by published date (newest first)
    return bDate - aDate;
  });
  return sorted;
}


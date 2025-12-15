'use client';

import { motion } from 'framer-motion';
import { usePageTransition } from '@/hooks/useAnimation';
import { useArticles } from '@/hooks/useArticles';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Heart } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { useAnalyticsStore } from '@/store/analytics';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useRegionStore } from '@/store/region';
import { fetchArticleDetail } from '@/lib/api';
import { useArticlesStore } from '@/store/articles';
import type { Article } from '@/types';

export default function ArticleDetail() {
  const params = useParams();
  const router = useRouter();
  const { articles } = useArticles();
  const pageTransition = usePageTransition();
  const { addReading } = useAnalyticsStore();
  const { t } = useLanguage();
  const { getDisplayLanguage } = useRegionStore();
  const { isBookmarked, addBookmark, removeBookmark } = useArticlesStore();
  const language = getDisplayLanguage();
  const [articleDetail, setArticleDetail] = useState<Article | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Get article from store first (fallback)
  const articleFromStore = articles.find(a => a.id === Number(params.id));
  const article = articleDetail || articleFromStore;
  
  const bookmarked = article ? isBookmarked(article.id) : false;

  // Fetch article detail from API (with summary and preview image)
  useEffect(() => {
    const loadArticleDetail = async () => {
      if (!articleFromStore) return;
      
      setLoadingDetail(true);
      try {
        const detail = await fetchArticleDetail(articleFromStore.id);
        if (detail) {
          setArticleDetail(detail);
        }
      } catch (error) {
        console.warn('Failed to fetch article detail, using store data:', error);
      } finally {
        setLoadingDetail(false);
      }
    };

    loadArticleDetail();
  }, [articleFromStore?.id]);

  // Track article reading when page loads
  useEffect(() => {
    if (article) {
      addReading(article.id, article.category);
    }
  }, [article, addReading]);

  const handleReadFullArticle = () => {
    if (article?.source_url) {
      window.open(article.source_url, '_blank', 'noopener,noreferrer');
    }
  };

  if (loadingDetail && !articleFromStore) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-emerald-700 dark:text-cream-300">{language === 'id' ? 'Memuat artikel...' : 'Loading article...'}</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-emerald-700 dark:text-cream-300 mb-4">{language === 'id' ? 'Artikel tidak ditemukan' : 'Article not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors"
          >
            {language === 'id' ? 'Kembali' : 'Go Back'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      transition={pageTransition.transition}
      className="max-w-3xl mx-auto px-4 py-8"
    >
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-emerald-700 dark:text-cream-300 hover:text-rose-600 transition-colors"
      >
        <ArrowLeft size={20} />
        {language === 'id' ? 'Kembali' : 'Back'}
      </motion.button>

      {/* Preview Image from Source */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="mb-8"
      >
        <img
          src={article.preview_image_url || article.image_url || 'https://via.placeholder.com/1200x600'}
          alt={article.title}
          className="w-full rounded-glass object-cover"
        />
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 text-center italic">
          {language === 'id' ? 'Gambar preview dari' : 'Preview image from'} {article.source_id}
        </p>
      </motion.div>

      <div className="flex items-start justify-between gap-4 mb-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl sm:text-4xl font-bold text-emerald-900 dark:text-cream-200 flex-1"
        >
          {article.title}
        </motion.h1>
        
        {/* FAVORITE BUTTON */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          onClick={() => {
            if (bookmarked) {
              removeBookmark(article.id);
            } else {
              addBookmark(article.id);
            }
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="flex-shrink-0 p-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
          title={bookmarked ? (language === 'id' ? 'Hapus dari favorit' : 'Remove from favorites') : (language === 'id' ? 'Tambah ke favorit' : 'Add to favorites')}
        >
          <motion.div
            animate={{
              scale: bookmarked ? [1, 1.2, 1] : 1,
            }}
            transition={{
              duration: 0.4,
              ease: 'easeInOut',
            }}
          >
            <Heart
              size={24}
              className={`transition-colors ${
                bookmarked
                  ? 'fill-rose-500 text-rose-500'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            />
          </motion.div>
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="flex flex-wrap gap-4 text-sm text-emerald-700 dark:text-cream-300 mb-6"
      >
        <span className="font-medium">{article.source_id}</span>
        <span>•</span>
        <span>{formatTime(article.published_at)}</span>
        {article.category && (
          <>
            <span>•</span>
            <span className="capitalize">{article.category}</span>
          </>
        )}
      </motion.div>

      {/* Short Description */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-lg leading-relaxed text-emerald-900 dark:text-cream-200 mb-8 font-medium"
      >
        {article.description}
      </motion.p>

      {/* Article Summary from Source */}
      {article.summary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-8"
        >
          <div className="glass rounded-glass p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-emerald-900 dark:text-cream-200 mb-4">
              {language === 'id' ? 'Ringkasan Artikel' : 'Article Summary'}
            </h2>
            <div className="prose prose-emerald dark:prose-invert max-w-none">
              <p className="text-base leading-relaxed text-emerald-800 dark:text-cream-300 whitespace-pre-line">
                {article.summary}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Button to Read Full Article */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex justify-center mb-8"
      >
        <motion.button
          onClick={handleReadFullArticle}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-full font-semibold shadow-lg transition-colors"
        >
          <span>{language === 'id' ? 'Baca Artikel Lengkap di' : 'Read Full Article on'} {article.source_id}</span>
          <ExternalLink size={18} />
        </motion.button>
      </motion.div>

      {/* Full Content (if available) */}
      {article.content && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="prose prose-emerald dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      )}
    </motion.div>
  );
}


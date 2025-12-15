'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useArticles } from '@/hooks/useArticles';
import { ArticleCard } from '@/components/cards/ArticleCard';
import { RegionLoading } from '@/components/common/RegionLoading';
import { EmptyState } from '@/components/common/EmptyState';
import { useStaggerAnimation } from '@/hooks/useAnimation';
import { checkNewsStatus } from '@/lib/check-news-status';

interface NewsFeedProps {
  category?: string;
}

export function NewsFeed({ category }: NewsFeedProps) {
  const { articles, loading } = useArticles(category);
  const { container, item } = useStaggerAnimation('fast');
  const [articleLimit, setArticleLimit] = useState(12);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // Check news status when no articles
  useEffect(() => {
    if (!loading && articles.length === 0) {
      // Check detailed status from debug endpoint
      fetch('/api/debug/status')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            let message = data.message;
            
            // Add more details
            if (data.articles.total === 0) {
              if (data.database.connected) {
                message += ` Database terhubung. Scheduler sedang memproses...`;
              } else {
                message += ` Error: ${data.database.error || 'Database tidak terhubung'}`;
              }
            } else {
              message = `Ditemukan ${data.articles.total} artikel di database.`;
            }
            
            setStatusMessage(message);
          } else {
            checkNewsStatus().then((status) => {
              setStatusMessage(status.message);
            });
          }
        })
        .catch(() => {
          // Fallback to simple check
          checkNewsStatus().then((status) => {
            setStatusMessage(status.message);
          });
        });
    }
  }, [loading, articles.length]);
  
  // Final filter: Only articles from December 14, 2025 onwards
  const minDate = new Date('2025-12-14T00:00:00.000Z').getTime();
  const filteredArticles = articles.filter((article) => {
    try {
      const publishedTime = new Date(article.published_at).getTime();
      return publishedTime >= minDate;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Limit articles to 4 rows: mobile 1 col (4), tablet 2 cols (8), desktop 3 cols (12)
    const updateLimit = () => {
      const width = window.innerWidth;
      if (width < 640) setArticleLimit(4); // Mobile: 1 column × 4 rows
      else if (width < 1024) setArticleLimit(8); // Tablet: 2 columns × 4 rows
      else setArticleLimit(12); // Desktop: 3 columns × 4 rows
    };

    updateLimit();
    window.addEventListener('resize', updateLimit);
    return () => window.removeEventListener('resize', updateLimit);
  }, []);

  if (loading) {
    return <RegionLoading />;
  }

  if (filteredArticles.length === 0) {
    return <EmptyState statusMessage={statusMessage} />;
  }

  const limitedArticles = filteredArticles.slice(0, articleLimit);

  return (
    <motion.div
      variants={container as any}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8"
      onAnimationComplete={() => {}}
      data-news-grid
    >
      {limitedArticles.map((article, index) => (
        <motion.div key={article.id} variants={item as any} className="w-full">
          <ArticleCard article={article} index={index} />
        </motion.div>
      ))}
    </motion.div>
  );
}


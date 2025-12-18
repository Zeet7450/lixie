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
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile device for animation optimization
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const isMobileDevice = width < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
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
  
  // Final filter: Only articles from last 7 days (rolling window - always current)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 7); // Last 7 days
  minDate.setHours(0, 0, 0, 0); // Start of day
  const minDateTime = minDate.getTime();
  const filteredArticles = articles.filter((article) => {
    try {
      if (!article.published_at) return true; // Accept articles without date
      const publishedTime = new Date(article.published_at).getTime();
      return publishedTime >= minDateTime;
    } catch {
      return true; // Accept articles with invalid date format
    }
  });

  if (loading) {
    return <RegionLoading />;
  }

  if (filteredArticles.length === 0) {
    return <EmptyState statusMessage={statusMessage} />;
  }

  // Show ALL articles - no limit
  return (
    <motion.div
      variants={isMobile ? undefined : container as any}
      initial={isMobile ? undefined : "hidden"}
      animate={isMobile ? undefined : "visible"}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8"
      data-news-grid
    >
      {filteredArticles.map((article, index) => (
        <motion.div 
          key={article.id} 
          variants={isMobile ? undefined : item as any}
          className="w-full"
        >
          <ArticleCard article={article} index={isMobile ? 0 : index} isMobile={isMobile} />
        </motion.div>
      ))}
    </motion.div>
  );
}


'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useAnimation } from '@/hooks/useAnimation';
import Link from 'next/link';
import type { Article } from '@/types';
import { formatTime } from '@/lib/utils';
import { useAnalyticsStore } from '@/store/analytics';

interface ArticleCardProps {
  article: Article;
  index?: number;
  isMobile?: boolean;
}

export function ArticleCard({ article, index = 0, isMobile = false }: ArticleCardProps) {
  const { config, getTransition } = useAnimation();
  const [isHovering, setIsHovering] = useState(false);
  const { addReading } = useAnalyticsStore();
  
  // Optimize animations for mobile - reduce motion
  const shouldAnimate = !isMobile;
  const animationDelay = shouldAnimate ? index * 0.05 : 0;

  const handleArticleView = () => {
    // Track article reading when user views the article (unique reads only)
    // addReading will check if article already read
    addReading(article.id, article.category || 'other');
  };

  return (
    <Link 
      href={`/article/${article.id}`} 
      prefetch={false}
    >
      <motion.article
        onViewportEnter={handleArticleView}
        initial={shouldAnimate ? {
          opacity: 0,
          y: 40,
        } : undefined}
        animate={shouldAnimate ? {
          opacity: 1,
          y: 0,
        } : undefined}
        exit={shouldAnimate ? {
          opacity: 0,
          scale: 0.95,
        } : undefined}
        transition={shouldAnimate ? getTransition({
          ...config.Transitions.standard,
          delay: animationDelay,
        } as any) : { duration: 0 }}
        whileHover={shouldAnimate ? {
          y: -8,
          transition: getTransition(config.Transitions.standard),
        } : undefined}
        onMouseEnter={() => !isMobile && setIsHovering(true)}
        onMouseLeave={() => !isMobile && setIsHovering(false)}
        className="glass rounded-glass overflow-hidden cursor-pointer group relative w-full"
        data-article-card={article.id}
      >
        {/* BADGES - Always show at top */}
        <div className="relative pt-3 px-3 sm:px-4">
          {/* HOT NEWS BADGE */}
          {article.is_breaking && (
            <motion.div
              initial={shouldAnimate ? { scale: 0, rotate: -20 } : undefined}
              animate={shouldAnimate ? { scale: 1, rotate: 0 } : undefined}
              transition={shouldAnimate ? {
                type: 'spring',
                stiffness: 300,
                damping: 15,
              } : { duration: 0 }}
              className="inline-block mb-2"
            >
              <motion.div
                animate={shouldAnimate ? {
                  scale: [1, 1.15, 1],
                  opacity: [1, 0.85, 1],
                } : undefined}
                transition={shouldAnimate ? {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                } : { duration: 0 }}
                className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
              >
                <span>🔥</span>
                <span>HOT</span>
              </motion.div>
            </motion.div>
          )}

          {/* CATEGORY BADGE */}
          <motion.div
            initial={shouldAnimate ? { opacity: 0, y: -10 } : undefined}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={shouldAnimate ? {
              ...config.Transitions.standard,
              delay: animationDelay + 0.05,
            } as any : { duration: 0 }}
            className="inline-block ml-2 bg-white/80 dark:bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold"
          >
            {article.category}
          </motion.div>
        </div>

        {/* CARD CONTENT */}
        <div className="p-3 sm:p-4">
          {/* TITLE */}
          <h3 className="font-bold text-base sm:text-lg line-clamp-2 text-emerald-900 dark:text-cream-200 mb-2 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors">
            {article.title}
          </h3>

          {/* DESCRIPTION */}
          <p className="text-xs sm:text-sm text-emerald-700 dark:text-cream-300 line-clamp-2 mb-3 sm:mb-4">
            {article.description}
          </p>

          {/* FOOTER - Source & Time */}
          <div
            className="flex justify-between items-center gap-2 pt-2 sm:pt-3 pb-10 sm:pb-12 border-t border-gray-300/30 min-w-0"
            data-article-footer={article.id}
          >
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium truncate flex-shrink-0">
              {article.source_id}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-shrink" data-time-text>
              {formatTime(article.published_at)}
            </span>
          </div>

        </div>
      </motion.article>
    </Link>
  );
}


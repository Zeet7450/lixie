'use client';

import { useEffect, useRef } from 'react';
import { useArticlesStore } from '@/store/articles';
import { useRegionStore } from '@/store/region';
import { sendHotNewsNotification, hasNotificationPermission } from '@/lib/notifications';
import type { Article } from '@/types';
import type { NewsRegion } from '@/lib/api';

/**
 * Hook to monitor and send notifications for hot/breaking news
 * Only sends notifications for hot/breaking articles from all regions
 */
export function useHotNewsNotifications() {
  const { articles } = useArticlesStore();
  const { getNewsRegion } = useRegionStore();
  const notifiedArticlesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // Only send notifications if permission is granted
    if (!hasNotificationPermission()) {
      return;
    }

    // Filter for hot/breaking news only
    // HOT criteria: hotness_score >= 80 (8 on 0-10 scale) AND (is_breaking OR is_trending)
    // OR is_breaking published within last 2 hours
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const hotArticles = articles.filter((article) => {
      const isHot = article.hotness_score >= 80 && (article.is_breaking || article.is_trending);
      const isRecentBreaking = article.is_breaking && article.published_at && 
        new Date(article.published_at).getTime() >= twoHoursAgo;
      return isHot || isRecentBreaking;
    });

    // Send notification for new hot articles
    hotArticles.forEach((article) => {
      if (!notifiedArticlesRef.current.has(article.id)) {
        // Mark as notified
        notifiedArticlesRef.current.add(article.id);

        // Get region from article (check source or language)
        let region: NewsRegion = 'intl';
        const articleLanguage = article.language || 'en';
        const articleSource = article.source_id?.toLowerCase() || '';

        if (articleLanguage === 'id' || 
            articleSource.includes('kompas') || 
            articleSource.includes('detik') || 
            articleSource.includes('cnn indonesia') ||
            articleSource.includes('antara')) {
          region = 'id';
        } else if (articleLanguage === 'zh' || 
                   articleSource.includes('xinhua') || 
                   articleSource.includes('chinadaily') ||
                   articleSource.includes('ecns') ||
                   articleSource.includes('ciie')) {
          region = 'cn';
        } else {
          // Check for international sources
          if (articleSource.includes('bbc') ||
              articleSource.includes('reuters') ||
              articleSource.includes('ap news') ||
              articleSource.includes('guardian') ||
              articleSource.includes('al jazeera') ||
              articleSource.includes('euronews')) {
            region = 'intl';
          }
        }

        // Send notification
        sendHotNewsNotification({
          id: article.id,
          title: article.title,
          description: article.description,
          category: article.category,
          region,
          source_id: article.source_id,
        }).catch((error) => {
          console.error('Error sending notification:', error);
        });
      }
    });

    // Clean up old article IDs from notified set (keep last 100)
    if (notifiedArticlesRef.current.size > 100) {
      const articleIds = Array.from(notifiedArticlesRef.current);
      const recentIds = articleIds.slice(-50);
      notifiedArticlesRef.current = new Set(recentIds);
    }
  }, [articles, getNewsRegion]);
}

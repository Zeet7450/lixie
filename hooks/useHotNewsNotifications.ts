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
    const hotArticles = articles.filter(
      (article) => article.is_breaking || (article.is_trending && article.hotness_score >= 80)
    );

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
        } else if (articleLanguage === 'ja' || 
                   articleSource.includes('nhk') || 
                   articleSource.includes('asahi') || 
                   articleSource.includes('japan times') ||
                   articleSource.includes('reuters') && article.title.toLowerCase().includes('japan')) {
          region = 'jp';
        } else if (articleLanguage === 'ko' || 
                   articleSource.includes('yonhap') || 
                   articleSource.includes('kbs') ||
                   articleSource.includes('ap news') && article.title.toLowerCase().includes('korea')) {
          region = 'kr';
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

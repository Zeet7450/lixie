'use client';

import { useEffect, useState } from 'react';
import { useArticlesStore } from '@/store/articles';
import { useRegionStore } from '@/store/region';
import { fetchArticles, sortArticles } from '@/lib/api';

export function useArticles(category?: string) {
  const { articles, setArticles } = useArticlesStore();
  const { region, getNewsRegion } = useRegionStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const loadArticles = async () => {
      setLoading(true);
      try {
        // Get news region from app region setting
        const newsRegion = getNewsRegion();
        
        // Fetch articles from API (with fallback to mock data)
        const fetchedArticles = await fetchArticles(category, newsRegion);
        
        // Sort articles using intelligent sorting algorithm
        const sortedArticles = sortArticles(fetchedArticles);
        
        if (isMounted) {
          setArticles(sortedArticles);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading articles:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadArticles();

    return () => {
      isMounted = false;
    };
  }, [category, region, setArticles, getNewsRegion]); // Add region to dependencies

  return {
    articles,
    loading,
  };
}


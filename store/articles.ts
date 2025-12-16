import { create } from 'zustand';
import type { Article } from '@/types';

interface ArticlesStore {
  articles: Article[];
  bookmarks: number[];
  setArticles: (articles: Article[]) => void;
  addBookmark: (articleId: number) => void;
  removeBookmark: (articleId: number) => void;
  isBookmarked: (articleId: number) => boolean;
}

export const useArticlesStore = create<ArticlesStore>((set, get) => ({
  articles: [],
  bookmarks: [],
  setArticles: (articles) => {
    // Clear existing articles first
    set({ articles: [] });
    
    // Filter articles to only include from December 9, 2025 onwards
    const minDate = new Date('2025-12-09T00:00:00.000Z');
    const minDateTime = minDate.getTime();
    const filtered = articles.filter((article) => {
      try {
        if (!article.published_at) return true; // Accept articles without date
        const publishedTime = new Date(article.published_at).getTime();
        return publishedTime >= minDateTime;
      } catch {
        return true; // Accept articles with invalid date format
      }
    });
    set({ articles: filtered });
  },
  addBookmark: (articleId) => {
    const bookmarks = [...get().bookmarks];
    if (!bookmarks.includes(articleId)) {
      bookmarks.push(articleId);
      set({ bookmarks });
    }
  },
  removeBookmark: (articleId) => {
    const bookmarks = get().bookmarks.filter(id => id !== articleId);
    set({ bookmarks });
  },
  isBookmarked: (articleId) => get().bookmarks.includes(articleId),
}));


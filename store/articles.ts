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
    
    // Filter articles to only include from December 14, 2025 onwards
    const minDate = new Date('2025-12-14T00:00:00.000Z').getTime();
    const filtered = articles.filter((article) => {
      try {
        const publishedTime = new Date(article.published_at).getTime();
        return publishedTime >= minDate;
      } catch {
        return false;
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


export interface Article {
  id: number;
  title: string;
  description: string;
  content?: string;
  summary?: string; // Ringkasan beberapa paragraph dari web asli
  image_url?: string;
  preview_image_url?: string; // Gambar preview dari web asli
  source_url: string;
  source_id: string;
  category: string;
  language?: string;
  hotness_score: number;
  is_breaking: boolean;
  is_trending: boolean;
  views: number;
  shares: number;
  comments: number;
  published_at: string;
  aggregated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Bookmark {
  id: number;
  article_id: number;
  is_read: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
}

export type Language = 'id' | 'en';

export interface UserPreferences {
  preferred_categories: string[];
  language: Language;
  dark_mode: boolean;
  notification_enabled: boolean;
}


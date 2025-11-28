/**
 * Supabase клиент для работы с базой данных
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase не настроен. Проверьте файл .env');
}

/**
 * Supabase клиент
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

/**
 * Проверить, настроен ли Supabase
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Получить текущего пользователя Telegram
 */
export function getCurrentUserId(): string {
  // В DEV режиме используем demo_user
  if (import.meta.env.DEV) {
    return 'demo_user';
  }

  // В продакшене берем из Telegram
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
  }

  return 'demo_user';
}

/**
 * Типы для базы данных
 */
export interface Database {
  public: {
    Tables: {
      cities: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cities']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['cities']['Insert']>;
      };
      restaurants: {
        Row: {
          id: string;
          city_id: string;
          name: string;
          address: string;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['restaurants']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['restaurants']['Insert']>;
      };
      menu_categories: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          description: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['menu_categories']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['menu_categories']['Insert']>;
      };
      menu_items: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          description: string | null;
          price: number;
          weight: string | null;
          image_url: string | null;
          is_vegetarian: boolean;
          is_spicy: boolean;
          is_new: boolean;
          is_recommended: boolean;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['menu_items']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['menu_items']['Insert']>;
      };
      admin_users: {
        Row: {
          id: string;
          telegram_id: number;
          name: string | null;
          role: 'super_admin' | 'admin' | 'user';
          permissions: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['admin_users']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['admin_users']['Insert']>;
      };
    };
  };
}

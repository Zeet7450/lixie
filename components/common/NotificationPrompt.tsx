'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { requestNotificationPermission, initializeNotifications } from '@/lib/notifications';
import { useLanguage } from '@/hooks/useLanguage';

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const { t, language } = useLanguage();

  useEffect(() => {
    // Check if notification permission is already granted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setShowPrompt(false);
        return;
      }

      // Check if user has seen the prompt before (stored in localStorage)
      const hasSeenPrompt = localStorage.getItem('lixie-notification-prompt-seen');
      if (hasSeenPrompt === 'true') {
        setShowPrompt(false);
        return;
      }

      // Show prompt after a delay
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // Show after 3 seconds

      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = async () => {
    setIsRequesting(true);
    
    try {
      // Initialize service worker first
      await initializeNotifications();
      
      // Request permission
      const permission = await requestNotificationPermission();
      
      if (permission.granted) {
        setShowPrompt(false);
        localStorage.setItem('lixie-notification-prompt-seen', 'true');
        
        // Show success message
        if (language === 'id') {
          alert('Notifikasi berhasil diaktifkan! Anda akan menerima notifikasi untuk berita hot/breaking.');
        } else {
          alert('Notifications enabled! You will receive notifications for hot/breaking news.');
        }
      } else if (permission.denied) {
        if (language === 'id') {
          alert('Notifikasi ditolak. Anda dapat mengaktifkannya nanti melalui pengaturan browser.');
        } else {
          alert('Notifications denied. You can enable them later through browser settings.');
        }
        setShowPrompt(false);
        localStorage.setItem('lixie-notification-prompt-seen', 'true');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      if (language === 'id') {
        alert('Terjadi kesalahan saat meminta izin notifikasi.');
      } else {
        alert('An error occurred while requesting notification permission.');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('lixie-notification-prompt-seen', 'true');
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50"
      >
        <div className="bg-cream-200 dark:bg-slate-800 rounded-lg shadow-lg border border-emerald-300 dark:border-emerald-700 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Bell className="text-emerald-700 dark:text-emerald-400" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-cream-200 mb-1">
                {language === 'id' ? 'Aktifkan Notifikasi?' : 'Enable Notifications?'}
              </h3>
              <p className="text-xs text-emerald-700 dark:text-cream-300 mb-3">
                {language === 'id'
                  ? 'Dapatkan notifikasi untuk berita hot dan breaking dari semua region. Hanya berita penting yang akan dikirim.'
                  : 'Get notifications for hot and breaking news from all regions. Only important news will be sent.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleEnable}
                  disabled={isRequesting}
                  className="flex-1 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequesting
                    ? language === 'id'
                      ? 'Memproses...'
                      : 'Processing...'
                    : language === 'id'
                    ? 'Aktifkan'
                    : 'Enable'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-2 text-emerald-700 dark:text-cream-300 text-xs font-medium rounded-full hover:bg-emerald-200/30 dark:hover:bg-emerald-900/30 transition-colors"
                >
                  {language === 'id' ? 'Nanti' : 'Later'}
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 rounded-full hover:bg-emerald-200/30 dark:hover:bg-emerald-900/30 transition-colors"
            >
              <X size={16} className="text-emerald-700 dark:text-cream-300" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LayoutProvider } from '@/components/layout/LayoutProvider';

export const metadata: Metadata = {
  title: 'Lixie - Global News Aggregator',
  description: 'Read news from around the world in one place',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFDD0', // Will be updated dynamically by script
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover', // For iOS fullscreen
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="w-full overflow-x-hidden">
      <head>
        {/* PWA Icons for iOS and Android - Using Lixie Logo */}
        <link rel="icon" href="/images/logo-lixie.png" sizes="192x192" type="image/png" />
        <link rel="icon" href="/images/logo-lixie.png" sizes="512x512" type="image/png" />
        <link rel="apple-touch-icon" href="/images/logo-lixie.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/images/logo-lixie.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/images/logo-lixie.png" />
        {/* PWA Manifest Link */}
        <link rel="manifest" href="/manifest.json" />
        {/* Mobile Fullscreen Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Firefox Mobile PWA Support */}
        <meta name="theme-color" content="#FFFDD0" />
        <meta name="msapplication-TileColor" content="#FFFDD0" />
        <meta name="msapplication-navbutton-color" content="#FFFDD0" />
        {/* Prevent flash of light theme - set theme IMMEDIATELY before any render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const storage = localStorage.getItem('lixie-app-storage');
                  const root = document.documentElement;
                  
                  // Set default dark background immediately to prevent flash
                  root.style.backgroundColor = '#0f172a';
                  root.style.colorScheme = 'dark';
                  const body = document.body;
                  if (body) {
                    body.style.backgroundColor = '#0f172a';
                  }
                  
                  let isDarkMode = false;
                  
                  if (storage) {
                    try {
                      const parsed = JSON.parse(storage);
                      // Zustand persist stores data in parsed.state
                      isDarkMode = parsed?.state?.isDarkMode === true;
                    } catch (e) {
                      // If parsing fails, check system preference
                      isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    }
                  } else {
                    // Fallback: check system preference
                    isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  }
                  
                  if (isDarkMode) {
                    root.classList.add('dark');
                    root.classList.remove('light');
                    root.style.colorScheme = 'dark';
                    root.style.backgroundColor = '#0f172a';
                    if (body) {
                      body.style.backgroundColor = '#0f172a';
                    }
                  } else {
                    root.classList.remove('dark');
                    root.classList.add('light');
                    root.style.colorScheme = 'light';
                    root.style.backgroundColor = '#FFFDD0';
                    if (body) {
                      body.style.backgroundColor = '#FFFDD0';
                    }
                  }
                  
                  // Mark theme as loaded to enable transitions
                  if (body) {
                    body.classList.add('theme-loaded');
                  }
                  
                  // Update theme-color meta tag
                  const metaTheme = document.querySelector('meta[name="theme-color"]');
                  if (metaTheme) {
                    metaTheme.setAttribute('content', isDarkMode ? '#1e293b' : '#FFFDD0');
                  }
                  
                  // Register service worker for PWA (Android)
                  if ('serviceWorker' in navigator) {
                    window.addEventListener('load', () => {
                      navigator.serviceWorker.register('/sw.js', { scope: '/' })
                        .then((registration) => {
                          console.log('✅ Service Worker registered:', registration.scope);
                        })
                        .catch((error) => {
                          console.warn('⚠️ Service Worker registration failed:', error);
                        });
                    });
                  }
                } catch (e) {
                  // Silent fail - use default light theme
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                  document.documentElement.style.colorScheme = 'light';
                  document.documentElement.style.backgroundColor = '#FFFDD0';
                }
              })();
            `,
          }}
        />
      </head>
      <body className="transition-colors duration-400 w-full overflow-x-hidden bg-cream-200 dark:bg-slate-900">
        <LayoutProvider>
          {children}
        </LayoutProvider>
      </body>
    </html>
  );
}


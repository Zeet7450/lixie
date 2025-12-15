import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LayoutProvider } from '@/components/layout/LayoutProvider';

export const metadata: Metadata = {
  title: 'Lixie - Global News Aggregator',
  description: 'Read news from around the world in one place',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#FFFDD0', // Will be updated dynamically by script
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="w-full overflow-x-hidden">
      <head>
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


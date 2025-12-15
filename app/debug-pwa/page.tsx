'use client';

import { useEffect, useState } from 'react';

export default function DebugPWA() {
  const [info, setInfo] = useState<any>({});

  useEffect(() => {
    const checkPWA = async () => {
      const data: any = {
        manifest: null,
        serviceWorker: null,
        icons: {},
      };

      // Check manifest
      try {
        const manifestResponse = await fetch('/manifest.json');
        if (manifestResponse.ok) {
          data.manifest = await manifestResponse.json();
        } else {
          data.manifest = { error: `Status: ${manifestResponse.status}` };
        }
      } catch (error: any) {
        data.manifest = { error: error.message };
      }

      // Check icons
      const iconSizes = [192, 512];
      for (const size of iconSizes) {
        try {
          const iconResponse = await fetch(`/icon-${size}x${size}.png`);
          data.icons[`icon-${size}x${size}.png`] = {
            exists: iconResponse.ok,
            status: iconResponse.status,
            contentType: iconResponse.headers.get('content-type'),
          };
        } catch (error: any) {
          data.icons[`icon-${size}x${size}.png`] = { error: error.message };
        }
      }

      // Check service worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          data.serviceWorker = {
            registered: !!registration,
            scope: registration?.scope,
            active: !!registration?.active,
          };
        } catch (error: any) {
          data.serviceWorker = { error: error.message };
        }
      } else {
        data.serviceWorker = { error: 'Service Worker not supported' };
      }

      // Check if installable
      data.installable = (window as any).deferredPrompt !== undefined;

      setInfo(data);
    };

    checkPWA();
  }, []);

  return (
    <div className="min-h-screen bg-cream-200 dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-emerald-900 dark:text-cream-200">
          PWA Debug Info
        </h1>

        <div className="space-y-6">
          {/* Manifest */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-emerald-800 dark:text-cream-300">
              Manifest.json
            </h2>
            <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(info.manifest, null, 2)}
            </pre>
          </div>

          {/* Icons */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-emerald-800 dark:text-cream-300">
              Icons
            </h2>
            <div className="space-y-2">
              {Object.entries(info.icons || {}).map(([name, data]: [string, any]) => (
                <div key={name} className="flex items-center gap-4">
                  <span className="font-mono text-sm">{name}</span>
                  {data.exists ? (
                    <span className="text-green-600 dark:text-green-400">✓ Accessible</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">✗ Not Found</span>
                  )}
                  {data.contentType && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {data.contentType}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Service Worker */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-emerald-800 dark:text-cream-300">
              Service Worker
            </h2>
            <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(info.serviceWorker, null, 2)}
            </pre>
          </div>

          {/* Installable */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-emerald-800 dark:text-cream-300">
              Installable
            </h2>
            <p className="text-sm">
              {info.installable
                ? '✓ App is installable (beforeinstallprompt event available)'
                : '✗ App is not installable (beforeinstallprompt event not available)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


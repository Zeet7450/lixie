'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface DebugStatus {
  success: boolean;
  groq?: {
    configured: boolean;
    keyLength: number;
  };
  database?: {
    configured: boolean;
    connected: boolean;
    error?: string | null;
    urlPrefix?: string;
  };
  articles?: {
    total: number;
    byRegion?: Record<string, number>;
  };
  scheduler?: {
    running: boolean;
    status?: {
      isRunning: boolean;
      requestCounts: Record<string, number>;
      queueLength: number;
      availableRequests: number;
    };
  };
  message?: string;
  error?: string;
}

export default function DebugPage() {
  const [status, setStatus] = useState<DebugStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);

  useEffect(() => {
    // Check debug status
    fetch('/api/debug/status')
      .then((res) => res.json())
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch((error) => {
        setStatus({
          success: false,
          error: error.message,
        });
        setLoading(false);
      });

    // Check scheduler status
    fetch('/api/scheduler/start')
      .then((res) => res.json())
      .then((data) => {
        setSchedulerStatus(data);
      })
      .catch(() => {
        setSchedulerStatus({ success: false, message: 'Failed to check scheduler' });
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-200 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-emerald-700 dark:text-cream-300">Loading debug info...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-200 dark:bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 space-y-6"
        >
          <h1 className="text-2xl font-bold text-emerald-900 dark:text-cream-200 mb-6">
            🔍 System Debug Status
          </h1>

          {/* Environment Status */}
          {(status?.groq || status?.database) && (
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h2 className="text-lg font-semibold text-emerald-800 dark:text-cream-300 mb-3">
                Environment Variables
              </h2>
              <div className="space-y-2 text-sm">
                {status?.groq && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Groq API Key:</span>
                    <span className={status.groq.configured ? 'text-green-600' : 'text-red-600'}>
                      {status.groq.configured ? `✓ Configured (${status.groq.keyLength} chars)` : '✗ Not configured'}
                    </span>
                  </div>
                )}
                {status?.database && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Database URL:</span>
                      <span className={status.database.configured ? 'text-green-600' : 'text-red-600'}>
                        {status.database.configured ? `✓ Configured` : '✗ Not configured'}
                      </span>
                    </div>
                    {status.database.urlPrefix && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {status.database.urlPrefix}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Database Status */}
          {status?.database && (
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h2 className="text-lg font-semibold text-emerald-800 dark:text-cream-300 mb-3">
                Database Connection
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={status.database.connected ? 'text-green-600' : 'text-red-600'}>
                    {status.database.connected ? '✓ Connected' : `✗ Error: ${status.database.error || 'Not connected'}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Articles Status */}
          {status?.articles && (
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h2 className="text-lg font-semibold text-emerald-800 dark:text-cream-300 mb-3">
                Articles in Database
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Articles:</span>
                  <span className={status.articles.total > 0 ? 'text-green-600 font-semibold' : 'text-yellow-600'}>
                    {status.articles.total}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-gray-600 dark:text-gray-400 mb-2">By Region:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {status.articles.byRegion && Object.entries(status.articles.byRegion).map(([region, count]) => {
                      const regionNames: Record<string, string> = {
                        'id': 'Indonesia',
                        'cn': 'China',
                        'kr': 'Korea',
                        'intl': 'International',
                      };
                      return (
                        <div key={region} className="flex justify-between">
                          <span className="capitalize">{regionNames[region] || region}:</span>
                          <span className={count > 0 ? 'text-green-600' : 'text-gray-400'}>{count as number}</span>
                        </div>
                      );
                    })}
                    {!status.articles.byRegion && (
                      <div className="text-gray-500 dark:text-gray-400">No article data available</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scheduler Status */}
          {status?.scheduler && (
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h2 className="text-lg font-semibold text-emerald-800 dark:text-cream-300 mb-3">
                API Scheduler
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={status.scheduler.running ? 'text-green-600' : 'text-yellow-600'}>
                    {status.scheduler.running ? '✓ Running' : '⚠ Not running'}
                  </span>
                </div>
                {status.scheduler.status && (
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="text-gray-600 dark:text-gray-400 mb-2">Request Counts:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(status.scheduler.status.requestCounts || {}).map(([region, count]) => {
                        const regionNames: Record<string, string> = {
                          'id': 'Indonesia',
                          'cn': 'China',
                          'kr': 'Korea',
                          'intl': 'International',
                        };
                        return (
                          <div key={region} className="flex justify-between">
                            <span className="capitalize">{regionNames[region] || region}:</span>
                            <span className="text-gray-600 dark:text-gray-400">{count as number}/10</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">Queue Length:</span>
                      <span className="text-gray-600 dark:text-gray-400">{status.scheduler.status.queueLength || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Available Requests:</span>
                      <span className="text-gray-600 dark:text-gray-400">{status.scheduler.status.availableRequests || 0}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Message */}
          {status?.message && (
            <div className={`p-4 rounded-lg ${
              status.articles?.total && status.articles.total > 0
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
            }`}>
              <p className="font-medium">{status.message}</p>
            </div>
          )}

          {/* Error */}
          {status?.error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300">
              <p className="font-medium">Error: {status.error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                fetch('/api/scheduler/start', { method: 'POST' })
                  .then((res) => res.json())
                  .then((data) => {
                    alert(data.message || 'Scheduler started');
                    window.location.reload();
                  });
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Start Scheduler
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

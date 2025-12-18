/**
 * Auto-start scheduler when server starts
 * This ensures the scheduler runs continuously even when no users are accessing the site
 */

import { apiScheduler } from './api-scheduler';

let schedulerStarted = false;

/**
 * Start scheduler automatically on server initialization
 * This runs once when the module is first imported
 */
export function autoStartScheduler() {
  // Only run on server-side
  if (typeof window !== 'undefined') return;
  
  // Only start once
  if (schedulerStarted) return;
  
  // Check if scheduler is already running
  if (apiScheduler.isRunning) {
    console.log('✅ API Scheduler is already running');
    schedulerStarted = true;
    return;
  }
  
  // Start scheduler after a short delay to ensure all modules are loaded
  setTimeout(async () => {
    try {
      console.log('🚀 Auto-starting API Scheduler on server initialization...');
      await apiScheduler.start();
      schedulerStarted = true;
      console.log('✅ API Scheduler auto-started successfully');
    } catch (error: any) {
      console.error('❌ Failed to auto-start API Scheduler:', error?.message || error);
      // Retry after 30 seconds
      setTimeout(() => {
        console.log('🔄 Retrying to auto-start API Scheduler...');
        apiScheduler.start().catch((retryError: any) => {
          console.error('❌ Retry failed:', retryError?.message || retryError);
        });
      }, 30000);
    }
  }, 5000); // Wait 5 seconds for all modules to load
}

// Auto-start when this module is imported (server-side only)
if (typeof window === 'undefined') {
  autoStartScheduler();
  
  // Also set up a periodic check to ensure scheduler stays running
  setInterval(() => {
    if (!apiScheduler.isRunning) {
      console.log('⚠️ Scheduler stopped, attempting to restart...');
      apiScheduler.start().catch((error: any) => {
        console.error('❌ Failed to restart scheduler:', error?.message || error);
      });
    }
  }, 60000); // Check every minute
}


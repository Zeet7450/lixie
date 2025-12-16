import { NextResponse } from 'next/server';
import { apiScheduler } from '@/lib/api-scheduler';

export async function POST() {
  try {
    // If already running, stop first to restart with new settings
    if (apiScheduler.isRunning) {
      console.log('Scheduler is running, stopping first to restart with new settings...');
      apiScheduler.stop();
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Start the scheduler (server-side only, has access to env vars)
    await apiScheduler.start();
    
    // Ensure isRunning is set correctly after start
    const isRunning = apiScheduler.isRunning;
    
    return NextResponse.json({
      success: true,
      message: isRunning ? 'API Scheduler started successfully with new date filter (last 7 days)' : 'API Scheduler start attempted but may have failed',
      running: isRunning,
    });
  } catch (error: any) {
    console.error('Error starting API scheduler:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to start API scheduler',
        error: error.toString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      running: apiScheduler.isRunning,
      message: apiScheduler.isRunning 
        ? 'API Scheduler is running' 
        : 'API Scheduler is not running',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to check scheduler status',
      },
      { status: 500 }
    );
  }
}

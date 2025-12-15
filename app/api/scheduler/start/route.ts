import { NextResponse } from 'next/server';
import { apiScheduler } from '@/lib/api-scheduler';

export async function POST() {
  try {
    // Check if already running
    if (apiScheduler.isRunning) {
      return NextResponse.json({
        success: true,
        message: 'API Scheduler is already running',
        running: true,
      });
    }

    // Start the scheduler (server-side only, has access to env vars)
    await apiScheduler.start();
    
    return NextResponse.json({
      success: true,
      message: 'API Scheduler started successfully',
      running: apiScheduler.isRunning,
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

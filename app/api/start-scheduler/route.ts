import { NextResponse } from 'next/server';
import { apiScheduler } from '@/lib/api-scheduler';

/**
 * API endpoint to manually start the scheduler
 * Also ensures scheduler is running if it stopped
 */
export async function POST() {
  try {
    const status = apiScheduler.getStatus();
    
    if (!status.isRunning) {
      console.log('🔄 Starting API scheduler via API endpoint...');
      await apiScheduler.start();
      
      return NextResponse.json({
        success: true,
        message: 'API scheduler started successfully',
        status: apiScheduler.getStatus(),
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'API scheduler is already running',
        status: status,
      });
    }
  } catch (error: any) {
    console.error('Error starting scheduler:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to start scheduler',
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const status = apiScheduler.getStatus();
    
    return NextResponse.json({
      success: true,
      status,
      isRunning: status.isRunning,
      message: status.isRunning 
        ? 'API scheduler is running' 
        : 'API scheduler is not running',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get scheduler status',
    }, { status: 500 });
  }
}


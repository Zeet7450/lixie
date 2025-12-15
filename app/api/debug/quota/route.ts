import { NextResponse } from 'next/server';
import { getQuotaStatus, getQuotaSummary, getTotalRemainingQuota } from '@/lib/model-quota';

/**
 * API endpoint to check model quota status
 * GET /api/debug/quota
 */
export async function GET() {
  try {
    const status = getQuotaStatus();
    const summary = getQuotaSummary();
    const totalRemaining = getTotalRemainingQuota();
    
    return NextResponse.json({
      success: true,
      quota: {
        status,
        summary,
        totalRemaining,
        totalLimit: Object.values(status).reduce((sum, s) => sum + s.limit, 0),
        totalUsed: Object.values(status).reduce((sum, s) => sum + s.used, 0),
      },
      message: `Total remaining quota: ${totalRemaining} requests`,
    });
  } catch (error: any) {
    console.error('Error getting quota status:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Error getting quota status',
        error: error.toString(),
      },
      { status: 500 }
    );
  }
}

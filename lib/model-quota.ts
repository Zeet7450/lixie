/**
 * Model Quota Management System
 * Manages daily quotas for different Groq models with automatic fallback
 */

export type GroqModel = 'deepseek-r1-distill-llama-70b' | 'llama-3.3-70b-versatile' | 'mixtral-8x7b-32768';

interface ModelQuota {
  model: GroqModel;
  dailyLimit: number;
  used: number;
  lastResetDate: string; // YYYY-MM-DD format
  priority: number; // Lower number = higher priority
}

// Model configurations with daily quotas
const MODEL_CONFIGS: Record<GroqModel, { dailyLimit: number; priority: number }> = {
  'deepseek-r1-distill-llama-70b': {
    dailyLimit: 1000, // 1.000 requests per day
    priority: 1, // Primary model (highest priority - best accuracy)
  },
  'llama-3.3-70b-versatile': {
    dailyLimit: 1000, // 1.000 requests per day
    priority: 2, // Backup model (second priority - high quality)
  },
  'mixtral-8x7b-32768': {
    dailyLimit: 14400, // 14.400 requests per day
    priority: 3, // Volume model (third priority - for high volume or simple articles)
  },
};

// In-memory quota tracking (resets on server restart, but also checks daily reset)
const quotaState: Map<GroqModel, ModelQuota> = new Map();

/**
 * Initialize quota state for all models
 */
function initializeQuotaState() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  Object.keys(MODEL_CONFIGS).forEach((modelKey) => {
    const model = modelKey as GroqModel;
    const config = MODEL_CONFIGS[model];
    
    quotaState.set(model, {
      model,
      dailyLimit: config.dailyLimit,
      used: 0,
      lastResetDate: today,
      priority: config.priority,
    });
  });
}

/**
 * Reset quota if it's a new day
 */
function resetQuotaIfNeeded(model: GroqModel) {
  const quota = quotaState.get(model);
  if (!quota) return;
  
  const today = new Date().toISOString().split('T')[0];
  
  if (quota.lastResetDate !== today) {
    console.log(`🔄 Resetting daily quota for ${model} (new day: ${today})`);
    quota.used = 0;
    quota.lastResetDate = today;
  }
}

/**
 * Check if a model has available quota
 */
export function hasQuota(model: GroqModel): boolean {
  if (!quotaState.has(model)) {
    initializeQuotaState();
  }
  
  resetQuotaIfNeeded(model);
  const quota = quotaState.get(model)!;
  
  return quota.used < quota.dailyLimit;
}

/**
 * Use quota for a model (increment usage)
 * Returns true if quota was available and used, false if quota exhausted
 */
export function useQuota(model: GroqModel): boolean {
  if (!quotaState.has(model)) {
    initializeQuotaState();
  }
  
  resetQuotaIfNeeded(model);
  const quota = quotaState.get(model)!;
  
  if (quota.used >= quota.dailyLimit) {
    return false;
  }
  
  quota.used++;
  return true;
}

/**
 * Get available model based on priority and quota
 * Returns the highest priority model that has available quota
 */
export function getAvailableModel(): GroqModel | null {
  if (quotaState.size === 0) {
    initializeQuotaState();
  }
  
  // Get all models sorted by priority (lower = higher priority)
  const models = Array.from(quotaState.values())
    .map(q => q.model)
    .sort((a, b) => {
      const quotaA = quotaState.get(a)!;
      const quotaB = quotaState.get(b)!;
      return quotaA.priority - quotaB.priority;
    });
  
  // Find first model with available quota
  for (const model of models) {
    resetQuotaIfNeeded(model);
    if (hasQuota(model)) {
      return model;
    }
  }
  
  return null; // All quotas exhausted
}

/**
 * Get quota status for all models (for logging/monitoring)
 */
export function getQuotaStatus(): Record<GroqModel, { used: number; limit: number; remaining: number; percentage: number }> {
  if (quotaState.size === 0) {
    initializeQuotaState();
  }
  
  const status: Record<string, any> = {};
  
  quotaState.forEach((quota, model) => {
    resetQuotaIfNeeded(model);
    const remaining = Math.max(0, quota.dailyLimit - quota.used);
    const percentage = (quota.used / quota.dailyLimit) * 100;
    
    status[model] = {
      used: quota.used,
      limit: quota.dailyLimit,
      remaining,
      percentage: Math.round(percentage * 100) / 100,
    };
  });
  
  return status as Record<GroqModel, { used: number; limit: number; remaining: number; percentage: number }>;
}

/**
 * Get formatted quota summary for logging
 */
export function getQuotaSummary(): string {
  const status = getQuotaStatus();
  const lines: string[] = [];
  
  Object.entries(status).forEach(([model, stats]) => {
    const barLength = 20;
    const filled = Math.round((stats.used / stats.limit) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    
    lines.push(
      `  ${model}: ${stats.used}/${stats.limit} [${bar}] ${stats.percentage}% (${stats.remaining} remaining)`
    );
  });
  
  return lines.join('\n');
}

/**
 * Get total remaining quota across all models
 */
export function getTotalRemainingQuota(): number {
  const status = getQuotaStatus();
  return Object.values(status).reduce((sum, stats) => sum + stats.remaining, 0);
}

// Initialize on module load
initializeQuotaState();

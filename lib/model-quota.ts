/**
 * Model Quota Management System
 * Manages daily quotas for different Groq models with automatic fallback
 */

// Updated: Removed decommissioned models (deepseek-r1-distill-llama-70b, mixtral-8x7b-32768, mistral-saba-24b)
// Using only active models: llama-3.3-70b-versatile (primary), llama-3.1-8b-instant (fallback)
export type GroqModel = 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant';

interface ModelQuota {
  model: GroqModel;
  dailyLimit: number;
  used: number;
  lastResetDate: string; // YYYY-MM-DD format
  priority: number; // Lower number = higher priority
}

// Model configurations with daily quotas (only active models)
const MODEL_CONFIGS: Record<GroqModel, { dailyLimit: number; priority: number }> = {
  'llama-3.3-70b-versatile': {
    dailyLimit: 1000, // 1.000 requests per day
    priority: 1, // Primary model (highest priority - best accuracy)
  },
  'llama-3.1-8b-instant': {
    dailyLimit: 14400, // 14.400 requests per day
    priority: 2, // Fallback model (second priority - for high volume, fast response)
  },
};

// In-memory quota tracking (resets on server restart, but also checks daily reset)
const quotaState: Map<GroqModel, ModelQuota> = new Map();

// CRITICAL: Force clear any old/decommissioned models on module load
const ACTIVE_MODELS: GroqModel[] = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
quotaState.clear(); // Clear immediately on module load

/**
 * Initialize quota state for all models
 * CRITICAL: Only initialize active models
 */
function initializeQuotaState() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // CRITICAL: Force clear any old/decommissioned models from state FIRST
  quotaState.clear();
  
  // Only initialize models that are in MODEL_CONFIGS (which only contains active models)
  Object.keys(MODEL_CONFIGS).forEach((modelKey) => {
    const model = modelKey as GroqModel;
    const config = MODEL_CONFIGS[model];
    
    // Double-check: Only add if it's in ACTIVE_MODELS
    if (!ACTIVE_MODELS.includes(model)) {
      console.error(`❌ CRITICAL: Attempted to initialize decommissioned model: ${model}`);
      return;
    }
    
    quotaState.set(model, {
      model,
      dailyLimit: config.dailyLimit,
      used: 0,
      lastResetDate: today,
      priority: config.priority,
    });
  });
  
  console.log(`✓ Initialized quota state for ${quotaState.size} active model(s):`, Array.from(quotaState.keys()));
  
  // CRITICAL: Verify no decommissioned models in state
  const decommissionedModels = Array.from(quotaState.keys()).filter(m => !ACTIVE_MODELS.includes(m));
  if (decommissionedModels.length > 0) {
    console.error(`❌ CRITICAL: Found decommissioned models in state:`, decommissionedModels);
    decommissionedModels.forEach(m => quotaState.delete(m));
    console.log(`✓ Removed decommissioned models from state`);
  }
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
  // CRITICAL: Only check quota for active models
  if (!ACTIVE_MODELS.includes(model)) {
    console.error(`❌ CRITICAL: hasQuota called with decommissioned model: ${model}`);
    return false;
  }
  
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
  // CRITICAL: Only use quota for active models
  if (!ACTIVE_MODELS.includes(model)) {
    console.error(`❌ CRITICAL: useQuota called with decommissioned model: ${model}`);
    return false;
  }
  
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
  // CRITICAL: Force reinitialize if state is empty or contains decommissioned models
  if (quotaState.size === 0) {
    initializeQuotaState();
  } else {
    // Check if state contains any decommissioned models
    const hasDecommissioned = Array.from(quotaState.keys()).some(m => !ACTIVE_MODELS.includes(m));
    if (hasDecommissioned) {
      console.warn(`⚠️ Found decommissioned models in state, reinitializing...`);
      initializeQuotaState();
    }
  }
  
  // Get all models sorted by priority (lower = higher priority)
  // CRITICAL: Filter out any decommissioned models first
  const models = Array.from(quotaState.values())
    .map(q => q.model)
    .filter(m => ACTIVE_MODELS.includes(m)) // Only active models
    .sort((a, b) => {
      const quotaA = quotaState.get(a)!;
      const quotaB = quotaState.get(b)!;
      return quotaA.priority - quotaB.priority;
    });
  
  // #region agent log
  if (typeof window === 'undefined') {
    fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/model-quota.ts:125',message:'getAvailableModel checking models',data:{models:models.map(m=>({model:m,priority:quotaState.get(m)?.priority,hasQuota:hasQuota(m)}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion
  
  // Find first model with available quota
  for (const model of models) {
    // Double-check: Skip any model that's not in active models list
    if (!ACTIVE_MODELS.includes(model)) {
      console.error(`❌ CRITICAL: Found decommissioned model in filtered list: ${model}`);
      continue;
    }
    
    resetQuotaIfNeeded(model);
    if (hasQuota(model)) {
      // #region agent log
      if (typeof window === 'undefined') {
        fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/model-quota.ts:136',message:'getAvailableModel selected model',data:{selectedModel:model,priority:quotaState.get(model)?.priority},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      }
      // #endregion
      return model;
    }
  }
  
  // #region agent log
  if (typeof window === 'undefined') {
    fetch('http://127.0.0.1:7243/ingest/85038818-23fd-4225-a87b-eee28bbc9fae',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/model-quota.ts:140',message:'getAvailableModel no model available',data:{models:models.map(m=>({model:m,quota:quotaState.get(m)}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion
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


// Cost calculation for AI models
// Prices are in USD per million tokens

export interface ModelCost {
  input: number;  // Cost per million input tokens
  output: number; // Cost per million output tokens
}

export interface UsageData {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface FreeTierLimits {
  requestsPerMinute: number;
  requestsPerDay: number;
}

export interface RequestTracker {
  requestsThisMinute: number;
  requestsToday: number;
  lastMinuteReset: number;
  lastDayReset: number;
}

export interface SessionCosts {
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  modelBreakdown: Record<string, {
    cost: number;
    tokens: number;
    requests: number;
  }>;
}

export const FREE_TIER_LIMITS: Record<string, FreeTierLimits> = {
  // Google Gemini free tier limits
  "gemini-2.5-flash-preview-05-20": { requestsPerMinute: 15, requestsPerDay: 1500 },
  "gemini-2.0-flash": { requestsPerMinute: 15, requestsPerDay: 1500 },
  "gemini-1.5-flash-8b": { requestsPerMinute: 15, requestsPerDay: 1500 },
  "gemini-1.5-flash": { requestsPerMinute: 15, requestsPerDay: 1500 },
  "gemini-1.5-pro": { requestsPerMinute: 2, requestsPerDay: 50 },
};

export const MODEL_COSTS: Record<string, ModelCost> = {
  // OpenAI models (costs from console.ai/models.ts)
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  
  // Google Gemini models (2025 pricing)
  "gemini-2.5-flash-preview-05-20": { input: 0.10, output: 0.40 }, // Gemini 2.5 Flash pricing
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  "gemini-1.5-flash-8b": { input: 0.0375, output: 0.15 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 }, // $0.075/1M input, $0.30/1M output
  "gemini-1.5-pro": { input: 1.25, output: 5.0 }, // Under 128k tokens

  // Local models (no cost)
  "qwen3-1.7b": { input: 0, output: 0 },
  "depseek-r1-distill-qwen-7b": { input: 0, output: 0 },
  "google/gemma-2-9b": { input: 0, output: 0 },
  "mistralai/mistral-nemo-instruct-2407": { input: 0, output: 0 },
};

// Global request tracker
const requestTracker: RequestTracker = {
  requestsThisMinute: 0,
  requestsToday: 0,
  lastMinuteReset: Date.now(),
  lastDayReset: Date.now()
};

// Session cost tracking
const sessionCosts: SessionCosts = {
  totalCost: 0,
  totalTokens: 0,
  requestCount: 0,
  modelBreakdown: {}
};

export function trackRequest(modelName: string): {
  withinFreeTier: boolean;
  requestsThisMinute: number;
  requestsToday: number;
  minuteLimit?: number;
  dayLimit?: number;
} {
  const now = Date.now();
  const freeLimits = FREE_TIER_LIMITS[modelName];
  
  // Reset counters if needed
  if (now - requestTracker.lastMinuteReset >= 60000) {
    requestTracker.requestsThisMinute = 0;
    requestTracker.lastMinuteReset = now;
  }
  
  if (now - requestTracker.lastDayReset >= 86400000) {
    requestTracker.requestsToday = 0;
    requestTracker.lastDayReset = now;
  }
  
  // Increment counters
  requestTracker.requestsThisMinute++;
  requestTracker.requestsToday++;
  
  // Check if within free tier
  let withinFreeTier = true;
  if (freeLimits) {
    withinFreeTier = requestTracker.requestsThisMinute <= freeLimits.requestsPerMinute &&
                     requestTracker.requestsToday <= freeLimits.requestsPerDay;
  }
  
  return {
    withinFreeTier,
    requestsThisMinute: requestTracker.requestsThisMinute,
    requestsToday: requestTracker.requestsToday,
    minuteLimit: freeLimits?.requestsPerMinute,
    dayLimit: freeLimits?.requestsPerDay
  };
}

export function calculateCost(modelName: string, usage: UsageData, withinFreeTier?: boolean): {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  formattedCost: string;
} {
  const costs = MODEL_COSTS[modelName];
  
  if (!costs) {
    // Unknown model, assume no cost
    return {
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      formattedCost: "Unknown model cost"
    };
  }
  
  // If within free tier for models that have free tier limits, cost is $0
  if (withinFreeTier && FREE_TIER_LIMITS[modelName]) {
    return {
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      formattedCost: "Free (within limits)"
    };
  }
  
  // Calculate costs (convert from per million to actual tokens)
  const inputCost = (usage.promptTokens / 1_000_000) * costs.input;
  const outputCost = (usage.completionTokens / 1_000_000) * costs.output;
  const totalCost = inputCost + outputCost;
  
  // Format cost string
  let formattedCost: string;
  if (totalCost === 0) {
    formattedCost = "Free (local model)";
  } else if (totalCost < 0.01) {
    formattedCost = `$${(totalCost * 100).toFixed(3)}¢`;
  } else {
    formattedCost = `$${totalCost.toFixed(4)}`;
  }
  
  return {
    inputCost,
    outputCost,
    totalCost,
    formattedCost
  };
}

export function addToSessionCosts(modelName: string, usage: UsageData, actualCost: number) {
  sessionCosts.totalCost += actualCost;
  sessionCosts.totalTokens += usage.totalTokens;
  sessionCosts.requestCount++;
  
  if (!sessionCosts.modelBreakdown[modelName]) {
    sessionCosts.modelBreakdown[modelName] = {
      cost: 0,
      tokens: 0,
      requests: 0
    };
  }
  
  sessionCosts.modelBreakdown[modelName].cost += actualCost;
  sessionCosts.modelBreakdown[modelName].tokens += usage.totalTokens;
  sessionCosts.modelBreakdown[modelName].requests++;
}

export function getSessionCosts(): SessionCosts {
  return { ...sessionCosts };
}

export function formatSessionSummary(): string {
  if (sessionCosts.requestCount === 0) {
    return "No requests made this session";
  }
  
  const costStr = sessionCosts.totalCost === 0 ? "Free" : 
    sessionCosts.totalCost < 0.01 ? `$${(sessionCosts.totalCost * 100).toFixed(3)}¢` :
    `$${sessionCosts.totalCost.toFixed(4)}`;
  
  return `Session: ${sessionCosts.requestCount} requests, ${sessionCosts.totalTokens} tokens, ${costStr} total`;
}

export function formatUsageWithCost(modelName: string, usage: UsageData, trackRequests = true): string {
  let tracking;
  if (trackRequests) {
    tracking = trackRequest(modelName);
  }
  
  const cost = calculateCost(modelName, usage, tracking?.withinFreeTier);
  
  // Add to session costs
  addToSessionCosts(modelName, usage, cost.totalCost);
  
  let requestInfo = "";
  
  if (trackRequests && tracking) {
    if (tracking.minuteLimit && tracking.dayLimit) {
      const freeTierStatus = tracking.withinFreeTier ? "✓ Free tier" : "⚠ Paid tier";
      requestInfo = ` | ${freeTierStatus} (${tracking.requestsThisMinute}/${tracking.minuteLimit}/min, ${tracking.requestsToday}/${tracking.dayLimit}/day)`;
    }
  }
  
  // Add session summary
  const sessionSummary = ` | ${formatSessionSummary()}`;
  
  if (cost.totalCost === 0) {
    return `Tokens: ${usage.promptTokens} in, ${usage.completionTokens} out (${usage.totalTokens} total) | Cost: ${cost.formattedCost}${requestInfo}${sessionSummary}`;
  }
  
  // Format individual costs
  let inputCostStr: string;
  let outputCostStr: string;
  
  if (cost.inputCost < 0.01) {
    inputCostStr = `$${(cost.inputCost * 100).toFixed(3)}¢`;
  } else {
    inputCostStr = `$${cost.inputCost.toFixed(4)}`;
  }
  
  if (cost.outputCost < 0.01) {
    outputCostStr = `$${(cost.outputCost * 100).toFixed(3)}¢`;
  } else {
    outputCostStr = `$${cost.outputCost.toFixed(4)}`;
  }
  
  return `Tokens: ${usage.promptTokens} in (${inputCostStr}), ${usage.completionTokens} out (${outputCostStr}) | Total: ${usage.totalTokens} tokens, ${cost.formattedCost}${requestInfo}${sessionSummary}`;
}
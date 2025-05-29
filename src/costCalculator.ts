// Cost calculation for AI models
// Prices are in USD per million tokens

export interface ModelCost {
  input: number;  // Cost per million input tokens
  output: number; // Cost per million output tokens
}

export interface TTSCost {
  inputPerMillion: number;  // Cost per million input characters
  outputPerMillion: number; // Cost per million output audio tokens
  estimatedPerMinute: number; // Estimated cost per minute of audio
}

export interface TTSUsage {
  inputCharacters: number;
  estimatedMinutes: number;
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
  ttsCost: number;
  ttsCharacters: number;
  ttsMinutes: number;
  ttsRequests: number;
}

export interface AllTimeCosts extends SessionCosts {
  startDate: string;
  lastUpdated: string;
  sessionCount: number;
}

export const FREE_TIER_LIMITS: Record<string, FreeTierLimits> = {
  // Google Gemini free tier limits
  "gemini-2.5-flash-preview-05-20": { requestsPerMinute: 15, requestsPerDay: 1500 },
  "gemini-2.0-flash": { requestsPerMinute: 15, requestsPerDay: 1500 },
  "gemini-1.5-flash-8b": { requestsPerMinute: 15, requestsPerDay: 1500 },
  "gemini-1.5-flash": { requestsPerMinute: 15, requestsPerDay: 1500 },
  "gemini-1.5-pro": { requestsPerMinute: 2, requestsPerDay: 50 },
};

// TTS model costs
export const TTS_COSTS: Record<string, TTSCost> = {
  // OpenAI TTS models (2025 pricing)
  "gpt-4o-mini-tts": {
    inputPerMillion: 0.60,    // $0.60 per 1M characters
    outputPerMillion: 12.00,   // $12.00 per 1M audio tokens
    estimatedPerMinute: 0.015  // $0.015 per minute of audio
  },
  "tts-1": {
    inputPerMillion: 15.00,    // Legacy pricing
    outputPerMillion: 0,       // Charged per input only
    estimatedPerMinute: 0.015
  },
  "tts-1-hd": {
    inputPerMillion: 30.00,    // Legacy HD pricing
    outputPerMillion: 0,       // Charged per input only
    estimatedPerMinute: 0.030
  }
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
  modelBreakdown: {},
  ttsCost: 0,
  ttsCharacters: 0,
  ttsMinutes: 0,
  ttsRequests: 0
};

// File path for persistent storage
const COSTS_FILE = ".costs/costs_data.json";

// Load all-time costs from file
export async function loadAllTimeCosts(): Promise<AllTimeCosts | null> {
  try {
    const data = await Deno.readTextFile(COSTS_FILE);
    return JSON.parse(data);
  } catch {
    // File doesn't exist or is invalid, return null
    return null;
  }
}

// Save all-time costs to file
export async function saveAllTimeCosts(costs: AllTimeCosts): Promise<void> {
  await Deno.writeTextFile(COSTS_FILE, JSON.stringify(costs, null, 2));
}

// Update all-time costs with current session
export async function updateAllTimeCosts(): Promise<void> {
  const allTime = await loadAllTimeCosts();
  const now = new Date().toISOString();
  
  if (!allTime) {
    // First time, create new record
    const newAllTime: AllTimeCosts = {
      ...sessionCosts,
      startDate: now,
      lastUpdated: now,
      sessionCount: 1
    };
    await saveAllTimeCosts(newAllTime);
  } else {
    // Update existing record
    allTime.totalCost += sessionCosts.totalCost;
    allTime.totalTokens += sessionCosts.totalTokens;
    allTime.requestCount += sessionCosts.requestCount;
    allTime.ttsCost += sessionCosts.ttsCost;
    allTime.ttsCharacters += sessionCosts.ttsCharacters;
    allTime.ttsMinutes += sessionCosts.ttsMinutes;
    allTime.ttsRequests += sessionCosts.ttsRequests;
    allTime.lastUpdated = now;
    allTime.sessionCount++;
    
    // Merge model breakdown
    for (const [model, stats] of Object.entries(sessionCosts.modelBreakdown)) {
      if (!allTime.modelBreakdown[model]) {
        allTime.modelBreakdown[model] = { cost: 0, tokens: 0, requests: 0 };
      }
      allTime.modelBreakdown[model].cost += stats.cost;
      allTime.modelBreakdown[model].tokens += stats.tokens;
      allTime.modelBreakdown[model].requests += stats.requests;
    }
    
    await saveAllTimeCosts(allTime);
  }
}

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

export function calculateTTSCost(modelName: string, usage: TTSUsage): {
  cost: number;
  formattedCost: string;
} {
  const costs = TTS_COSTS[modelName];
  
  if (!costs) {
    // Unknown model, assume no cost
    return {
      cost: 0,
      formattedCost: "Unknown TTS model cost"
    };
  }
  
  // Calculate based on input characters and estimated minutes
  // Using estimated per minute cost as primary calculation
  const cost = usage.estimatedMinutes * costs.estimatedPerMinute;
  
  // Format cost string
  let formattedCost: string;
  if (cost === 0) {
    formattedCost = "Free";
  } else if (cost < 0.01) {
    formattedCost = `$${(cost * 100).toFixed(3)}¢`;
  } else {
    formattedCost = `$${cost.toFixed(4)}`;
  }
  
  return {
    cost,
    formattedCost
  };
}

export function addTTSToSessionCosts(modelName: string, usage: TTSUsage) {
  const { cost } = calculateTTSCost(modelName, usage);
  
  sessionCosts.ttsCost += cost;
  sessionCosts.totalCost += cost;
  sessionCosts.ttsCharacters += usage.inputCharacters;
  sessionCosts.ttsMinutes += usage.estimatedMinutes;
  sessionCosts.ttsRequests++;
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
  if (sessionCosts.requestCount === 0 && sessionCosts.ttsRequests === 0) {
    return "No requests made this session";
  }
  
  const costStr = sessionCosts.totalCost === 0 ? "Free" : 
    sessionCosts.totalCost < 0.01 ? `$${(sessionCosts.totalCost * 100).toFixed(3)}¢` :
    `$${sessionCosts.totalCost.toFixed(4)}`;
  
  let summary = `Session: ${sessionCosts.requestCount} AI requests, ${sessionCosts.totalTokens} tokens`;
  
  if (sessionCosts.ttsRequests > 0) {
    summary += `, ${sessionCosts.ttsRequests} TTS (${sessionCosts.ttsMinutes.toFixed(1)}min)`;
  }
  
  summary += `, ${costStr} total`;
  
  return summary;
}

export async function formatAllTimeSummary(): Promise<string> {
  const allTime = await loadAllTimeCosts();
  
  if (!allTime) {
    return "No all-time data available";
  }
  
  const costStr = allTime.totalCost === 0 ? "Free" : 
    allTime.totalCost < 0.01 ? `$${(allTime.totalCost * 100).toFixed(3)}¢` :
    `$${allTime.totalCost.toFixed(4)}`;
  
  const daysSinceStart = Math.floor((Date.now() - new Date(allTime.startDate).getTime()) / (1000 * 60 * 60 * 24));
  
  let summary = `All-time (${daysSinceStart}d, ${allTime.sessionCount} sessions): `;
  summary += `${allTime.requestCount} AI requests, ${allTime.totalTokens} tokens`;
  
  if (allTime.ttsRequests > 0) {
    summary += `, ${allTime.ttsRequests} TTS (${allTime.ttsMinutes.toFixed(1)}min)`;
  }
  
  summary += `, ${costStr} total`;
  
  return summary;
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
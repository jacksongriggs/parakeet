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

export const MODEL_COSTS: Record<string, ModelCost> = {
  // OpenAI models (costs from console.ai/models.ts)
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  
  // Google Gemini models (2025 pricing)
  "gemini-2.5-flash-preview-04-17": { input: 0.10, output: 0.40 }, // Gemini 2.5 Flash pricing
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

export function calculateCost(modelName: string, usage: UsageData): {
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

export function formatUsageWithCost(modelName: string, usage: UsageData): string {
  const cost = calculateCost(modelName, usage);
  
  if (cost.totalCost === 0) {
    return `Tokens: ${usage.promptTokens} in, ${usage.completionTokens} out (${usage.totalTokens} total) | Cost: ${cost.formattedCost}`;
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
  
  return `Tokens: ${usage.promptTokens} in (${inputCostStr}), ${usage.completionTokens} out (${outputCostStr}) | Total: ${usage.totalTokens} tokens, ${cost.formattedCost}`;
}
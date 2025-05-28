// Model and Provider Configuration
import { z } from "zod";
import { MODEL_COSTS } from "./costCalculator.ts";
import { logger } from "./logger.ts";

// Define provider types
export type Provider = "openai" | "google" | "anthropic" | "local";

// Schema for model configuration
export const ModelConfigSchema = z.object({
  provider: z.enum(["openai", "google", "anthropic", "local"]),
  model: z.string(),
  baseURL: z.string().optional(), // Only needed for local/custom endpoints
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.1),
  maxTokens: z.number().optional(),
  description: z.string().optional(),
  capabilities: z.object({
    streaming: z.boolean().default(true),
    toolCalling: z.boolean().default(true),
    contextWindow: z.number().optional(),
  }).optional(),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// Predefined model configurations
export const MODELS: Record<string, ModelConfig> = {
  // Local models
  "local/qwen3-1.7b": {
    provider: "local",
    model: "qwen3-1.7b",
    baseURL: Deno.env.get("LOCAL_AI_URL") || "http://192.168.1.141:1234/v1/",
    description: "Fast, good for basic tasks",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 8192,
    },
  },
  "local/deepseek-r1-distill-qwen-7b": {
    provider: "local",
    model: "depseek-r1-distill-qwen-7b",
    baseURL: Deno.env.get("LOCAL_AI_URL") || "http://192.168.1.141:1234/v1/",
    description: "Advanced reasoning capabilities",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 32768,
    },
  },
  "local/gemma-2-9b": {
    provider: "local",
    model: "google/gemma-2-9b",
    baseURL: Deno.env.get("LOCAL_AI_URL") || "http://192.168.1.141:1234/v1/",
    description: "Google's Gemma model, good balance",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 8192,
    },
  },
  "local/mistral-nemo": {
    provider: "local",
    model: "mistralai/mistral-nemo-instruct-2407",
    baseURL: Deno.env.get("LOCAL_AI_URL") || "http://192.168.1.141:1234/v1/",
    description: "Mistral's efficient model",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 128000,
    },
  },
  
  // OpenAI models
  "openai/gpt-4.1-nano": {
    provider: "openai",
    model: "gpt-4.1-nano",
    apiKey: Deno.env.get("OPENAI_API_KEY"),
    description: "OpenAI's fastest and cheapest model ever ($0.10/1M input, $0.40/1M output)",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 1000000,
    },
  },
  "openai/gpt-4.1-mini": {
    provider: "openai",
    model: "gpt-4.1-mini",
    apiKey: Deno.env.get("OPENAI_API_KEY"),
    description: "Fast model beating GPT-4o in benchmarks ($0.40/1M input, $1.60/1M output)",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 1000000,
    },
  },
  "openai/gpt-4.1": {
    provider: "openai",
    model: "gpt-4.1",
    apiKey: Deno.env.get("OPENAI_API_KEY"),
    description: "Latest GPT-4.1 with improved coding ($2/1M input, $8/1M output)",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 1000000,
    },
  },
  "openai/gpt-4o": {
    provider: "openai",
    model: "gpt-4o",
    apiKey: Deno.env.get("OPENAI_API_KEY"),
    description: "Previous generation GPT-4o model",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 128000,
    },
  },
  "openai/gpt-4o-mini": {
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: Deno.env.get("OPENAI_API_KEY"),
    description: "Previous generation fast model ($0.15/1M input, $0.60/1M output)",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 128000,
    },
  },
  
  // Google models
  "google/gemini-2.5-flash": {
    provider: "google",
    model: "gemini-2.5-flash-preview-05-20",
    apiKey: Deno.env.get("GOOGLE_API_KEY"),
    description: "Google's best price-to-performance model with thinking capabilities",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 1000000,
    },
  },
  "google/gemini-2.0-flash": {
    provider: "google",
    model: "gemini-2.0-flash",
    apiKey: Deno.env.get("GOOGLE_API_KEY"),
    description: "Fast Gemini 2.0 model with multimodal capabilities",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 1000000,
    },
  },
  "google/gemini-1.5-flash": {
    provider: "google",
    model: "gemini-1.5-flash",
    apiKey: Deno.env.get("GOOGLE_API_KEY"),
    description: "Previous generation fast Gemini model",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 1048576, // 1M tokens
    },
  },
  "google/gemini-1.5-flash-8b": {
    provider: "google",
    model: "gemini-1.5-flash-8b",
    apiKey: Deno.env.get("GOOGLE_API_KEY"),
    description: "Previous generation fast Gemini model",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 1048576, // 1M tokens
    },
  },
  "google/gemini-1.5-pro": {
    provider: "google",
    model: "gemini-1.5-pro",
    apiKey: Deno.env.get("GOOGLE_API_KEY"),
    description: "Google's advanced Gemini model",
    temperature: 0.1,
    capabilities: {
      streaming: true,
      toolCalling: true,
      contextWindow: 2097152, // 2M tokens
    },
  },
};

// Get the cheapest non-local model
export function getCheapestModel(): string {
  let cheapestModelId = "";
  let lowestCost = Infinity;
  
  for (const [modelId, config] of Object.entries(MODELS)) {
    // Skip local models
    if (config.provider === "local") continue;
    
    // Get the cost for this model
    const cost = MODEL_COSTS[config.model];
    if (!cost) continue;
    
    // Calculate average cost per token (average of input and output)
    const avgCost = (cost.input + cost.output) / 2;
    
    if (avgCost < lowestCost && avgCost >= 0) {
      lowestCost = avgCost;
      cheapestModelId = modelId;
    }
  }
  
  if (!cheapestModelId) {
    throw new Error("No non-local models with cost information found");
  }
  
  return cheapestModelId;
}

// Get the active model configuration
export function getActiveModelConfig(): ModelConfig {
  // First check for MODEL_ID env var
  let modelId = Deno.env.get("MODEL_ID") || Deno.env.get("ACTIVE_MODEL") || "local/qwen3-1.7b";
  
  // Handle special "cheapest" value
  if (modelId === "cheapest") {
    modelId = getCheapestModel();
    // Log asynchronously without blocking
    logger.info("MODEL", `Selected cheapest model: ${modelId}`).catch(() => {});
  }
  
  if (modelId in MODELS) {
    const config = MODELS[modelId];
    
    // Validate API keys
    if (config.provider === "openai" && !config.apiKey) {
      throw new Error("OpenAI API key not set. Please set OPENAI_API_KEY environment variable.");
    }
    if (config.provider === "google" && !config.apiKey) {
      throw new Error("Google API key not set. Please set GOOGLE_API_KEY environment variable.");
    }
    
    return config;
  }
  
  // If not found, try to parse as custom config from env
  const customProvider = Deno.env.get("AI_PROVIDER") as Provider;
  const customModel = Deno.env.get("AI_MODEL");
  const customBaseURL = Deno.env.get("AI_BASE_URL");
  
  if (customProvider && customModel) {
    return {
      provider: customProvider,
      model: customModel,
      baseURL: customBaseURL,
      apiKey: customProvider === "openai" ? Deno.env.get("OPENAI_API_KEY") : 
              customProvider === "google" ? Deno.env.get("GOOGLE_API_KEY") : undefined,
      temperature: 0.1,
      capabilities: {
        streaming: true,
        toolCalling: true,
      },
    };
  }
  
  throw new Error(`Model configuration '${modelId}' not found. Available models: ${Object.keys(MODELS).join(", ")}`);
}

// List available models
export function listAvailableModels(): void {
  console.log("\n📋 Available AI Models:\n");
  
  const providers = ["local", "openai", "google"] as const;
  
  for (const provider of providers) {
    const models = Object.entries(MODELS).filter(([_, config]) => config.provider === provider);
    
    if (models.length > 0) {
      console.log(`${provider.toUpperCase()} Models:`);
      for (const [id, config] of models) {
        const status = (config.provider === "openai" && !config.apiKey) || 
                       (config.provider === "google" && !config.apiKey) 
                       ? " (⚠️  API key required)" : "";
        console.log(`  - ${id}: ${config.model}${status}`);
        
        // Show cost information if available
        const cost = MODEL_COSTS[config.model];
        if (cost && (cost.input > 0 || cost.output > 0)) {
          console.log(`    💰 Cost: $${cost.input}/M input, $${cost.output}/M output`);
        } else if (config.provider === "local") {
          console.log(`    💰 Cost: Free (local model)`);
        }
        
        if (config.description) {
          console.log(`    ${config.description}`);
        }
      }
      console.log();
    }
  }
  
  // Show cheapest model
  try {
    const cheapestId = getCheapestModel();
    const cheapestConfig = MODELS[cheapestId];
    const cheapestCost = MODEL_COSTS[cheapestConfig.model];
    console.log(`🤑 Cheapest non-local model: ${cheapestId}`);
    console.log(`   Cost: $${cheapestCost.input}/M input, $${cheapestCost.output}/M output\n`);
  } catch (_e) {
    // Ignore if no cheapest model found
  }
  
  console.log("To use a model, set MODEL_ID environment variable:");
  console.log("Example: MODEL_ID=openai/gpt-4.1-nano deno task dev");
  console.log("Example: MODEL_ID=cheapest deno task dev (selects cheapest non-local model)\n");
}

// Helper to get server-specific models (for different local AI servers)
export function getLocalServerModels(serverUrl: string): string[] {
  // Define model lists for known servers
  const serverModels: Record<string, string[]> = {
    "http://192.168.1.141:1234/v1/": [
      "qwen3-1.7b",
      "depseek-r1-distill-qwen-7b", 
      "google/gemma-2-9b",
      "mistralai/mistral-nemo-instruct-2407",
    ],
    "http://localhost:1234/v1/": [
      "qwen2.5-0.5b-instruct-mlx",
      "mlx-community/llama-3.2-1b-instruct",
      "hugging-quants/llama-3.2-1b-instruct",
      "llama-3-groq-8b-tool-use",
    ],
  };
  
  return serverModels[serverUrl] || [];
}
// Configuration constants and environment variables

// export const MODEL = "qwen/qwen3-8b";
export const MODEL = "qwen3-1.7b";
// export const MODEL = 'gpt-4.1-mini';
// export const MODEL = 'mlx-community/llama-3.2-1b-instruct';
// export const MODEL = 'llama-3-groq-8b-tool-use';
// export const MODEL = 'llama_3.2_1b_intruct_tool_calling_v2';

export const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
export const BASE_URL = "http://192.168.1.141:1234/v1/";
// export const BASE_URL = "http://localhost:1234/v1/";
// export const BASE_URL = "";

// Home Assistant configuration
export const HOME_ASSISTANT_URL = Deno.env.get("HOME_ASSISTANT_URL") ||
  "http://homeassistant.local:8123";
export const HOME_ASSISTANT_TOKEN = Deno.env.get("HOME_ASSISTANT_TOKEN") || "";

// Cache configuration
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Wake word configuration
export const WAKE_WORD = "parakeet";
export const WAKE_WORD_TIMEOUT = 10 * 1000; // 10 seconds to give command after wake word
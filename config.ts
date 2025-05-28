// Parakeet Configuration
// This file contains all the configuration options for the Parakeet voice assistant

// ===== AI Model Configuration =====
// Choose your AI provider and model by uncommenting the desired configuration

// Option 1: Local AI server (recommended for privacy)
export const AI_PROVIDER = "local";
export const BASE_URL = "http://localhost:1234/v1/";
export const MODEL = "qwen2.5-0.5b-instruct-mlx";

// Option 2: Remote local server (e.g., on another machine in your network)
// export const AI_PROVIDER = "local";
// export const BASE_URL = "http://192.168.1.141:1234/v1/";
// export const MODEL = "qwen3-1.7b";

// Option 3: OpenAI API (requires API key)
// export const AI_PROVIDER = "openai";
// export const BASE_URL = "https://api.openai.com/v1/";
// export const MODEL = "gpt-4-mini";

// Available local models (for reference):
// - "qwen3-1.7b" - Fast, good for basic tasks
// - "qwen2.5-0.5b-instruct-mlx" - Very fast, lightweight
// - "mlx-community/llama-3.2-1b-instruct" - Good balance
// - "hugging-quants/llama-3.2-1b-instruct" - Alternative Llama model
// - "llama-3-groq-8b-tool-use" - Better tool calling support
// - "qwen/qwen3-8b" - More capable, slower
// - "qwen/qwen3-14b" - Most capable, slowest

// API key for OpenAI (only needed if using OpenAI provider)
export const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

// ===== Home Assistant Configuration =====
// Your Home Assistant instance details

// The URL of your Home Assistant instance
// Default: http://homeassistant.local:8123
// You can also use IP address: http://192.168.1.100:8123
export const HOME_ASSISTANT_URL = Deno.env.get("HOME_ASSISTANT_URL") ||
  "http://homeassistant.local:8123";

// Long-lived access token from Home Assistant
// To create one: Profile → Security → Long-Lived Access Tokens → Create Token
export const HOME_ASSISTANT_TOKEN = Deno.env.get("HOME_ASSISTANT_TOKEN") || "";

// ===== Voice Recognition Configuration =====

// Wake word to activate the assistant
// Say this word to start giving commands
export const WAKE_WORD = "parakeet";

// How long to wait for a command after wake word is detected (in seconds)
export const WAKE_WORD_TIMEOUT = 10;

// Enable partial transcription results for faster response
// This allows the assistant to start processing before you finish speaking
export const USE_PARTIAL_RESULTS = true;

// How long to wait (in milliseconds) before treating a partial result as final
// Lower = faster response, but might cut off mid-sentence
// Higher = more accurate, but slower response
export const PARTIAL_TIMEOUT = 500;

// ===== Performance Configuration =====

// How long to cache Home Assistant entity data (in minutes)
// Reduces API calls to Home Assistant
export const CACHE_DURATION = 5;

// ===== Advanced Configuration =====

// Convert timeout values to milliseconds (don't modify unless you know what you're doing)
export const WAKE_WORD_TIMEOUT_MS = WAKE_WORD_TIMEOUT * 1000;
export const CACHE_DURATION_MS = CACHE_DURATION * 60 * 1000;

// Validate required configuration
if (!HOME_ASSISTANT_TOKEN && HOME_ASSISTANT_URL !== "http://homeassistant.local:8123") {
  console.warn("⚠️  Warning: HOME_ASSISTANT_TOKEN is not set. This is required for Home Assistant integration.");
  console.warn("   Create a token in Home Assistant: Profile → Security → Long-Lived Access Tokens");
  console.warn("   Then set it in your .env file: HOME_ASSISTANT_TOKEN=your-token-here");
}

if (AI_PROVIDER === "openai" && !OPENAI_API_KEY) {
  console.error("❌ Error: OpenAI provider selected but OPENAI_API_KEY is not set.");
  console.error("   Set it in your .env file: OPENAI_API_KEY=your-api-key-here");
  Deno.exit(1);
}
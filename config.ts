// Parakeet Configuration
// This file contains all the configuration options for the Parakeet voice assistant

// ===== AI Model Configuration =====
// The AI model is now configured through the MODEL_ID environment variable
// See modelConfig.ts for available models, or run with --list-models flag
// Example: MODEL_ID=openai-gpt-4-mini deno task dev
// Default: local-qwen3-1.7b

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
export const WAKE_WORD = "polly";

// How long to wait for a command after wake word is detected (in seconds)
export const WAKE_WORD_TIMEOUT = 10;

// Enable partial transcription results for faster response
// This allows the assistant to start processing before you finish speaking
export const USE_PARTIAL_RESULTS = true;

// How long to wait (in milliseconds) before treating a partial result as final
// Lower = faster response, but might cut off mid-sentence
// Higher = more accurate, but slower response
export const PARTIAL_TIMEOUT = 1000;

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
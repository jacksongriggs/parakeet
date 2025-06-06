# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Parakeet is a Deno-based voice-controlled smart home application that 
captures voice commands through ParrotStreamSDK and executes smart home 
automation tasks via the Home Assistant API and music control via Spotify/AirPlay 2.

## Architecture

The application consists of:

- **main.ts**: Entry point that orchestrates voice capture and AI analysis
- **ai.ts**: AI streaming and conversation management using OpenAI-compatible models
- **tools.ts**: Tool definitions for Home Assistant device control
- **homeAssistant.ts**: Home Assistant API integration and entity management
- **config.ts**: Environment configuration and constants
- **modelConfig.ts**: AI model and provider configuration system
- **types.ts**: TypeScript type definitions
- **logger.ts**: Session-based logging system
- **costCalculator.ts**: Token usage and cost tracking for AI requests
- **tts.ts**: Text-to-speech integration for voice responses
- **spotify.ts**: Spotify API integration for music control (planned)
- **airplay.ts**: AirPlay 2 multi-room audio control via Airfoil (planned)

Key functionality:
- Captures microphone audio through ParrotStreamSDK with real-time transcription
- Processes voice commands using AI with tool calling capabilities
- Controls Home Assistant devices (lights, switches, etc.) via REST API
- Voice-controlled music playback via Spotify API and AirPlay 2 multi-room audio
- Maintains conversation history for context-aware interactions
- Supports area-based and individual device control
- Wake word activation system ("polly" by default)
- Cost tracking and usage statistics for AI model calls
- Text-to-speech responses for user feedback

Key dependencies:

- `@parrot/sdk`: Local SDK for audio streaming and transcription (relative import) @../parrot/sdk/index.ts
- `@ai-sdk/openai`: OpenAI SDK for OpenAI and local models
- `@ai-sdk/google`: Google Generative AI SDK for Gemini models
- `ai`: Vercel AI SDK for streaming text generation with tool calling
- `chalk`: Terminal text styling
- `zod`: Schema validation for tool parameters

## Development Commands

```bash
# Run the application in development mode with file watching and environment variables
deno task dev

# Run the application directly
deno run --allow-all --env-file=.env main.ts

# List available AI models
deno run --allow-all --env-file=.env main.ts --list-models

# Run tests
deno test

# Cache dependencies
deno cache --reload main.ts

# Type check without running
deno check main.ts

# Format code
deno fmt

# Lint code
deno lint
```

## Configuration

Environment variables (set in `.env` file):
- `HOME_ASSISTANT_URL`: Home Assistant instance URL (default: http://homeassistant.local:8123)
- `HOME_ASSISTANT_TOKEN`: Long-lived access token for Home Assistant API
- `MODEL_ID`: AI model to use (default: `local/qwen3-1.7b`). Available models:
  - Local: `local/qwen3-1.7b`, `local/deepseek-r1-distill-qwen-7b`, `local/gemma-2-9b`, `local/mistral-nemo`
  - OpenAI: `openai/gpt-4.1-nano`, `openai/gpt-4.1-mini`, `openai/gpt-4.1`, `openai/gpt-4o`, `openai/gpt-4o-mini` (requires `OPENAI_API_KEY`)
  - Google: `google/gemini-2.5-flash`, `google/gemini-2.0-flash`, `google/gemini-1.5-flash`, `google/gemini-1.5-pro`, `google/gemini-1.5-flash-8b` (requires `GOOGLE_API_KEY`)
- `LOCAL_AI_URL`: Override default local AI server URL (optional)
- `OPENAI_API_KEY`: Required for OpenAI models
- `GOOGLE_API_KEY`: Required for Google Gemini models
- `SPOTIFY_CLIENT_ID`: Spotify API client ID for music control (optional)
- `SPOTIFY_CLIENT_SECRET`: Spotify API client secret for music control (optional)
- `AIRFOIL_ENABLED`: Enable AirPlay 2 multi-room audio via Airfoil (optional)

## Architecture Details

### AI System Flow
1. Voice input captured via ParrotStreamSDK (main.ts)
2. Transcribed text sent to AI model via streamText (ai.ts)
3. AI generates response with optional tool calls (tools.ts)
4. Tools execute Home Assistant API calls (homeAssistant.ts)
5. Response streamed back to user with cost tracking

### Model Provider Architecture
- **modelConfig.ts** handles model selection and configuration
- Supports automatic cheapest model selection when no MODEL_ID specified
- Three providers: local (OpenAI-compatible), OpenAI, and Google
- Provider-specific initialization in getAIModel() (ai.ts)

### Tool System
- Tools defined in tools.ts using Vercel AI SDK format
- Each tool has description, zod schema parameters, and execute function
- Home Assistant tools: setLightState, getLightStatus, setClimateControl, getClimateStatus, getAllEntities
- Music control tools: playMusic, controlPlayback, getMusicStatus (planned)
- Tool calls are logged and executed asynchronously

### Home Assistant Integration
- Entity caching with 5-minute TTL to reduce API calls
- Supports both individual entity control and area-based control
- Automatic entity ID resolution from friendly names
- Service calls via REST API with proper error handling

## Important Notes

- Requires microphone permissions (`--allow-all` flag)
- Supports multiple AI providers: local models, OpenAI, and Google Gemini
- Uses local AI endpoint at `http://192.168.1.141:1234/v1/` by default for local models
- Conversation history is maintained with 20-message limit
- Supports both individual light control and area-based control
- Tool calling enables direct Home Assistant API interactions
- Entity caching (5 minutes) for improved performance
- Wake word activation ("polly") with 10-second timeout for commands
- Partial result processing to handle incomplete transcriptions
- Race condition prevention for duplicate utterance processing
- Session-based logging in `logs/` directory with timestamped files
- Automatic cost calculation and cumulative session tracking
- Partial result processing with configurable timeout (500ms default)
- Duplicate utterance prevention with race condition protection
- Light capability detection with intelligent fallbacks (color vs temperature)
- Free tier usage tracking for Google models

## Current Integration Plan

### Home Assistant Expansion
- Exploring gradual expansion of Home Assistant device support
- Planning to add more complex multi-device and scene-based interactions
- Investigating improved natural language understanding for command parsing
- Developing more sophisticated error handling and user feedback mechanisms

### Music Control System (Priority)
- **Phase 1**: Basic Spotify API integration for search and playback control
- **Phase 2**: AirPlay 2 multi-room audio via Airfoil + AppleScript automation
- **Phase 3**: Advanced features like smart device grouping and playlist learning
- **Phase 4**: Integration with Home Assistant scenes and optimization
- See `docs/MUSIC_CONTROL_DESIGN.md` for detailed implementation plan

- Never run the program directly, ask the user to do it

---

**Last updated at commit:** `3e84ce71ac8dab9975304c914ccfc5988e1fcc87`

**REMIND ME NEXT TIME WE TALK**
- need better handling of when a model isn't available, check log @logs/parakeet_2025-05-29_13-27-02.log
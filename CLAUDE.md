# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Parakeet is a Deno-based voice-controlled Home Assistant application that 
captures voice commands through ParrotStreamSDK and executes smart home 
automation tasks via the Home Assistant API.

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

Key functionality:
- Captures microphone audio through ParrotStreamSDK with real-time transcription
- Processes voice commands using AI with tool calling capabilities
- Controls Home Assistant devices (lights, switches, etc.) via REST API
- Maintains conversation history for context-aware interactions
- Supports area-based and individual device control
- Wake word activation system ("parakeet" by default)

Key dependencies:

- `@parrot/sdk`: Local SDK for audio streaming and transcription (relative import)
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
```

## Configuration

Environment variables (set in `.env` file):
- `HOME_ASSISTANT_URL`: Home Assistant instance URL (default: http://homeassistant.local:8123)
- `HOME_ASSISTANT_TOKEN`: Long-lived access token for Home Assistant API
- `MODEL_ID`: AI model to use (default: `local/qwen3-1.7b`). Available models:
  - Local: `local/qwen3-1.7b`, `local/deepseek-r1-distill-qwen-7b`, `local/gemma-2-9b`, `local/mistral-nemo`
  - OpenAI: `openai/gpt-4.1-nano`, `openai/gpt-4.1-mini`, `openai/gpt-4.1`, `openai/gpt-4o`, `openai/gpt-4o-mini` (requires `OPENAI_API_KEY`)
  - Google: `google/gemini-2.5-flash`, `google/gemini-2.0-flash`, `google/gemini-1.5-flash`, `google/gemini-1.5-pro` (requires `GOOGLE_API_KEY`)
- `LOCAL_AI_URL`: Override default local AI server URL (optional)
- `OPENAI_API_KEY`: Required for OpenAI models
- `GOOGLE_API_KEY`: Required for Google Gemini models

## Important Notes

- Requires microphone permissions (`--allow-all` flag)
- Supports multiple AI providers: local models, OpenAI, and Google Gemini
- Uses local AI endpoint at `http://192.168.1.141:1234/v1/` by default for local models
- Conversation history is maintained with 20-message limit
- Supports both individual light control and area-based control
- Tool calling enables direct Home Assistant API interactions
- Entity caching (5 minutes) for improved performance
- Wake word activation with 10-second timeout for commands
- Session-based logging in `logs/` directory

- Never run the program directly, ask the user to do it
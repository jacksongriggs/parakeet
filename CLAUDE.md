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
- `@ai-sdk/openai`: OpenAI SDK configured for local endpoint
- `ai`: Vercel AI SDK for streaming text generation with tool calling
- `chalk`: Terminal text styling
- `zod`: Schema validation for tool parameters

## Development Commands

```bash
# Run the application in development mode with file watching and environment variables
deno task dev

# Run the application directly
deno run --allow-all --env-file=.env main.ts

# Run tests
deno test
```

## Configuration

Environment variables (set in `.env` file):
- `HOME_ASSISTANT_URL`: Home Assistant instance URL (default: http://homeassistant.local:8123)
- `HOME_ASSISTANT_TOKEN`: Long-lived access token for Home Assistant API
- `OPENAI_API_KEY`: Optional, defaults to empty string for local models

The AI model configuration is in `config.ts` (currently `qwen3-1.7b`).

## Important Notes

- Requires microphone permissions (`--allow-all` flag)
- Uses local AI endpoint at `http://192.168.1.141:1234/v1/` by default
- Conversation history is maintained with 20-message limit
- Supports both individual light control and area-based control
- Tool calling enables direct Home Assistant API interactions
- Entity caching (5 minutes) for improved performance
- Wake word activation with 10-second timeout for commands
- Session-based logging in `logs/` directory

- Never run the program directly, ask the user to do it
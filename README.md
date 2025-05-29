# Parakeet

A voice-controlled smart home application that captures voice commands and executes smart home automation tasks via Home Assistant and music control via Spotify/AirPlay 2.

## Features

- 🎤 Real-time voice capture and transcription via ParrotStreamSDK
- 🤖 AI-powered natural language processing for voice commands
- 🏠 Home Assistant integration for device control
- 🎵 Music control via Spotify API and AirPlay 2 multi-room audio
- 💡 Control lights, switches, and other smart home devices
- 🗣️ Context-aware conversations with history tracking
- 🏢 Area-based and individual device control
- 🔊 Text-to-speech responses for user feedback

## Prerequisites

- Deno runtime
- Home Assistant instance
- Microphone access
- Local AI model endpoint (optional)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/parakeet.git
cd parakeet
```

2. Create a `.env` file with your configuration:
```env
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=your_long_lived_access_token

# Optional: Choose AI model (default: local/qwen3-1.7b)
MODEL_ID=local/deepseek-r1-distill-qwen-7b

# For OpenAI models:
# MODEL_ID=openai/gpt-4.1-nano
# OPENAI_API_KEY=your_openai_api_key

# For Google models:
# MODEL_ID=google/gemini-2.5-flash
# GOOGLE_API_KEY=your_google_api_key
```

3. Install dependencies:
```bash
deno cache --reload main.ts
```

## Usage

Run in development mode with file watching:
```bash
deno task dev
```

Or run directly:
```bash
deno run --allow-all --env-file=.env main.ts
```

List available AI models:
```bash
deno run --allow-all --env-file=.env main.ts --list-models
```

## Configuration

### Environment Variables

- `HOME_ASSISTANT_URL`: Your Home Assistant instance URL (default: `http://homeassistant.local:8123`)
- `HOME_ASSISTANT_TOKEN`: Long-lived access token from Home Assistant
- `MODEL_ID`: Choose AI model (see available models with `--list-models`)
- `LOCAL_AI_URL`: Override local AI server URL (optional)
- `OPENAI_API_KEY`: Required for OpenAI models
- `GOOGLE_API_KEY`: Required for Google Gemini models
- `SPOTIFY_CLIENT_ID`: Spotify API client ID for music control (optional)
- `SPOTIFY_CLIENT_SECRET`: Spotify API client secret for music control (optional)
- `AIRFOIL_ENABLED`: Enable AirPlay 2 multi-room audio via Airfoil (optional)

### AI Models

The application supports multiple AI providers:

**Local Models** (default):
- `local/qwen3-1.7b` - Fast, good for basic tasks
- `local/deepseek-r1-distill-qwen-7b` - Advanced reasoning
- `local/gemma-2-9b` - Google's Gemma model
- `local/mistral-nemo` - Mistral's efficient model

**OpenAI Models** (requires API key):
- `openai/gpt-4.1-nano` - Fastest and cheapest ($0.10/1M input, $0.40/1M output)
- `openai/gpt-4.1-mini` - Fast, beats GPT-4o ($0.40/1M input, $1.60/1M output)
- `openai/gpt-4.1` - Latest with improved coding ($2/1M input, $8/1M output)
- `openai/gpt-4o` - Previous generation model
- `openai/gpt-4o-mini` - Previous generation fast model ($0.15/1M input, $0.60/1M output)

**Google Models** (requires API key):
- `google/gemini-2.5-flash` - Best price-to-performance with thinking capabilities
- `google/gemini-2.0-flash` - Fast Gemini 2.0 with multimodal capabilities
- `google/gemini-1.5-flash` - Previous generation fast model (1M context)
- `google/gemini-1.5-pro` - Advanced with 2M context

## Architecture

- **main.ts**: Application entry point
- **ai.ts**: AI streaming and conversation management
- **tools.ts**: Home Assistant device control tools
- **homeAssistant.ts**: Home Assistant API integration
- **tts.ts**: Text-to-speech integration
- **config.ts**: Configuration constants
- **types.ts**: TypeScript definitions
- **logger.ts**: Logging utilities
- **Music Control** (planned):
  - **spotify.ts**: Spotify API integration
  - **airplay.ts**: AirPlay 2 multi-room audio control

## Development

Run tests:
```bash
deno test
```

## License

[Your License Here]
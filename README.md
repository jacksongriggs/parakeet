# Parakeet

A voice-controlled Home Assistant application that captures voice commands and executes smart home automation tasks.

## Features

- 🎤 Real-time voice capture and transcription via ParrotStreamSDK
- 🤖 AI-powered natural language processing for voice commands
- 🏠 Home Assistant integration for device control
- 💡 Control lights, switches, and other smart home devices
- 🗣️ Context-aware conversations with history tracking
- 🏢 Area-based and individual device control

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
OPENAI_API_KEY=optional_key_for_local_models
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

## Configuration

### Environment Variables

- `HOME_ASSISTANT_URL`: Your Home Assistant instance URL (default: `http://homeassistant.local:8123`)
- `HOME_ASSISTANT_TOKEN`: Long-lived access token from Home Assistant
- `OPENAI_API_KEY`: Optional, defaults to empty string for local models

### AI Model

The AI model configuration can be modified in `config.ts`. Default model: `qwen/qwen3-8b`

### Local AI Endpoint

By default, uses local endpoint at `http://192.168.1.141:1234/v1/`

## Architecture

- **main.ts**: Application entry point
- **ai.ts**: AI streaming and conversation management
- **tools.ts**: Home Assistant device control tools
- **homeAssistant.ts**: Home Assistant API integration
- **config.ts**: Configuration constants
- **types.ts**: TypeScript definitions
- **logger.ts**: Logging utilities

## Development

Run tests:
```bash
deno test
```

## License

[Your License Here]
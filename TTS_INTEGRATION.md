# TTS Integration Plan for Parakeet

## Overview

Integrate the new `squawk` module to add text-to-speech capabilities to Parakeet, allowing the AI assistant to speak its responses.

## Integration Points

### 1. Import Squawk Module

```typescript
// In main.ts or a new tts.ts file
import { Speaker, AudioPlayer } from "../squawk/mod.ts";
```

### 2. Initialize TTS Components

```typescript
// Create singleton instances
const speaker = new Speaker({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
  voice: "coral", // or make configurable
  model: "gpt-4o-mini-tts",
  instructions: "Speak as a helpful smart home assistant."
});

const audioPlayer = new AudioPlayer();
```

### 3. Modify AI Response Handler

In `main.ts`, after receiving the AI response:

```typescript
// Current flow:
const response = await streamAIResponse(prompt, tools, conversationHistory);

// Add TTS:
if (response.text && response.text.trim()) {
  try {
    const audio = await speaker.speak(response.text);
    await audioPlayer.play(audio);
  } catch (error) {
    logger.error("TTS error:", error);
    // Continue without TTS if it fails
  }
}
```

### 4. Configuration Options

Add to `.env`:
```
OPENAI_API_KEY=your-key-here
TTS_ENABLED=true
TTS_VOICE=coral
TTS_MODEL=gpt-4o-mini-tts
```

### 5. Handle Interruptions

When a new command is detected, stop current audio:

```typescript
// In processTranscription function
if (audioPlayer.isPlaying) {
  await audioPlayer.stop();
}
```

## Implementation Steps

1. **Update deno.json** to include squawk as a local import
2. **Add TTS configuration** to config.ts
3. **Create tts.ts** module for TTS functionality
4. **Integrate into main.ts** response flow
5. **Add interrupt handling** for new commands
6. **Test with various responses**

## Future Enhancements

- Character voices (different personalities)
- Queue management for multiple responses
- Volume control
- Speed/pitch adjustments
- Alternative TTS providers (RealtimeTTS)
- Streaming TTS (speak while generating)

## Considerations

- **Cost**: OpenAI TTS is ~$0.015 per 1K characters
- **Latency**: TTS generation adds 1-2 seconds
- **Interruptions**: Need smooth handling when user speaks
- **Error handling**: Should not break if TTS fails
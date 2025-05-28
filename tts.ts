/**
 * Text-to-Speech module for Parakeet
 * Handles AI response speech synthesis using the Squawk module
 */

import { Speaker, AudioPlayer } from "@squawk";
import type { SpeechOptions } from "@squawk";
import { logger } from "./logger.ts";
import { 
  TTS_ENABLED, 
  TTS_VOICE, 
  TTS_MODEL, 
  TTS_INSTRUCTIONS 
} from "./config.ts";
import { addTTSToSessionCosts, calculateTTSCost, type TTSUsage } from "./costCalculator.ts";

// Initialize TTS components as singletons
let speaker: Speaker | null = null;
let audioPlayer: AudioPlayer | null = null;

/**
 * Initialize TTS components with OpenAI API key
 */
export function initializeTTS(): void {
  if (!TTS_ENABLED) {
    logger.info("TTS", "TTS is disabled in configuration");
    return;
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    logger.warn("TTS", "TTS enabled but OPENAI_API_KEY not found. TTS will be disabled.");
    return;
  }

  try {
    speaker = new Speaker({
      apiKey,
      voice: TTS_VOICE,
      model: TTS_MODEL,
      instructions: TTS_INSTRUCTIONS,
    });

    audioPlayer = new AudioPlayer();
    logger.info("TTS", "TTS initialized successfully", { voice: TTS_VOICE, model: TTS_MODEL });
  } catch (error) {
    logger.error("TTS", "Failed to initialize TTS", error);
    speaker = null;
    audioPlayer = null;
  }
}

/**
 * Speak the given text using TTS
 * @param text The text to speak
 * @param signal Optional abort signal to cancel speech
 */
export async function speak(text: string, signal?: AbortSignal): Promise<void> {
  if (!TTS_ENABLED || !speaker || !audioPlayer || !text.trim()) {
    return;
  }

  try {
    logger.debug("TTS", "Generating speech", { textLength: text.length });
    
    // Generate speech audio
    const audio = await speaker.speak(text, signal);
    
    // Play the audio (this will calculate exact duration)
    await audioPlayer.play(audio, signal);
    
    // Use exact duration from Squawk SDK if available, otherwise estimate
    const actualMinutes = audio.duration ? audio.duration / 60 : text.length / (5 * 150);
    
    // Track TTS usage for cost calculation
    const ttsUsage: TTSUsage = {
      inputCharacters: text.length,
      estimatedMinutes: actualMinutes
    };
    
    // Add to session costs and get formatted cost
    const { cost, formattedCost } = calculateTTSCost(TTS_MODEL, ttsUsage);
    addTTSToSessionCosts(TTS_MODEL, ttsUsage);
    
    logger.info("TTS", "Speech generated", { 
      model: TTS_MODEL,
      characters: text.length,
      actualDuration: audio.duration ? `${audio.duration.toFixed(2)}s` : "estimated",
      actualMinutes: actualMinutes.toFixed(3),
      cost: formattedCost,
      audioSize: audio.size || "unknown"
    });
    
    logger.debug("TTS", "Speech playback completed");
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
      logger.debug("TTS", "Speech generation/playback aborted");
    } else {
      logger.error("TTS", "TTS error", error);
    }
  }
}

/**
 * Stop any currently playing audio
 */
export async function stopSpeaking(): Promise<void> {
  if (audioPlayer) {
    await audioPlayer.stop();
  }
}

/**
 * Check if audio is currently playing
 */
export function isSpeaking(): boolean {
  return audioPlayer?.isPlaying ?? false;
}

/**
 * Update TTS configuration at runtime
 */
export function updateTTSConfig(options: Partial<SpeechOptions>): void {
  if (speaker) {
    speaker.updateOptions(options);
    logger.info("TTS", "TTS configuration updated", options);
  }
}
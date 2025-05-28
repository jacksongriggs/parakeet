import { ParrotStreamSDK } from "@parrot/sdk";
import { HOME_ASSISTANT_URL, HOME_ASSISTANT_TOKEN, WAKE_WORD, WAKE_WORD_TIMEOUT_MS, USE_PARTIAL_RESULTS, PARTIAL_TIMEOUT } from "./config.ts";
import { abort, analyse } from "./ai.ts";
import { tools } from "./tools.ts";
import { logger } from "./logger.ts";
import { getActiveModelConfig, listAvailableModels } from "./modelConfig.ts";
import { detectUtteranceContinuation, cancelAndRollback } from "./generationTracker.ts";

await logger.sessionStart();

// Show model configuration
const modelConfig = getActiveModelConfig();
await logger.info("CONFIG", "Environment configuration", {
  HOME_ASSISTANT_URL,
  HOME_ASSISTANT_TOKEN: HOME_ASSISTANT_TOKEN ? "Token is set" : "Token is empty",
  AI_MODEL: `${modelConfig.provider}/${modelConfig.model}`,
  MODEL_DESCRIPTION: modelConfig.description
});

// Show available models if requested
if (Deno.args.includes("--list-models")) {
  listAvailableModels();
  Deno.exit(0);
}


// Helper function to strip wake word from command text
function stripWakeWord(text: string): string {
  const lowerText = text.toLowerCase();
  const lowerWakeWord = WAKE_WORD.toLowerCase();
  
  // Find wake word and remove it along with any leading/trailing whitespace
  const wakeWordIndex = lowerText.indexOf(lowerWakeWord);
  if (wakeWordIndex !== -1) {
    const beforeWake = text.substring(0, wakeWordIndex).trim();
    const afterWake = text.substring(wakeWordIndex + WAKE_WORD.length).trim();
    
    // Combine non-empty parts with a space
    const parts = [beforeWake, afterWake].filter(part => part.length > 0);
    return parts.join(' ').trim();
  }
  
  return text.trim();
}

async function parrot(): Promise<void> {
  await logger.info("MAIN", "Initializing ParrotStreamSDK");
  
  let isAwake = false;
  let wakeTimeout: number | null = null;
  let lastPartialTime: number | null = null;
  let partialTimeout: number | null = null;
  let lastPartialText: string | null = null;
  const processedUtteranceIds = new Set<string>();
  
  const parrot = new ParrotStreamSDK({
    channels: [1],
    device: "MacBook Pro Microphone",
    addsPunctuation: true,
    taskHint: "search",
    vocabulary: ["catio", "basso", WAKE_WORD],
    noPartialResults: !USE_PARTIAL_RESULTS  // This improves performance and reduces delay when false
  });

  parrot.on("transcription", async (result) => {
    const {
      channel,
      utterance: {
        utterance: { id, text, isBoundary },
      },
    } = result;

    if (isBoundary) {
      // Clear any pending partial timeout
      if (partialTimeout) {
        clearTimeout(partialTimeout);
        partialTimeout = null;
      }
      
      // Check if we already processed this utterance
      if (processedUtteranceIds.has(id)) {
        await logger.debug("VOICE", "Skipping already processed utterance", { id, text });
        return;
      }
      
      // Check for utterance continuation (same utterance ID, new/longer text)
      if (detectUtteranceContinuation(id, text)) {
        await logger.info("VOICE", "Detected utterance continuation - cancelling and rolling back", { 
          utteranceId: id, 
          newText: text 
        });
        
        const rollbackSuccess = await cancelAndRollback("Utterance continuation detected");
        if (rollbackSuccess) {
          await logger.info("VOICE", "Rollback successful, processing updated command", { text });
        } else {
          await logger.error("VOICE", "Rollback failed, processing updated command anyway", { text });
        }
      }
      
      processedUtteranceIds.add(id);
      const lowerText = text.toLowerCase();
      
      // Check if this is the wake word
      if (lowerText.includes(WAKE_WORD.toLowerCase())) {
        isAwake = true;
        
        // Clear any existing timeout
        if (wakeTimeout) {
          clearTimeout(wakeTimeout);
        }
        
        // Set new timeout
        wakeTimeout = setTimeout(() => {
          isAwake = false;
          wakeTimeout = null;
          logger.info("WAKE", "Wake word timeout - going back to sleep");
        }, WAKE_WORD_TIMEOUT_MS);
        
        await logger.info("WAKE", "Wake word detected! Listening for commands...", { wake_word: WAKE_WORD });
        await logger.info("WAKE_DISPLAY", `🦜 ${WAKE_WORD} detected! Listening...`);
        
        // If the text is just the wake word, don't process it as a command
        const withoutWakeWord = lowerText.replace(WAKE_WORD.toLowerCase(), "").trim();
        if (!withoutWakeWord) {
          // Still set up partial monitoring even if just wake word
          lastPartialText = null;
          return;
        }
        
        // If there's text after the wake word, process it
        const commandText = stripWakeWord(text);
        if (commandText) {
          abort();
          
          await logger.info("VOICE", "Processing command after wake word", { text: commandText, channel });
          await logger.info("VOICE_DISPLAY", `Channel ${channel}: ${commandText}`);
          
          try {
            const aiResult = await analyse(commandText, tools, id);
            await logger.info("AI", "AI analysis completed", { input: commandText, output: aiResult });
            await logger.info("AI_OUTPUT", aiResult);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logger.error("AI", "AI analysis failed", { input: commandText, error: errorMessage });
            throw error;
          }
        }
      } else if (isAwake) {
        // We're awake and this is a command
        abort();
        
        const commandText = stripWakeWord(text);
        await logger.info("VOICE", "Voice command received", { text: commandText, channel });
        await logger.info("VOICE_DISPLAY", `Channel ${channel}: ${commandText}`);
        
        try {
          const aiResult = await analyse(commandText, tools, id);
          await logger.info("AI", "AI analysis completed", { input: commandText, output: aiResult });
          await logger.info("AI_OUTPUT", aiResult);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await logger.error("AI", "AI analysis failed", { input: commandText, error: errorMessage });
          throw error;
        }
        
        // Reset wake state after processing command
        isAwake = false;
        if (wakeTimeout) {
          clearTimeout(wakeTimeout);
          wakeTimeout = null;
        }
        
        // Clean up old utterance IDs periodically (keep last 50)
        if (processedUtteranceIds.size > 100) {
          const keepIds = Array.from(processedUtteranceIds).slice(-50);
          processedUtteranceIds.clear();
          keepIds.forEach(id => processedUtteranceIds.add(id));
        }
      } else {
        // Not awake, waiting for wake word
        await logger.debug("WAKE", "Waiting for wake word", { text, wake_word: WAKE_WORD });
      }
    } else {
      // Handle partial transcriptions with timeout
      const now = Date.now();
      await logger.debug("VOICE", "Partial transcription", { 
        text, 
        channel,
        timestamp: now,
        timeSinceLastPartial: lastPartialTime ? now - lastPartialTime : 0
      });
      
      // Check for utterance continuation in partials too
      if (detectUtteranceContinuation(id, text)) {
        await logger.info("VOICE", "Detected utterance continuation in partial - cancelling and rolling back", { 
          utteranceId: id, 
          newText: text 
        });
        
        const rollbackSuccess = await cancelAndRollback("Partial utterance continuation detected");
        if (rollbackSuccess) {
          await logger.info("VOICE", "Partial rollback successful", { text });
        } else {
          await logger.error("VOICE", "Partial rollback failed", { text });
        }
      }
      
      lastPartialTime = now;
      lastPartialText = text;
      
      // Check for wake word in partial transcriptions too
      const lowerText = text.toLowerCase();
      if (!isAwake && lowerText.includes(WAKE_WORD.toLowerCase())) {
        isAwake = true;
        
        // Clear any existing timeout
        if (wakeTimeout) {
          clearTimeout(wakeTimeout);
        }
        
        // Set new timeout
        wakeTimeout = setTimeout(() => {
          isAwake = false;
          wakeTimeout = null;
          logger.info("WAKE", "Wake word timeout - going back to sleep");
        }, WAKE_WORD_TIMEOUT_MS);
        
        await logger.info("WAKE", "Wake word detected in partial! Listening for commands...", { wake_word: WAKE_WORD });
        await logger.info("WAKE_DISPLAY", `🦜 ${WAKE_WORD} detected! Listening...`);
      }
      
      // Clear existing timeout
      if (partialTimeout) {
        clearTimeout(partialTimeout);
      }
      
      // Set timeout to process partial as final if no boundary arrives
      if (isAwake && USE_PARTIAL_RESULTS) {
        partialTimeout = setTimeout(async () => {
          const partialId = `${id}_partial_${Date.now()}`;
          if (lastPartialText && !processedUtteranceIds.has(id) && !processedUtteranceIds.has(partialId)) {
            const commandText = stripWakeWord(lastPartialText);
            
            // Skip processing if command is empty after stripping wake word
            if (!commandText.trim()) {
              await logger.info("VOICE", "Skipping partial timeout - no command after wake word", { 
                originalText: lastPartialText,
                strippedText: commandText,
                channel,
                timeoutMs: PARTIAL_TIMEOUT 
              });
              partialTimeout = null;
              return;
            }
            
            await logger.info("VOICE", "Processing partial as final (timeout)", { 
              text: commandText, 
              channel,
              timeoutMs: PARTIAL_TIMEOUT 
            });
            
            // Mark both IDs as processed to avoid duplicates
            processedUtteranceIds.add(id);
            processedUtteranceIds.add(partialId);
            
            // Process as a command
            abort();
            await logger.info("VOICE_DISPLAY", `Channel ${channel}: ${commandText}`);
            
            try {
              const aiResult = await analyse(commandText, tools, partialId);
              await logger.info("AI", "AI analysis completed", { input: commandText, output: aiResult });
              await logger.info("AI_OUTPUT", aiResult);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              await logger.error("AI", "AI analysis failed", { input: commandText, error: errorMessage });
              throw error;
            }
            
            // Reset wake state after processing command
            isAwake = false;
            if (wakeTimeout) {
              clearTimeout(wakeTimeout);
              wakeTimeout = null;
            }
          }
          partialTimeout = null;
        }, PARTIAL_TIMEOUT);
      }
    }
  });

  await logger.info("MAIN", "Starting voice capture");
  await logger.info("WAKE", `Say "${WAKE_WORD}" to activate voice commands`);
  await parrot.start();
  
  // Keep the process alive
  await new Promise(() => {});
}

if (import.meta.main) {
  try {
    await parrot();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    await logger.error("MAIN", "Application crashed", { error: errorMessage, stack: errorStack });
    throw error;
  } finally {
    await logger.sessionEnd();
  }
}

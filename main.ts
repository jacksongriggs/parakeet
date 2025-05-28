import { ParrotStreamSDK } from "@parrot/sdk";
import { HOME_ASSISTANT_URL, HOME_ASSISTANT_TOKEN, WAKE_WORD, WAKE_WORD_TIMEOUT, USE_PARTIAL_RESULTS, PARTIAL_TIMEOUT } from "./config.ts";
import { abort, analyse } from "./ai.ts";
import { tools } from "./tools.ts";
import { logger } from "./logger.ts";

await logger.sessionStart();

await logger.info("CONFIG", "Environment configuration", {
  HOME_ASSISTANT_URL,
  HOME_ASSISTANT_TOKEN: HOME_ASSISTANT_TOKEN ? "Token is set" : "Token is empty"
});


async function parrot(): Promise<void> {
  await logger.info("MAIN", "Initializing ParrotStreamSDK");
  
  let isAwake = false;
  let wakeTimeout: number | null = null;
  let lastPartialTime: number | null = null;
  let partialTimeout: number | null = null;
  let lastPartialText: string | null = null;
  let processedUtteranceIds = new Set<string>();
  
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
        }, WAKE_WORD_TIMEOUT);
        
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
        const commandText = text.substring(text.toLowerCase().indexOf(WAKE_WORD.toLowerCase()) + WAKE_WORD.length).trim();
        if (commandText) {
          abort();
          
          await logger.info("VOICE", "Processing command after wake word", { text: commandText, channel });
          await logger.info("VOICE_DISPLAY", `Channel ${channel}: ${commandText}`);
          
          try {
            const aiResult = await analyse(commandText, tools);
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
        
        await logger.info("VOICE", "Voice command received", { text, channel });
        await logger.info("VOICE_DISPLAY", `Channel ${channel}: ${text}`);
        
        try {
          const aiResult = await analyse(text, tools);
          await logger.info("AI", "AI analysis completed", { input: text, output: aiResult });
          await logger.info("AI_OUTPUT", aiResult);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await logger.error("AI", "AI analysis failed", { input: text, error: errorMessage });
          throw error;
        }
        
        // Reset wake state after processing command
        isAwake = false;
        if (wakeTimeout) {
          clearTimeout(wakeTimeout);
          wakeTimeout = null;
        }
        
        // Clean up old utterance IDs periodically (keep last 100)
        if (processedUtteranceIds.size > 100) {
          const idsArray = Array.from(processedUtteranceIds);
          processedUtteranceIds = new Set(idsArray.slice(-50));
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
      lastPartialTime = now;
      lastPartialText = text;
      
      // Clear existing timeout
      if (partialTimeout) {
        clearTimeout(partialTimeout);
      }
      
      // Set timeout to process partial as final if no boundary arrives
      if (isAwake && USE_PARTIAL_RESULTS) {
        partialTimeout = setTimeout(async () => {
          if (lastPartialText && !processedUtteranceIds.has(id)) {
            await logger.info("VOICE", "Processing partial as final (timeout)", { 
              text: lastPartialText, 
              channel,
              timeoutMs: PARTIAL_TIMEOUT 
            });
            
            // Mark as processed to avoid duplicates
            processedUtteranceIds.add(id);
            
            // Process as a command
            abort();
            await logger.info("VOICE_DISPLAY", `Channel ${channel}: ${lastPartialText}`);
            
            try {
              const aiResult = await analyse(lastPartialText, tools);
              await logger.info("AI", "AI analysis completed", { input: lastPartialText, output: aiResult });
              await logger.info("AI_OUTPUT", aiResult);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              await logger.error("AI", "AI analysis failed", { input: lastPartialText, error: errorMessage });
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

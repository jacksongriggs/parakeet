// AI and OpenAI functionality

import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Tool } from "ai";
import { OPENAI_API_KEY, BASE_URL, MODEL } from "./config.ts";
import { getAvailableLights } from "./homeAssistant.ts";
import type { Message } from "./types.ts";
import { logger } from "./logger.ts";

export const openai = createOpenAI({ apiKey: OPENAI_API_KEY, baseURL: BASE_URL });
export const encoder = new TextEncoder();
export let abortController = new AbortController();

// Conversation history
export let conversationHistory: Message[] = [];

export function abort() {
  try {
    abortController.abort();
    abortController = new AbortController();
    logger.debug("AI", "Aborted previous AI request");
  } catch (_err) {
    //
  }
}

export async function analyse(text: string, tools: Record<string, Tool>): Promise<string> {
  await logger.debug("AI", "Starting analysis", { input: text, toolCount: Object.keys(tools).length });
  
  // Add user message to history
  conversationHistory.push({
    role: "user",
    content: text,
    timestamp: new Date(),
  });

  // Keep only last 10 messages to prevent context overflow
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-20);
    await logger.debug("AI", "Trimmed conversation history", { newLength: conversationHistory.length });
  }

  // Get available lights
  const lights = await getAvailableLights();
  const lightsList = lights.map((l) => {
    const areaInfo = l.area ? ` in ${l.area}` : "";
    return `- ${l.friendly_name} (${l.entity_id})${areaInfo}`;
  }).join("\n");

  try {
    await logger.debug("AI", "Calling AI model", { model: MODEL, lightsCount: lights.length });
    
    const { textStream } = streamText({
      model: openai(MODEL),
      //       experimental_repairToolCall: async ({ toolCall, error }) => {
      //         // Use LLM to repair the tool call based on the error and expected schema
      //         const tool = tools[toolCall.toolName];
      //         if (!tool) return null;

      //         try {
      //           // Get the expected schema for this tool
      //           const schemaDescription = tool.parameters.describe
      //             ? tool.parameters.describe()
      //             : JSON.stringify(tool.parameters, null, 2);

      //           const { text: repairedArgs } = await generateText({
      //             model: openai(MODEL),
      //             messages: [
      //               {
      //                 role: 'system',
      //                 content: `You are a tool argument repair assistant. Fix the malformed tool arguments to match the expected schema.

      // Tool: ${toolCall.toolName}
      // Expected Schema: ${schemaDescription}
      // Error: ${error}

      // Return ONLY a valid JSON object that matches the schema. Do not include any explanation or markdown.`
      //               },
      //               {
      //                 role: 'user',
      //                 content: `Current malformed arguments: ${toolCall.args}

      // Fix these arguments to match the expected schema. Return only the corrected JSON.`
      //               }
      //             ],
      //             temperature: 0.1,
      //             maxTokens: 200,
      //           });

      //           // Strip any markdown formatting
      //           let cleanedArgs = repairedArgs.trim();
      //           if (cleanedArgs.startsWith('```json')) {
      //             cleanedArgs = cleanedArgs.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      //           } else if (cleanedArgs.startsWith('```')) {
      //             cleanedArgs = cleanedArgs.replace(/^```\s*/, '').replace(/\s*```$/, '');
      //           }

      //           // Validate the repaired JSON
      //           const parsedArgs = JSON.parse(cleanedArgs);

      //           // Return the repaired tool call
      //           return {
      //             ...toolCall,
      //             args: JSON.stringify(parsedArgs)
      //           };
      //         } catch (repairError) {
      //           console.error(chalk.red(`Failed to repair tool call: ${repairError}`));
      //           return null;
      //         }
      //       },
      messages: [
        ...conversationHistory.slice(0, -1).map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: "user",
          content: text,
        },
      ],
      system:
        `Home Assistant voice control. Use exact entity_ids from list, never friendly names.

RULES:
- Use entity_id (e.g. "light.dimmable_light_4") not friendly names ("Pendant 1")
- "all X" = find EVERY matching light in full list
- Always use tools for device control
- Light control: setLightState (individual/multiple) or setLightStateByArea (area-based)
- Climate control: setTemperature (individual) or setAreaTemperature (area-based)
- Light color temp: setLightTemperature or setAreaLightTemperature (warm/cool/daylight)
- Don't think too hard about it - the requests are usually pretty simple so don't second guess yourself.
- You should aim to respond as quickly as possible, and you can do this by saying as little as possible.

Available lights:
${lightsList || "(No lights detected)"}

Common mappings:
Pendant 1-5 → light.dimmable_light_4 through light.dimmable_light_8

Examples:
"all pendant lights" → setLightState with ALL pendant entity_ids
"lounge room lights off" → setLightStateByArea area="lounge", state="off"
"floor lamp on" → setLightState lights="light.floor_lamp", state="on"
"set lounge AC to 24" → setAreaTemperature area="lounge", temperature=24
"warm white in bedroom" → setAreaLightTemperature area="bedroom", temperature="warm white"`,
      abortSignal: abortController.signal,
      tools,
      maxSteps: 1,
      temperature: 0.1
    });

    let result = "";
    let tokenCount = 0;
    for await (const part of textStream) {
      result += part;
      tokenCount++;
    }

    await logger.debug("AI", "AI response generated", { 
      outputLength: result.length, 
      tokenCount, 
      conversationLength: conversationHistory.length 
    });

    // Add assistant response to history
    conversationHistory.push({
      role: "assistant",
      content: result,
      timestamp: new Date(),
    });

    return result;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      await logger.debug("AI", "AI request aborted");
      return "";
    } else {
      const error = err as Error;
      await logger.error("AI", "AI analysis error", { error: error.message, input: text });
      throw err;
    }
  }
}

export async function write(...text: string[]) {
  for (const part of text) {
    await Deno.stdout.write(encoder.encode(part));
  }
}
// AI and OpenAI functionality
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Tool, LanguageModel, CoreToolMessage, CoreAssistantMessage, CoreMessage } from "ai";
import { getAvailableLights } from "./homeAssistant.ts";
import type { Message } from "./types.ts";
import { logger } from "./logger.ts";
import { getActiveModelConfig, type ModelConfig } from "./modelConfig.ts";
import { formatUsageWithCost, formatAllTimeSummary } from "./costCalculator.ts";
import { startGeneration, completeGeneration } from "./generationTracker.ts";

export let abortController = new AbortController();

// Get the AI model instance based on configuration
function getAIModel(config: ModelConfig): LanguageModel {
  switch (config.provider) {
    case "openai": {
      const openai = createOpenAI({ 
        apiKey: config.apiKey,
        baseURL: config.baseURL, // Only used for custom endpoints
        compatibility: "strict", // Enable token usage tracking
      });
      return openai(config.model);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: config.apiKey! });
      return google(config.model);
    }
    case "local": {
      // Local models use OpenAI-compatible API
      const localAI = createOpenAI({ 
        apiKey: config.apiKey || "",
        baseURL: config.baseURL!,
        // Don't use strict mode for local models as they may not support it
      });
      return localAI(config.model);
    }
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

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

export async function analyse(text: string, tools: Record<string, Tool>, utteranceId?: string): Promise<string> {
  await logger.debug("AI", "Starting analysis", { input: text, toolCount: Object.keys(tools).length });
  
  // Start tracking this generation
  startGeneration(utteranceId || `manual_${Date.now()}`, text, abortController);
  
  // Add user message to history
  conversationHistory.push({
    role: "user",
    content: text,
    timestamp: new Date(),
  });

  // Keep only last 10 messages to prevent context overflow
  if (conversationHistory.length > 10) {
    conversationHistory = conversationHistory.slice(-10);
    await logger.debug("AI", "Trimmed conversation history", { newLength: conversationHistory.length });
  }

  // Get available lights - only entity IDs to reduce tokens
  const lights = await getAvailableLights();
  const lightsList = lights.map(l => l.entity_id).join(", ");

  try {
    const modelConfig = getActiveModelConfig();
    await logger.debug("AI", "Calling AI model", { 
      provider: modelConfig.provider,
      model: modelConfig.model, 
      lightsCount: lights.length 
    });
    
    const { textStream } = streamText({
      model: getAIModel(modelConfig),
      messages: [
        // Single few-shot example
        {
          role: "user" as const,
          content: "turn on kitchen lights",
        },
        {
          role: "assistant" as const,
          content: [
            {
              type: "text" as const,
              text: "Sure thing! Getting those kitchen lights on for you.",
            },
            {
              type: "tool-call" as const,
              toolCallId: "example1",
              toolName: "setLightStateByArea",
              args: { area: "kitchen", state: "on" },
            },
          ],
        },
        {
          role: "tool" as const,
          content: [
            {
              type: "tool-result" as const,
              toolCallId: "example1",
              toolName: "setLightStateByArea",
              result: { success: true },
            },
          ],
        },
        // Actual conversation history
        ...conversationHistory.slice(0, -1).map((msg): CoreMessage => {
          // Handle tool messages with content arrays
          if (msg.role === "tool" && Array.isArray(msg.content)) {
            return {
              role: "tool" as const,
              content: msg.content as CoreToolMessage["content"],
            };
          }
          // Handle assistant messages with tool calls
          if (msg.role === "assistant" && Array.isArray(msg.content)) {
            return {
              role: "assistant" as const,
              content: msg.content as CoreAssistantMessage["content"],
            };
          }
          // Regular text messages
          return {
            role: msg.role as "user" | "assistant",
            content: msg.content as string,
          };
        }),
        {
          role: "user" as const,
          content: text,
        },
      ],
      system:
        `You're a chill, friendly smart home assistant. Your responses will be spoken aloud via text-to-speech, so write naturally for speech - avoid complex punctuation, abbreviations, or symbols. Be warm, down-to-earth, and happy but keep responses super brief. Available lights: ${lightsList || "none"}. If entities don't exist, use findEntity or getAllEntities to discover available devices. Always use tools for control. Keep it short but sweet! Do not repeat yourself.`,
      abortSignal: abortController.signal,
      tools,
      maxSteps: 5,
      temperature: modelConfig.temperature || 0.1,
      maxTokens: modelConfig.maxTokens,
      onFinish: async ({ usage: finalUsage }) => {
        // Log usage and cost if available
        if (finalUsage && finalUsage.promptTokens && finalUsage.completionTokens) {
          const usageStr = formatUsageWithCost(modelConfig.model, {
            promptTokens: finalUsage.promptTokens,
            completionTokens: finalUsage.completionTokens,
            totalTokens: finalUsage.totalTokens
          });
          const allTimeStr = await formatAllTimeSummary();
          await logger.info("AI", `💰 ${usageStr}`);
          await logger.info("AI", `📊 ${allTimeStr}`);
        }
      },
      onStepFinish: async (stepResult) => {
        await logger.debug("AI", "Step finished", { 
          toolCalls: stepResult.toolCalls?.length || 0,
          toolResults: stepResult.toolResults?.length || 0,
          text: stepResult.text?.slice(0, 100)
        });
        
        // Store tool calls in conversation history
        if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
          const assistantContent: CoreAssistantMessage["content"] = [];
          if (stepResult.text) {
            assistantContent.push({ type: "text", text: stepResult.text });
          }
          stepResult.toolCalls.forEach((tc) => {
            assistantContent.push({
              type: "tool-call",
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args
            });
          });
          
          conversationHistory.push({
            role: "assistant",
            content: assistantContent,
            timestamp: new Date()
          });
        } else if (stepResult.text) {
          // Only add text-only responses to history if there are no tool calls
          // This prevents duplication when the final result already includes all text
          conversationHistory.push({
            role: "assistant",
            content: stepResult.text,
            timestamp: new Date()
          });
        }
        
        // Store tool results in conversation history  
        if (stepResult.toolResults && stepResult.toolResults.length > 0) {
          interface ToolResult {
            toolCallId: string;
            toolName: string;
            result: unknown;
          }
          const toolContent: CoreToolMessage["content"] = stepResult.toolResults.map((tr: ToolResult) => {
            // Type guard for tool result structure
            if (tr satisfies Partial<ToolResult> && 
              tr.toolCallId && tr.toolName && 'result' in tr) {
              return {
                type: "tool-result" as const,
                toolCallId: tr.toolCallId as string,
                toolName: tr.toolName as string,
                result: tr.result
              };
            }
            throw new Error('Invalid tool result structure');
          });
          
          conversationHistory.push({
            role: "tool",
            content: toolContent,
            timestamp: new Date()
          });
        }
      }
    });

    let result = "";
    let tokenCount = 0;
    for await (const part of textStream) {
      result += part;
      tokenCount++;
    }
    
    // Clean up any duplicated text that might occur from step processing
    result = result.trim();

    await logger.debug("AI", "AI response generated", { 
      outputLength: result.length, 
      tokenCount, 
      conversationLength: conversationHistory.length 
    });

    // Only add final assistant response if it's different from the last message
    // This prevents duplication from step processing
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    const shouldAddFinalResponse = !lastMessage || 
      lastMessage.role !== "assistant" || 
      (typeof lastMessage.content === "string" && lastMessage.content !== result) ||
      (Array.isArray(lastMessage.content) && !lastMessage.content.some((c: any) => c.type === "tool-call"));
    
    if (shouldAddFinalResponse && result.trim()) {
      conversationHistory.push({
        role: "assistant",
        content: result,
        timestamp: new Date(),
      });
    }

    // Mark generation as completed successfully
    completeGeneration();
    
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
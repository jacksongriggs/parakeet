// Generation tracking and state management for handling incomplete utterances

import { logger } from "./logger.ts";
import { callHomeAssistantService } from "./homeAssistant.ts";

export interface EntityStateSnapshot {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  timestamp: number;
}

export interface ActiveGeneration {
  id: string;
  utteranceId: string;
  text: string;
  startTime: number;
  entitySnapshots: EntityStateSnapshot[];
  toolCallsExecuted: string[];
  abortController: AbortController;
}

// Track active generation
let activeGeneration: ActiveGeneration | null = null;

// Create a unique generation ID
function generateId(): string {
  return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Start tracking a new generation
export function startGeneration(utteranceId: string, text: string, abortController: AbortController): string {
  const generationId = generateId();
  
  activeGeneration = {
    id: generationId,
    utteranceId,
    text,
    startTime: Date.now(),
    entitySnapshots: [],
    toolCallsExecuted: [],
    abortController
  };
  
  logger.debug("GENERATION", "Started tracking generation", { 
    generationId, 
    utteranceId, 
    text: text.slice(0, 50) + (text.length > 50 ? "..." : "")
  });
  
  return generationId;
}

// Check if we have an active generation and if utteranceId matches
export function isGenerationActive(utteranceId: string): boolean {
  return activeGeneration !== null && activeGeneration.utteranceId === utteranceId;
}

// Get current generation info
export function getCurrentGeneration(): ActiveGeneration | null {
  return activeGeneration;
}

// Store entity state before tool execution
export async function captureEntityState(entityId: string): Promise<void> {
  if (!activeGeneration) return;
  
  try {
    // Get current state from Home Assistant
    const response = await fetch(`${Deno.env.get("HOME_ASSISTANT_URL") || "http://homeassistant.local:8123"}/api/states/${entityId}`, {
      headers: {
        "Authorization": `Bearer ${Deno.env.get("HOME_ASSISTANT_TOKEN")}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get entity state: ${response.statusText}`);
    }
    
    const entityState = await response.json();
    
    const snapshot: EntityStateSnapshot = {
      entity_id: entityId,
      state: entityState.state,
      attributes: entityState.attributes,
      timestamp: Date.now()
    };
    
    // Check if we already have a snapshot for this entity
    const existingIndex = activeGeneration.entitySnapshots.findIndex(s => s.entity_id === entityId);
    if (existingIndex === -1) {
      activeGeneration.entitySnapshots.push(snapshot);
      
      await logger.debug("GENERATION", "Captured entity state", { 
        generationId: activeGeneration.id,
        entityId,
        state: snapshot.state,
        attributeKeys: Object.keys(snapshot.attributes)
      });
    }
  } catch (error) {
    await logger.error("GENERATION", "Failed to capture entity state", { 
      generationId: activeGeneration?.id,
      entityId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Record that a tool was executed
export function recordToolExecution(toolName: string): void {
  if (!activeGeneration) return;
  
  activeGeneration.toolCallsExecuted.push(toolName);
  logger.debug("GENERATION", "Recorded tool execution", {
    generationId: activeGeneration.id,
    toolName,
    totalToolsExecuted: activeGeneration.toolCallsExecuted.length
  });
}

// Cancel current generation and rollback changes
export async function cancelAndRollback(reason: string): Promise<boolean> {
  if (!activeGeneration) {
    await logger.debug("GENERATION", "No active generation to cancel");
    return false;
  }
  
  const generation = activeGeneration;
  
  await logger.info("GENERATION", "Cancelling generation and rolling back", {
    generationId: generation.id,
    reason,
    toolsExecuted: generation.toolCallsExecuted.length,
    entitiesAffected: generation.entitySnapshots.length,
    originalText: generation.text
  });
  
  // Abort the current AI request
  try {
    generation.abortController.abort();
  } catch (_error) {
    // Ignore abort errors
  }
  
  // Rollback entity states
  let rollbackSuccesses = 0;
  let rollbackFailures = 0;
  
  for (const snapshot of generation.entitySnapshots) {
    try {
      await restoreEntityState(snapshot);
      rollbackSuccesses++;
    } catch (error) {
      rollbackFailures++;
      await logger.error("GENERATION", "Failed to rollback entity state", {
        generationId: generation.id,
        entityId: snapshot.entity_id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  await logger.info("GENERATION", "Rollback completed", {
    generationId: generation.id,
    rollbackSuccesses,
    rollbackFailures,
    totalEntities: generation.entitySnapshots.length
  });
  
  // Clear active generation
  activeGeneration = null;
  
  return rollbackFailures === 0;
}

// Restore an entity to its previous state
async function restoreEntityState(snapshot: EntityStateSnapshot): Promise<void> {
  const { entity_id, state, attributes } = snapshot;
  
  // Determine service and data based on entity domain
  const domain = entity_id.split('.')[0];
  
  switch (domain) {
    case 'light': {
      if (state === 'off') {
        await callHomeAssistantService('light', 'turn_off', { entity_id });
      } else {
        const serviceData: Record<string, unknown> = { entity_id };
        
        // Restore brightness
        if (attributes.brightness) {
          serviceData.brightness = attributes.brightness;
        }
        
        // Restore color
        if (attributes.rgb_color) {
          serviceData.rgb_color = attributes.rgb_color;
        } else if (attributes.color_temp_kelvin) {
          serviceData.color_temp_kelvin = attributes.color_temp_kelvin;
        }
        
        await callHomeAssistantService('light', 'turn_on', serviceData);
      }
      break;
    }
    case 'climate': {
      // Restore HVAC mode
      if (attributes.hvac_mode) {
        await callHomeAssistantService('climate', 'set_hvac_mode', {
          entity_id,
          hvac_mode: attributes.hvac_mode
        });
      }
      
      // Restore temperature
      if (attributes.temperature) {
        await callHomeAssistantService('climate', 'set_temperature', {
          entity_id,
          temperature: attributes.temperature
        });
      }
      break;
    }
    case 'media_player': {
      if (state === 'off') {
        await callHomeAssistantService('media_player', 'turn_off', { entity_id });
      } else {
        await callHomeAssistantService('media_player', 'turn_on', { entity_id });
        
        // Restore volume
        if (attributes.volume_level) {
          await callHomeAssistantService('media_player', 'volume_set', {
            entity_id,
            volume_level: attributes.volume_level
          });
        }
      }
      break;
    }
    default: {
      await logger.warn("GENERATION", "Cannot rollback unknown domain", { domain, entity_id });
    }
  }
  
  await logger.debug("GENERATION", "Restored entity state", { 
    entity_id, 
    restoredState: state,
    keyAttributes: Object.keys(attributes).slice(0, 5)
  });
}

// Complete current generation successfully
export function completeGeneration(): void {
  if (!activeGeneration) return;
  
  logger.info("GENERATION", "Generation completed successfully", {
    generationId: activeGeneration.id,
    toolsExecuted: activeGeneration.toolCallsExecuted.length,
    entitiesAffected: activeGeneration.entitySnapshots.length,
    duration: Date.now() - activeGeneration.startTime
  });
  
  activeGeneration = null;
}

// Check if a new utterance is a continuation/correction of current generation
export function detectUtteranceContinuation(utteranceId: string, newText: string): boolean {
  if (!activeGeneration) return false;
  
  // Same utterance ID means it's a continuation
  if (activeGeneration.utteranceId === utteranceId) {
    // Check if new text is significantly longer or different
    const isLonger = newText.length > activeGeneration.text.length + 10;
    const isDifferent = !newText.toLowerCase().includes(activeGeneration.text.toLowerCase());
    
    if (isLonger || isDifferent) {
      logger.info("GENERATION", "Detected utterance continuation", {
        generationId: activeGeneration.id,
        originalText: activeGeneration.text,
        newText,
        isLonger,
        isDifferent
      });
      return true;
    }
  }
  
  return false;
}
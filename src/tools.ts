// Tool definitions for Home Assistant control

import { Tool } from "ai";
import { z } from "zod";
import { callHomeAssistantService, getAvailableLights, getAvailableClimateEntities, getAllEntities, supportsColorControl, supportsTemperatureControl, getAvailableMediaPlayers, getMusicAssistantPlayers, resolveMusicPlayers } from "./homeAssistant.ts";
import type { ClimateEntity, MediaPlayer } from "./types.ts";
import { logger } from "./logger.ts";
import { captureEntityState, recordToolExecution } from "./generationTracker.ts";

// Color temperature mappings (in Kelvin)
const colorTemperatureMap: Record<string, number> = {
  "warm white": 2700,
  "soft white": 3000,
  "warm": 3000,
  "neutral white": 4000,
  "neutral": 4000,
  "cool white": 5000,
  "cool": 5000,
  "daylight": 6500,
  "cold": 6500,
};

// Color name mappings
const colorMap: Record<string, { r: number; g: number; b: number }> = {
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 255, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  white: { r: 255, g: 255, b: 255 },
  yellow: { r: 255, g: 255, b: 0 },
  orange: { r: 255, g: 165, b: 0 },
  purple: { r: 128, g: 0, b: 128 },
  pink: { r: 255, g: 192, b: 203 },
  cyan: { r: 0, g: 255, b: 255 },
  magenta: { r: 255, g: 0, b: 255 },
  lime: { r: 0, g: 255, b: 0 },
  indigo: { r: 75, g: 0, b: 130 },
  violet: { r: 238, g: 130, b: 238 },
  turquoise: { r: 64, g: 224, b: 208 },
  coral: { r: 255, g: 127, b: 80 },
  gold: { r: 255, g: 215, b: 0 },
};

function getRandomColor(): { r: number; g: number; b: number } {
  return {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
  };
}

// Shared light control function that handles capability checking
async function controlLights(
  lightInputs: string | string[],
  params: {
    state?: "on" | "off";
    brightness?: number;
    color?: { r: number; g: number; b: number };
    temperature?: number;
  }
): Promise<string> {
  const { state, brightness, color, temperature } = params;
  
  // Normalize to array
  const lightArray = Array.isArray(lightInputs) ? lightInputs : [lightInputs];

  // Get available lights and validate entities exist
  const availableLights = await getAvailableLights();
  const lightEntitiesMap = new Map(availableLights.map(l => [l.entity_id, l]));
  
  // Filter out non-existent entities and get light objects
  const validLightEntities = lightArray.map(light => {
    const entity_id = light.includes(".") ? light : `light.${light}`;
    const lightEntity = lightEntitiesMap.get(entity_id);
    if (!lightEntity) {
      logger.warn("TOOL", "Skipping non-existent light entity", { entity_id });
    }
    return lightEntity;
  }).filter(Boolean) as typeof availableLights;

  if (validLightEntities.length === 0) {
    await logger.warn("TOOL", "No valid lights found", { requested: lightArray });
    return "No valid lights found to control.";
  }

  // Check capabilities and warn about unsupported features
  if (color) {
    const unsupportedColorLights = validLightEntities.filter(light => !supportsColorControl(light));
    if (unsupportedColorLights.length > 0) {
      await logger.warn("TOOL", "Some lights don't support color control", { 
        unsupportedLights: unsupportedColorLights.map(l => l.entity_id),
        willFallbackToTemperature: unsupportedColorLights.some(l => supportsTemperatureControl(l))
      });
    }
  }

  if (temperature) {
    const unsupportedTempLights = validLightEntities.filter(light => !supportsTemperatureControl(light));
    if (unsupportedTempLights.length > 0) {
      await logger.warn("TOOL", "Some lights don't support temperature control", { 
        unsupportedLights: unsupportedTempLights.map(l => l.entity_id),
        supportedColorModes: unsupportedTempLights.map(l => l.supported_color_modes)
      });
    }
  }

  // Capture entity states before making changes
  await Promise.all(validLightEntities.map(entity => captureEntityState(entity.entity_id)));

  // Create promises for all light operations
  const promises = validLightEntities.map(async (lightEntity) => {
    try {
      const entity_id = lightEntity.entity_id;

      const serviceData: Record<string, string | number | number[]> = {
        entity_id: entity_id,
      };

      if (state === "on") {
        if (brightness !== undefined) {
          serviceData.brightness = brightness;
        }
        
        // Handle color with capability checking
        if (color) {
          if (supportsColorControl(lightEntity)) {
            serviceData.rgb_color = [color.r, color.g, color.b];
          } else if (supportsTemperatureControl(lightEntity)) {
            // Fallback to warm white temperature for color requests on temp-only lights
            serviceData.color_temp_kelvin = 3000;
            await logger.info("TOOL", "Falling back to warm temperature for color request", { entity_id });
          } else {
            await logger.warn("TOOL", "Light supports neither color nor temperature", { entity_id });
          }
        }
        
        // Handle temperature with capability checking
        if (temperature) {
          if (supportsTemperatureControl(lightEntity)) {
            serviceData.color_temp_kelvin = temperature;
          } else {
            await logger.warn("TOOL", "Light doesn't support temperature control", { entity_id });
          }
        }
      }

      await callHomeAssistantService(
        "light",
        state === "on" ? "turn_on" : "turn_off",
        serviceData,
      );
      await logger.debug("TOOL", "Light control successful", { entity_id });
      return { success: true, entity_id };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      await logger.error("TOOL", "Light control failed", { entity_id: lightEntity.entity_id, error: errorMessage });
      return { success: false, entity_id: lightEntity.entity_id, error: errorMessage };
    }
  });

  // Execute all promises in parallel
  const results = await Promise.all(promises);

  // Separate successes and failures
  const successes = results.filter((r) => r.success).map((r) => r.entity_id);
  const failures = results.filter((r) => !r.success).map((r) => `${r.entity_id}: ${r.error}`);

  // Build response message
  let response;
  const stateDesc = state === "on" ? "on" : "off";
  const brightnessDesc = brightness ? ` with brightness ${brightness}` : "";
  const colorDesc = color ? ` with color` : "";
  const tempDesc = temperature ? ` at ${temperature}K` : "";
  
  if (successes.length > 0 && failures.length === 0) {
    response = `Successfully turned ${successes.join(", ")} ${stateDesc}${brightnessDesc}${colorDesc}${tempDesc}.`;
    await logger.info("TOOL", "All lights controlled successfully", { successes, state });
  } else if (successes.length > 0 && failures.length > 0) {
    response = `Turned ${successes.join(", ")} ${stateDesc}. Failed to control: ${failures.join("; ")}`;
    await logger.warn("TOOL", "Partial light control success", { successes, failures });
  } else {
    response = `Failed to control lights: ${failures.join("; ")}`;
    await logger.error("TOOL", "All light controls failed", { failures });
  }
  
  return response;
}

const z_setLightState = z.object({
  lights: z.union([
    z.string().describe("A single entity_id"),
    z.array(z.string()).describe("An array of entity_ids"),
  ]).describe("The entity_id(s) of the light(s) to control"),
  state: z.enum(["on", "off"]),
  brightness: z.number().min(0).max(255).optional().describe(
    "Brightness level (0-255)",
  ),
  color: z.object({
    r: z.number().min(0).max(255),
    g: z.number().min(0).max(255),
    b: z.number().min(0).max(255),
  }).optional().describe("RGB color values"),
});

export const tools: Record<string, Tool> = {
  findEntity: {
    description: "Find entity by name or partial name match - use this when you're not sure about exact entity names",
    parameters: z.object({
      name: z.string().describe("Entity name or partial name to search for (e.g., 'polly', 'TV', 'lounge')"),
      domain: z.string().optional().describe("Optional domain filter (e.g., 'media_player', 'light', 'climate')"),
    }),
    execute: async ({ name, domain }) => {
      await logger.info("TOOL", "Finding entity by name", { name, domain });
      
      try {
        const result = await getAllEntities(domain);
        const { entitiesByDomain } = result;
        
        const matchedEntities: Array<{ entity_id: string; friendly_name: string; domain: string; state: string }> = [];
        
        // Search through all entities
        Object.entries(entitiesByDomain).forEach(([domainName, entities]) => {
          entities.forEach(entity => {
            const nameMatch = entity.friendly_name.toLowerCase().includes(name.toLowerCase()) || 
                            entity.entity_id.toLowerCase().includes(name.toLowerCase());
            if (nameMatch) {
              matchedEntities.push({
                entity_id: entity.entity_id,
                friendly_name: entity.friendly_name,
                domain: domainName,
                state: entity.state
              });
            }
          });
        });
        
        if (matchedEntities.length === 0) {
          return `No entities found matching "${name}"${domain ? ` in ${domain} domain` : ''}. Use getAllEntities to see what's available.`;
        }
        
        const matchList = matchedEntities.map(e => 
          `- ${e.friendly_name} (${e.entity_id}) [${e.state}] - ${e.domain}`
        ).join('\n');
        
        await logger.info("TOOL", "Found matching entities", { 
          searchTerm: name, 
          domain, 
          matchCount: matchedEntities.length 
        });
        
        return `Found ${matchedEntities.length} entities matching "${name}":\n${matchList}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to find entity", { name, domain, error: errorMessage });
        return `Failed to search for entities: ${errorMessage}`;
      }
    },
  },
  getAllEntities: {
    description: "Get all entities from Home Assistant to explore what devices are available",
    parameters: z.object({
      domain: z.string().optional().describe("Optional domain filter (e.g., 'media_player', 'switch', 'sensor'). If not provided, returns all entities"),
    }),
    execute: async ({ domain }) => {
      await logger.info("TOOL", "Getting all entities from Home Assistant", { domain });
      
      try {
        const result = await getAllEntities(domain);
        const { totalEntities, domainCount, domains, entitiesByDomain } = result;

        // Log detailed information
        const summary = Object.entries(entitiesByDomain).map(([domainName, entities]) => {
          const entityList = entities.map(e => `  - ${e.friendly_name} (${e.entity_id}) [${e.state}]`).join('\n');
          return `${domainName.toUpperCase()} (${entities.length} entities):\n${entityList}`;
        }).join('\n\n');

        await logger.info("HA_DISCOVERY", "Complete Home Assistant entity inventory", { 
          totalEntities,
          domainCount,
          domains,
          filteredBy: domain || "none"
        });

        // Log the full breakdown
        await logger.info("HA_DISCOVERY", "Entity breakdown by domain", { summary });

        const domainCounts = Object.entries(entitiesByDomain)
          .map(([domainName, entities]) => `${domainName}: ${entities.length}`)
          .join(', ');

        return `Found ${totalEntities} entities across ${domainCount} domains${domain ? ` (filtered by ${domain})` : ''}:\n\n${summary}\n\nDomain summary: ${domainCounts}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to get all entities", { error: errorMessage });
        return `Failed to fetch entities: ${errorMessage}`;
      }
    },
  },
  noActionRequired: {
    description:
      "Take no action (e.g. if the user has not requested anything within your capability)",
    parameters: z.object({}),
    execute: async () => {
      await logger.debug("TOOL", "No action required");
      await logger.info("TOOL", "No action taken");
      return "No action taken.";
    },
  },
  getLightsByArea: {
    description: "Get all lights in a specific area/room",
    parameters: z.object({
      area: z.string().describe("The area/room name to search for"),
    }),
    execute: async ({ area }) => {
      await logger.debug("TOOL", "Getting lights by area", { area });
      
      const lights = await getAvailableLights();
      const areaLights = lights.filter((l) =>
        l.area?.toLowerCase().includes(area.toLowerCase())
      );

      await logger.debug("TOOL", "Found lights in area", { area, count: areaLights.length });

      if (areaLights.length === 0) {
        return `No lights found in the "${area}" area.`;
      }

      const lightsList = areaLights.map((l) =>
        `- ${l.friendly_name} (${l.entity_id})`
      ).join("\n");

      return `Lights in the ${area} area:\n${lightsList}`;
    },
  },
  setLightStateByArea: {
    description: "Control all lights in a specific area/room",
    parameters: z.object({
      area: z.string().describe("The area/room name to control"),
      state: z.enum(["on", "off"]),
      brightness: z.number().min(0).max(255).optional().describe(
        "Brightness level (0-255)",
      ),
      color: z.object({
        r: z.number().min(0).max(255),
        g: z.number().min(0).max(255),
        b: z.number().min(0).max(255),
      }).optional().describe("RGB color values"),
    }),
    execute: async ({ area, state, brightness, color }) => {
      await logger.info("TOOL", "Setting lights by area", { area, state, brightness, color });
      recordToolExecution("setLightStateByArea");
      
      const lights = await getAvailableLights();
      const areaLights = lights.filter((l) =>
        l.area?.toLowerCase().includes(area.toLowerCase())
      );

      if (areaLights.length === 0) {
        await logger.warn("TOOL", "No lights found in area", { area });
        return `No lights found in the "${area}" area.`;
      }

      const lightIds = areaLights.map((l) => l.entity_id);
      await logger.debug("TOOL", "Controlling area lights", { area, lightIds, state });

      // Use the existing setLightState function
      const setLightState = tools.setLightState.execute as (params: {
        lights: string[];
        state: "on" | "off";
        brightness?: number;
        color?: { r: number; g: number; b: number };
      }) => Promise<string>;
      const result = await setLightState({
        lights: lightIds,
        state,
        brightness,
        color,
      });

      return `${area} area: ${result}`;
    },
  },
  setLightState: {
    description: "Set a light's state in Home Assistant",
    parameters: z_setLightState,
    execute: async function setLightState({ lights, state, brightness, color }) {
      await logger.info("TOOL", "Setting light state", { lights, state, brightness, color });
      recordToolExecution("setLightState");
      return await controlLights(lights, { state, brightness, color });
    },
  },
  turnOffAllLights: {
    description: "Turn off all lights in the entire house/Home Assistant instance",
    parameters: z.object({}),
    execute: async () => {
      await logger.info("TOOL", "Turning off all lights");
      
      try {
        const lights = await getAvailableLights();
        
        if (lights.length === 0) {
          await logger.warn("TOOL", "No lights found");
          return "No lights found in your Home Assistant instance.";
        }

        const lightIds = lights.map((l) => l.entity_id);
        await logger.debug("TOOL", "Turning off all lights", { count: lightIds.length });

        // Use the existing setLightState function
        const setLightState = tools.setLightState.execute as (params: {
          lights: string[];
          state: "on" | "off";
        }) => Promise<string>;
        
        const result = await setLightState({
          lights: lightIds,
          state: "off",
        });

        return `All lights: ${result}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to turn off all lights", { error: errorMessage });
        return `Failed to turn off all lights: ${errorMessage}`;
      }
    },
  },
  setLightColor: {
    description: "Set lights to a specific color using color names or random colors",
    parameters: z.object({
      lights: z.union([
        z.string().describe("A single entity_id"),
        z.array(z.string()).describe("An array of entity_ids"),
      ]).describe("The entity_id(s) of the light(s) to control"),
      color: z.union([
        z.enum(["red", "green", "blue", "white", "yellow", "orange", "purple", "pink", "cyan", "magenta", "lime", "indigo", "violet", "turquoise", "coral", "gold", "random"]),
        z.object({
          r: z.number().min(0).max(255),
          g: z.number().min(0).max(255),
          b: z.number().min(0).max(255),
        })
      ]).describe("Color name, 'random', or RGB object"),
      brightness: z.number().min(0).max(255).optional().describe("Brightness level (0-255)"),
    }),
    execute: async ({ lights, color, brightness }) => {
      await logger.info("TOOL", "Setting light color", { lights, color, brightness });
      
      let rgbColor: { r: number; g: number; b: number };
      
      if (typeof color === "string") {
        if (color === "random") {
          rgbColor = getRandomColor();
        } else {
          rgbColor = colorMap[color];
          if (!rgbColor) {
            return `Unknown color "${color}". Available colors: ${Object.keys(colorMap).join(", ")}, random`;
          }
        }
      } else {
        rgbColor = color;
      }
      
      return await controlLights(lights, { state: "on", brightness, color: rgbColor });
    },
  },
  setAreaColor: {
    description: "Set all lights in an area to a specific color",
    parameters: z.object({
      area: z.string().describe("The area/room name to control"),
      color: z.union([
        z.enum(["red", "green", "blue", "white", "yellow", "orange", "purple", "pink", "cyan", "magenta", "lime", "indigo", "violet", "turquoise", "coral", "gold", "random"]),
        z.object({
          r: z.number().min(0).max(255),
          g: z.number().min(0).max(255),
          b: z.number().min(0).max(255),
        })
      ]).describe("Color name, 'random', or RGB object"),
      brightness: z.number().min(0).max(255).optional().describe("Brightness level (0-255)"),
    }),
    execute: async ({ area, color, brightness }) => {
      await logger.info("TOOL", "Setting area color", { area, color, brightness });
      
      let rgbColor: { r: number; g: number; b: number };
      
      if (typeof color === "string") {
        if (color === "random") {
          rgbColor = getRandomColor();
        } else {
          rgbColor = colorMap[color];
          if (!rgbColor) {
            return `Unknown color "${color}". Available colors: ${Object.keys(colorMap).join(", ")}, random`;
          }
        }
      } else {
        rgbColor = color;
      }
      
      // Use the existing setLightStateByArea function
      const setLightStateByArea = tools.setLightStateByArea.execute as (params: {
        area: string;
        state: "on" | "off";
        brightness?: number;
        color?: { r: number; g: number; b: number };
      }) => Promise<string>;
      
      return await setLightStateByArea({
        area,
        state: "on",
        brightness,
        color: rgbColor,
      });
    },
  },
  setRandomColors: {
    description: "Set different random colors for each light in an area or specific lights",
    parameters: z.object({
      target: z.union([
        z.object({
          area: z.string().describe("The area/room name to control"),
        }),
        z.object({
          lights: z.union([
            z.string().describe("A single entity_id"),
            z.array(z.string()).describe("An array of entity_ids"),
          ]).describe("The entity_id(s) of the light(s) to control"),
        })
      ]).describe("Either an area or specific lights to control"),
      brightness: z.number().min(0).max(255).optional().describe("Brightness level (0-255)"),
    }),
    execute: async ({ target, brightness }) => {
      await logger.info("TOOL", "Setting random colors", { target, brightness });
      
      let lightIds: string[];
      
      if ("area" in target) {
        const lights = await getAvailableLights();
        const areaLights = lights.filter((l) =>
          l.area?.toLowerCase().includes(target.area.toLowerCase())
        );
        
        if (areaLights.length === 0) {
          return `No lights found in the "${target.area}" area.`;
        }
        
        lightIds = areaLights.map((l) => l.entity_id);
      } else {
        lightIds = Array.isArray(target.lights) ? target.lights : [target.lights];
      }
      
      // Set each light to a different random color
      const promises = lightIds.map(async (lightId) => {
        const randomColor = getRandomColor();
        
        const setLightState = tools.setLightState.execute as (params: {
          lights: string;
          state: "on" | "off";
          brightness?: number;
          color?: { r: number; g: number; b: number };
        }) => Promise<string>;
        
        return await setLightState({
          lights: lightId,
          state: "on",
          brightness,
          color: randomColor,
        });
      });
      
      await Promise.all(promises);
      
      return `Set ${lightIds.length} lights to random colors.`;
    },
  },
  setLightTemperature: {
    description: "Set lights to a specific color temperature in Kelvin",
    parameters: z.object({
      lights: z.union([
        z.string().describe("A single entity_id"),
        z.array(z.string()).describe("An array of entity_ids"),
      ]).describe("The entity_id(s) of the light(s) to control"),
      temperature: z.union([
        z.number().min(2000).max(6500),
        z.enum(["warm white", "soft white", "warm", "neutral white", "neutral", "cool white", "cool", "daylight", "cold"])
      ]).describe("Color temperature in Kelvin (2000-6500) or preset name"),
      brightness: z.number().min(0).max(255).optional().describe("Brightness level (0-255)"),
    }),
    execute: async ({ lights, temperature, brightness }) => {
      await logger.info("TOOL", "Setting light temperature", { lights, temperature, brightness });
      
      let kelvinTemp: number;
      
      if (typeof temperature === "string") {
        kelvinTemp = colorTemperatureMap[temperature];
        if (!kelvinTemp) {
          return `Unknown temperature preset "${temperature}". Available presets: ${Object.keys(colorTemperatureMap).join(", ")} or Kelvin value (2000-6500)`;
        }
      } else {
        kelvinTemp = temperature;
      }
      
      return await controlLights(lights, { state: "on", brightness, temperature: kelvinTemp });
    },
  },
  setAreaLightTemperature: {
    description: "Set all lights in an area to a specific color temperature",
    parameters: z.object({
      area: z.string().describe("The area/room name to control"),
      temperature: z.union([
        z.number().min(2000).max(6500),
        z.enum(["warm white", "soft white", "warm", "neutral white", "neutral", "cool white", "cool", "daylight", "cold"])
      ]).describe("Color temperature in Kelvin (2000-6500) or preset name"),
      brightness: z.number().min(0).max(255).optional().describe("Brightness level (0-255)"),
    }),
    execute: async ({ area, temperature, brightness }) => {
      await logger.info("TOOL", "Setting area light temperature", { area, temperature, brightness });
      
      const lights = await getAvailableLights();
      const areaLights = lights.filter((l) =>
        l.area?.toLowerCase().includes(area.toLowerCase())
      );
      
      if (areaLights.length === 0) {
        return `No lights found in the "${area}" area.`;
      }
      
      const lightIds = areaLights.map((l) => l.entity_id);
      
      const setLightTemperature = tools.setLightTemperature.execute as (params: {
        lights: string[];
        temperature: number | string;
        brightness?: number;
      }) => Promise<string>;
      
      const result = await setLightTemperature({
        lights: lightIds,
        temperature,
        brightness,
      });
      
      return `${area} area: ${result}`;
    },
  },
  setClimateState: {
    description: "Turn climate entities (thermostats, HVAC) on or off",
    parameters: z.object({
      entity: z.string().describe("The entity_id of the climate entity"),
      state: z.enum(["on", "off", "heat", "cool", "auto", "heat_cool"]).describe("State to set: on/off or specific HVAC mode"),
    }),
    execute: async ({ entity, state }) => {
      await logger.info("TOOL", "Setting climate state", { entity, state });
      recordToolExecution("setClimateState");
      
      try {
        const entity_id = entity.includes(".") ? entity : `climate.${entity}`;
        
        // Capture current state before changing
        await captureEntityState(entity_id);
        
        let service: string;
        const serviceData: Record<string, string | number> = { entity_id };
        
        if (state === "on") {
          service = "turn_on";
        } else if (state === "off") {
          service = "turn_off";
        } else {
          service = "set_hvac_mode";
          serviceData.hvac_mode = state;
        }
        
        await callHomeAssistantService("climate", service, serviceData);
        
        await logger.debug("TOOL", "Climate state control successful", { entity_id, state });
        return `Successfully turned ${entity_id} ${state}.`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Climate state control failed", { entity, error: errorMessage });
        return `Failed to set state for ${entity}: ${errorMessage}`;
      }
    },
  },
  setTemperature: {
    description: "Set temperature for climate entities (thermostats, HVAC)",
    parameters: z.object({
      entity: z.string().describe("The entity_id of the climate entity"),
      temperature: z.number().min(10).max(35).describe("Target temperature in Celsius"),
    }),
    execute: async ({ entity, temperature }) => {
      await logger.info("TOOL", "Setting temperature", { entity, temperature });
      recordToolExecution("setTemperature");
      
      try {
        const entity_id = entity.includes(".") ? entity : `climate.${entity}`;
        
        // Capture current state before changing
        await captureEntityState(entity_id);
        
        await callHomeAssistantService("climate", "set_temperature", {
          entity_id: entity_id,
          temperature: temperature,
        });
        
        await logger.debug("TOOL", "Temperature control successful", { entity_id, temperature });
        return `Successfully set ${entity_id} to ${temperature}°C.`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Temperature control failed", { entity, error: errorMessage });
        return `Failed to set temperature for ${entity}: ${errorMessage}`;
      }
    },
  },
  setAreaTemperature: {
    description: "Set temperature for all climate entities in an area",
    parameters: z.object({
      area: z.string().describe("The area/room name to control"),
      temperature: z.number().min(10).max(35).describe("Target temperature in Celsius"),
    }),
    execute: async ({ area, temperature }) => {
      await logger.info("TOOL", "Setting area temperature", { area, temperature });
      
      try {
        const climateEntities = await getAvailableClimateEntities();
        const areaClimate = climateEntities.filter((e: ClimateEntity) =>
          e.area?.toLowerCase().includes(area.toLowerCase())
        );
        
        if (areaClimate.length === 0) {
          return `No climate entities found in the "${area}" area.`;
        }
        
        const promises = areaClimate.map(async (entity: ClimateEntity) => {
          try {
            await callHomeAssistantService("climate", "set_temperature", {
              entity_id: entity.entity_id,
              temperature: temperature,
            });
            return { success: true, entity_id: entity.entity_id };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logger.error("TOOL", "Climate control failed", { entity_id: entity.entity_id, error: errorMessage });
            return { success: false, entity_id: entity.entity_id, error: errorMessage };
          }
        });
        
        const results = await Promise.all(promises);
        const successes = results.filter((r: { success: boolean; entity_id: string }) => r.success).map((r: { entity_id: string }) => r.entity_id);
        const failures = results.filter((r: { success: boolean; entity_id: string; error?: string }) => !r.success).map((r: { entity_id: string; error?: string }) => `${r.entity_id}: ${r.error}`);
        
        if (successes.length > 0 && failures.length === 0) {
          return `Successfully set ${successes.join(", ")} to ${temperature}°C in ${area} area.`;
        } else if (successes.length > 0 && failures.length > 0) {
          return `Set ${successes.join(", ")} to ${temperature}°C. Failed to control: ${failures.join("; ")}`;
        } else {
          return `Failed to control climate entities in ${area}: ${failures.join("; ")}`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Area temperature control failed", { area, error: errorMessage });
        return `Failed to control temperature in ${area}: ${errorMessage}`;
      }
    },
  },
  setAreaClimateState: {
    description: "Turn climate entities in an area on or off or set HVAC mode",
    parameters: z.object({
      area: z.string().describe("The area/room name to control"),
      state: z.enum(["on", "off", "heat", "cool", "auto", "heat_cool"]).describe("State to set: on/off or specific HVAC mode"),
    }),
    execute: async ({ area, state }) => {
      await logger.info("TOOL", "Setting area climate state", { area, state });
      
      try {
        const climateEntities = await getAvailableClimateEntities();
        const areaClimate = climateEntities.filter((e: ClimateEntity) =>
          e.area?.toLowerCase().includes(area.toLowerCase())
        );
        
        if (areaClimate.length === 0) {
          return `No climate entities found in the "${area}" area.`;
        }
        
        const promises = areaClimate.map(async (entity: ClimateEntity) => {
          try {
            let service: string;
            const serviceData: Record<string, string | number> = { entity_id: entity.entity_id };
            
            if (state === "on") {
              service = "turn_on";
            } else if (state === "off") {
              service = "turn_off";
            } else {
              service = "set_hvac_mode";
              serviceData.hvac_mode = state;
            }
            
            await callHomeAssistantService("climate", service, serviceData);
            return { success: true, entity_id: entity.entity_id };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logger.error("TOOL", "Climate control failed", { entity_id: entity.entity_id, error: errorMessage });
            return { success: false, entity_id: entity.entity_id, error: errorMessage };
          }
        });
        
        const results = await Promise.all(promises);
        const successes = results.filter((r: { success: boolean; entity_id: string }) => r.success).map((r: { entity_id: string }) => r.entity_id);
        const failures = results.filter((r: { success: boolean; entity_id: string; error?: string }) => !r.success).map((r: { entity_id: string; error?: string }) => `${r.entity_id}: ${r.error}`);
        
        if (successes.length > 0 && failures.length === 0) {
          return `Successfully turned ${successes.join(", ")} ${state} in ${area} area.`;
        } else if (successes.length > 0 && failures.length > 0) {
          return `Turned ${successes.join(", ")} ${state}. Failed to control: ${failures.join("; ")}`;
        } else {
          return `Failed to control climate entities in ${area}: ${failures.join("; ")}`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Area climate state control failed", { area, error: errorMessage });
        return `Failed to control climate state in ${area}: ${errorMessage}`;
      }
    },
  },
  setAllClimatesState: {
    description: "Control all climate entities (ACs, thermostats) in the home - turn on/off, set mode, or set temperature",
    parameters: z.object({
      state: z.enum(["on", "off", "heat", "cool", "auto", "heat_cool"]).describe("State to set: on/off or specific HVAC mode"),
      temperature: z.number().min(10).max(35).optional().describe("Optional target temperature in Celsius (only used with 'on' or HVAC modes)"),
    }),
    execute: async ({ state, temperature }) => {
      await logger.info("TOOL", "Setting all climates state", { state, temperature });
      recordToolExecution("setAllClimatesState");
      
      try {
        const climateEntities = await getAvailableClimateEntities();
        
        if (climateEntities.length === 0) {
          await logger.warn("TOOL", "No climate entities found");
          return "No climate entities found in your Home Assistant instance.";
        }
        
        // Capture states before making changes
        await Promise.all(climateEntities.map(entity => captureEntityState(entity.entity_id)));
        
        const promises = climateEntities.map(async (entity: ClimateEntity) => {
          try {
            let service: string;
            const serviceData: Record<string, string | number> = { entity_id: entity.entity_id };
            
            if (state === "on") {
              service = "turn_on";
            } else if (state === "off") {
              service = "turn_off";
            } else {
              service = "set_hvac_mode";
              serviceData.hvac_mode = state;
            }
            
            await callHomeAssistantService("climate", service, serviceData);
            
            // Set temperature if provided and not turning off
            if (temperature !== undefined && state !== "off") {
              await callHomeAssistantService("climate", "set_temperature", {
                entity_id: entity.entity_id,
                temperature: temperature,
              });
            }
            
            return { success: true, entity_id: entity.entity_id };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logger.error("TOOL", "Climate control failed", { entity_id: entity.entity_id, error: errorMessage });
            return { success: false, entity_id: entity.entity_id, error: errorMessage };
          }
        });
        
        const results = await Promise.all(promises);
        const successes = results.filter((r: { success: boolean; entity_id: string }) => r.success).map((r: { entity_id: string }) => r.entity_id);
        const failures = results.filter((r: { success: boolean; entity_id: string; error?: string }) => !r.success).map((r: { entity_id: string; error?: string }) => `${r.entity_id}: ${r.error}`);
        
        if (successes.length > 0 && failures.length === 0) {
          const tempText = temperature && state !== "off" ? ` and set to ${temperature}°C` : "";
          return `Successfully set all ${successes.length} climate entities to ${state}${tempText}.`;
        } else if (successes.length > 0 && failures.length > 0) {
          const tempText = temperature && state !== "off" ? " and set temperature" : "";
          return `Set ${successes.join(", ")} to ${state}${tempText}. Failed to control: ${failures.join("; ")}`;
        } else {
          return `Failed to control all climate entities: ${failures.join("; ")}`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to control all climates", { error: errorMessage });
        return `Failed to control all climates: ${errorMessage}`;
      }
    },
  },
  setAllClimates: {
    description: "Set temperature for all climate entities in the home",
    parameters: z.object({
      temperature: z.number().min(10).max(35).describe("Target temperature in Celsius"),
    }),
    execute: async ({ temperature }) => {
      await logger.info("TOOL", "Setting all climates temperature", { temperature });
      
      try {
        const climateEntities = await getAvailableClimateEntities();
        
        if (climateEntities.length === 0) {
          return "No climate entities found in the home.";
        }
        
        const promises = climateEntities.map(async (entity: ClimateEntity) => {
          try {
            await callHomeAssistantService("climate", "set_temperature", {
              entity_id: entity.entity_id,
              temperature: temperature,
            });
            return { success: true, entity_id: entity.entity_id };
          } catch (error) {
            return { success: false, entity_id: entity.entity_id, error: error instanceof Error ? error.message : String(error) };
          }
        });
        
        const results = await Promise.all(promises);
        const successes = results.filter((r: { success: boolean; entity_id: string }) => r.success).map((r: { entity_id: string }) => r.entity_id);
        const failures = results.filter((r: { success: boolean; entity_id: string; error?: string }) => !r.success).map((r: { entity_id: string; error?: string }) => `${r.entity_id}: ${r.error}`);
        
        if (successes.length > 0 && failures.length === 0) {
          return `Successfully set all ${successes.length} climate entities to ${temperature}°C.`;
        } else if (successes.length > 0 && failures.length > 0) {
          return `Set ${successes.length} climate entities to ${temperature}°C. Failed to control: ${failures.join("; ")}`;
        } else {
          return `Failed to control all climate entities: ${failures.join("; ")}`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "All climates control failed", { error: errorMessage });
        return `Failed to control all climates: ${errorMessage}`;
      }
    },
  },
  setMediaPlayerState: {
    description: "Control media player devices (TV, speakers, etc.) - turn on/off, play/pause, set volume",
    parameters: z.object({
      entity: z.string().describe("The entity_id of the media player (e.g. 'media_player.lg_c1_oled' or just 'lg_c1_oled')"),
      action: z.enum(["turn_on", "turn_off", "play", "pause", "play_pause", "stop", "next_track", "previous_track"]).describe("Action to perform"),
      volume: z.number().min(0).max(100).optional().describe("Volume level (0-100) - only used with turn_on action"),
    }),
    execute: async ({ entity, action, volume }) => {
      await logger.info("TOOL", "Setting media player state", { entity, action, volume });
      recordToolExecution("setMediaPlayerState");
      
      try {
        const entity_id = entity.includes(".") ? entity : `media_player.${entity}`;
        
        // Capture current state before changing
        await captureEntityState(entity_id);
        
        let service: string;
        const serviceData: Record<string, string | number> = { entity_id };
        
        switch (action) {
          case "turn_on":
            service = "turn_on";
            if (volume !== undefined) {
              // Set volume after turning on
              await callHomeAssistantService("media_player", "turn_on", serviceData);
              await callHomeAssistantService("media_player", "volume_set", {
                entity_id,
                volume_level: volume / 100,
              });
              await logger.debug("TOOL", "Media player turned on and volume set", { entity_id, volume });
              return `Successfully turned on ${entity_id} and set volume to ${volume}%.`;
            }
            break;
          case "turn_off":
            service = "turn_off";
            break;
          case "play":
            service = "media_play";
            break;
          case "pause":
            service = "media_pause";
            break;
          case "play_pause":
            service = "media_play_pause";
            break;
          case "stop":
            service = "media_stop";
            break;
          case "next_track":
            service = "media_next_track";
            break;
          case "previous_track":
            service = "media_previous_track";
            break;
          default:
            throw new Error(`Unsupported action: ${action}`);
        }
        
        await callHomeAssistantService("media_player", service, serviceData);
        
        await logger.debug("TOOL", "Media player control successful", { entity_id, action });
        return `Successfully ${action.replace('_', ' ')} ${entity_id}.`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Media player control failed", { entity, action, error: errorMessage });
        return `Failed to ${action.replace('_', ' ')} ${entity}: ${errorMessage}`;
      }
    },
  },
  setMediaPlayerVolume: {
    description: "Set volume for media player devices",
    parameters: z.object({
      entity: z.string().describe("The entity_id of the media player"),
      volume: z.number().min(0).max(100).describe("Volume level (0-100)"),
    }),
    execute: async ({ entity, volume }) => {
      await logger.info("TOOL", "Setting media player volume", { entity, volume });
      
      try {
        const entity_id = entity.includes(".") ? entity : `media_player.${entity}`;
        
        await callHomeAssistantService("media_player", "volume_set", {
          entity_id,
          volume_level: volume / 100,
        });
        
        await logger.debug("TOOL", "Media player volume control successful", { entity_id, volume });
        return `Successfully set ${entity_id} volume to ${volume}%.`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Media player volume control failed", { entity, error: errorMessage });
        return `Failed to set volume for ${entity}: ${errorMessage}`;
      }
    },
  },
  getMediaPlayerStatus: {
    description: "Get current status of media player devices",
    parameters: z.object({
      entity: z.string().optional().describe("Specific media player entity_id, or leave empty for all media players"),
    }),
    execute: async ({ entity }) => {
      await logger.info("TOOL", "Getting media player status", { entity });
      
      try {
        if (entity) {
          const entity_id = entity.includes(".") ? entity : `media_player.${entity}`;
          const mediaPlayers = await getAvailableMediaPlayers();
          const player = mediaPlayers.find((mp: MediaPlayer) => mp.entity_id === entity_id);
          
          if (!player) {
            return `Media player ${entity_id} not found.`;
          }
          
          return `${player.friendly_name}: ${player.state} (Volume: ${Math.round((player.volume || 0) * 100)}%)`;
        } else {
          const mediaPlayers = await getAvailableMediaPlayers();
          
          if (mediaPlayers.length === 0) {
            return "No media players found.";
          }
          
          const statusList = mediaPlayers.map((mp: MediaPlayer) => 
            `- ${mp.friendly_name} (${mp.entity_id}): ${mp.state} (Volume: ${Math.round((mp.volume || 0) * 100)}%)`
          ).join("\n");
          
          return `Media Players Status:\n${statusList}`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to get media player status", { entity, error: errorMessage });
        return `Failed to get media player status: ${errorMessage}`;
      }
    },
  },
  getEntityState: {
    description: "Get the current state and attributes of any Home Assistant entity",
    parameters: z.object({
      entity: z.string().describe("The entity_id to get state for (e.g., 'light.living_room', 'climate.thermostat')"),
    }),
    execute: async ({ entity }) => {
      await logger.info("TOOL", "Getting entity state", { entity });
      
      try {
        const result = await getAllEntities();
        const { entitiesByDomain } = result;
        
        // Find the entity across all domains
        let foundEntity = null;
        for (const [_domain, entities] of Object.entries(entitiesByDomain)) {
          foundEntity = entities.find(e => e.entity_id === entity);
          if (foundEntity) break;
        }
        
        if (!foundEntity) {
          return `Entity ${entity} not found in Home Assistant.`;
        }
        
        // Format the state information
        const stateInfo = [
          `Entity: ${foundEntity.friendly_name} (${foundEntity.entity_id})`,
          `State: ${foundEntity.state}`
        ];
        
        await logger.debug("TOOL", "Entity state retrieved", { 
          entity, 
          state: foundEntity.state 
        });
        
        return stateInfo.join('\n');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to get entity state", { entity, error: errorMessage });
        return `Failed to get state for ${entity}: ${errorMessage}`;
      }
    },
  },
  // Music Assistant tools
  getMusicAssistantPlayers: {
    description: "Get all available Music Assistant players and their current status",
    parameters: z.object({}),
    execute: async () => {
      await logger.info("TOOL", "Getting Music Assistant players");
      
      try {
        const players = await getMusicAssistantPlayers();
        
        if (players.length === 0) {
          return "No Music Assistant players found. Make sure Music Assistant is set up and players are configured.";
        }
        
        const playersList = players.map(player => {
          const trackInfo = player.current_track 
            ? ` - Currently: "${player.current_track}"${player.artist ? ` by ${player.artist}` : ''}`
            : '';
          const queueInfo = player.queue_position && player.queue_size 
            ? ` (${player.queue_position}/${player.queue_size} in queue)`
            : '';
          return `- ${player.friendly_name} (${player.entity_id}): ${player.state}${trackInfo}${queueInfo}`;
        }).join('\n');
        
        await logger.info("TOOL", "Music Assistant players retrieved", { playerCount: players.length });
        return `Music Assistant Players:\n${playersList}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to get Music Assistant players", { error: errorMessage });
        return `Failed to get Music Assistant players: ${errorMessage}`;
      }
    },
  },
  playMusicOnMA: {
    description: "Play music on Music Assistant players using natural language search",
    parameters: z.object({
      query: z.string().describe("What to play - artist, song, album, playlist, genre, or natural language (e.g., 'jazz', 'Taylor Swift', 'upbeat workout music')"),
      players: z.array(z.string()).optional().describe("Target players or rooms (e.g., ['living room', 'kitchen'] or ['everywhere']). If omitted, uses first available player"),
      radio: z.boolean().optional().describe("Enable radio mode to play similar tracks after the requested music ends"),
      volume: z.number().min(0).max(100).optional().describe("Volume level (0-100)")
    }),
    execute: async ({ query, players, radio, volume }) => {
      await logger.info("TOOL", "Playing music on Music Assistant", { query, players, radio, volume });
      recordToolExecution("playMusicOnMA");
      
      try {
        // Resolve target players
        let targetPlayers: string[];
        if (players && players.length > 0) {
          targetPlayers = await resolveMusicPlayers(players);
        } else {
          // Use first available Music Assistant player as default
          const availablePlayers = await getMusicAssistantPlayers();
          if (availablePlayers.length === 0) {
            return "No Music Assistant players available. Make sure Music Assistant is configured.";
          }
          targetPlayers = [availablePlayers[0].entity_id];
        }
        
        if (targetPlayers.length === 0) {
          return `No valid players found for: ${players?.join(', ')}`;
        }
        
        // Capture current states
        await Promise.all(targetPlayers.map(player => captureEntityState(player)));
        
        // Use Music Assistant's search and play functionality with correct parameters
        const maServiceData: Record<string, unknown> = {
          entity_id: targetPlayers,
          media_id: query,  // Music Assistant uses media_id, not media_content_id
          media_type: "artist",  // Default to artist search, MA will auto-detect if needed
          enqueue: "play"
        };
        
        // Add radio mode if requested
        if (radio) {
          maServiceData.radio_mode = true;
        }
        
        // Set volume if specified
        if (volume !== undefined) {
          maServiceData.volume_level = volume / 100;
        }
        
        // Try Music Assistant specific service first
        try {
          await callHomeAssistantService("music_assistant", "play_media", maServiceData);
        } catch (maError) {
          // Fallback to standard media_player service with different parameters
          await logger.warn("TOOL", "Music Assistant service failed, trying standard media_player", { error: maError });
          const fallbackData = {
            entity_id: targetPlayers,
            media_content_type: "music",  // Standard service uses media_content_type
            media_content_id: query,
          };
          await callHomeAssistantService("media_player", "play_media", fallbackData);
        }
        
        const playersText = targetPlayers.length === 1 ? 
          targetPlayers[0] : 
          `${targetPlayers.length} players (${targetPlayers.join(', ')})`;
        
        const radioText = radio ? " with radio mode enabled" : "";
        const volumeText = volume ? ` at ${volume}% volume` : "";
        
        await logger.info("TOOL", "Music playback started", { query, players: targetPlayers, radio, volume });
        return `Started playing "${query}" on ${playersText}${radioText}${volumeText}.`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to play music", { query, players, error: errorMessage });
        return `Failed to play music: ${errorMessage}`;
      }
    },
  },
  controlMAPlayback: {
    description: "Control Music Assistant playback (play, pause, skip, stop, etc.)",
    parameters: z.object({
      action: z.enum(["play", "pause", "play_pause", "stop", "next", "previous", "shuffle", "repeat"]).describe("Playback action to perform"),
      players: z.array(z.string()).optional().describe("Target players or rooms. If omitted, controls all currently playing Music Assistant players"),
      volume: z.number().min(0).max(100).optional().describe("Volume level (0-100) - only used with play action")
    }),
    execute: async ({ action, players, volume }) => {
      await logger.info("TOOL", "Controlling Music Assistant playback", { action, players, volume });
      recordToolExecution("controlMAPlayback");
      
      try {
        // Resolve target players
        let targetPlayers: string[];
        if (players && players.length > 0) {
          targetPlayers = await resolveMusicPlayers(players);
        } else {
          // Find all currently playing Music Assistant players
          const allPlayers = await getMusicAssistantPlayers();
          const playingPlayers = allPlayers.filter(p => p.state === 'playing');
          if (playingPlayers.length === 0) {
            // If no playing players, use all MA players
            targetPlayers = allPlayers.map(p => p.entity_id);
          } else {
            targetPlayers = playingPlayers.map(p => p.entity_id);
          }
        }
        
        if (targetPlayers.length === 0) {
          return players ? `No valid players found for: ${players.join(', ')}` : "No Music Assistant players available.";
        }
        
        // Capture current states
        await Promise.all(targetPlayers.map(player => captureEntityState(player)));
        
        // Map actions to Home Assistant services
        let service: string;
        const serviceData: Record<string, unknown> = { entity_id: targetPlayers };
        
        switch (action) {
          case "play":
            service = "media_play";
            if (volume !== undefined) {
              // Set volume after starting playback
              await callHomeAssistantService("media_player", "media_play", serviceData);
              await callHomeAssistantService("media_player", "volume_set", {
                entity_id: targetPlayers,
                volume_level: volume / 100
              });
              const playersText = targetPlayers.length === 1 ? targetPlayers[0] : `${targetPlayers.length} players`;
              return `Resumed playback on ${playersText} and set volume to ${volume}%.`;
            }
            break;
          case "pause":
            service = "media_pause";
            break;
          case "play_pause":
            service = "media_play_pause";
            break;
          case "stop":
            service = "media_stop";
            break;
          case "next":
            service = "media_next_track";
            break;
          case "previous":
            service = "media_previous_track";
            break;
          case "shuffle":
            service = "shuffle_set";
            serviceData.shuffle = true;
            break;
          case "repeat":
            service = "repeat_set";
            serviceData.repeat = "all";
            break;
          default:
            throw new Error(`Unsupported action: ${action}`);
        }
        
        await callHomeAssistantService("media_player", service, serviceData);
        
        const playersText = targetPlayers.length === 1 ? 
          targetPlayers[0] : 
          `${targetPlayers.length} players`;
        
        await logger.info("TOOL", "Playback control successful", { action, players: targetPlayers });
        return `${action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ')} on ${playersText}.`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to control playback", { action, players, error: errorMessage });
        return `Failed to ${action} music: ${errorMessage}`;
      }
    },
  },
  transferMAQueue: {
    description: "Transfer music queue from one Music Assistant player to another",
    parameters: z.object({
      from: z.string().describe("Source player or room name"),
      to: z.string().describe("Target player or room name"),
      start_playing: z.boolean().optional().describe("Start playing on target player after transfer (default: true)")
    }),
    execute: async ({ from, to, start_playing = true }) => {
      await logger.info("TOOL", "Transferring Music Assistant queue", { from, to, start_playing });
      recordToolExecution("transferMAQueue");
      
      try {
        // Resolve source and target players
        const sourcePlayers = await resolveMusicPlayers([from]);
        const targetPlayers = await resolveMusicPlayers([to]);
        
        if (sourcePlayers.length === 0) {
          return `Source player not found: ${from}`;
        }
        if (targetPlayers.length === 0) {
          return `Target player not found: ${to}`;
        }
        
        const sourcePlayer = sourcePlayers[0];
        const targetPlayer = targetPlayers[0];
        
        // Capture current states
        await Promise.all([captureEntityState(sourcePlayer), captureEntityState(targetPlayer)]);
        
        // Try Music Assistant specific transfer service first
        try {
          await callHomeAssistantService("music_assistant", "transfer_queue", {
            source_player: sourcePlayer,
            target_player: targetPlayer,
            start_playing: start_playing
          });
        } catch (maError) {
          // Fallback: get current track info and play on target
          await logger.warn("TOOL", "Music Assistant transfer service failed, using fallback", { error: maError });
          
          const players = await getMusicAssistantPlayers();
          const sourcePlayerInfo = players.find(p => p.entity_id === sourcePlayer);
          
          if (!sourcePlayerInfo?.current_track) {
            return "No music currently playing on source player to transfer.";
          }
          
          // Stop source player and start on target using Music Assistant
          await callHomeAssistantService("media_player", "media_stop", { entity_id: sourcePlayer });
          try {
            await callHomeAssistantService("music_assistant", "play_media", {
              entity_id: targetPlayer,
              media_id: sourcePlayerInfo.current_track,
              media_type: "track",
              enqueue: "play"
            });
          } catch (maFallbackError) {
            // Final fallback to standard media_player
            await callHomeAssistantService("media_player", "play_media", {
              entity_id: targetPlayer,
              media_content_type: "music",
              media_content_id: sourcePlayerInfo.current_track
            });
          }
        }
        
        await logger.info("TOOL", "Queue transfer successful", { sourcePlayer, targetPlayer, start_playing });
        return `Successfully transferred music queue from ${sourcePlayer} to ${targetPlayer}${start_playing ? ' and started playback' : ''}.`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to transfer queue", { from, to, error: errorMessage });
        return `Failed to transfer queue from ${from} to ${to}: ${errorMessage}`;
      }
    },
  },
  getMusicStatus: {
    description: "Get current music playback status from Music Assistant players",
    parameters: z.object({
      player: z.string().optional().describe("Specific player or room name. If omitted, shows status for all Music Assistant players")
    }),
    execute: async ({ player }) => {
      await logger.info("TOOL", "Getting music status", { player });
      
      try {
        let targetPlayers: MediaPlayer[];
        
        if (player) {
          const resolvedPlayers = await resolveMusicPlayers([player]);
          if (resolvedPlayers.length === 0) {
            return `Player not found: ${player}`;
          }
          const allPlayers = await getMusicAssistantPlayers();
          targetPlayers = allPlayers.filter(p => resolvedPlayers.includes(p.entity_id));
        } else {
          targetPlayers = await getMusicAssistantPlayers();
        }
        
        if (targetPlayers.length === 0) {
          return player ? `No Music Assistant player found for: ${player}` : "No Music Assistant players available.";
        }
        
        const statusList = targetPlayers.map(player => {
          let status = `**${player.friendly_name}** (${player.area || 'No area'}): ${player.state}`;
          
          if (player.current_track) {
            status += `\n  ♪ "${player.current_track}"`;
            if (player.artist) {
              status += ` by ${player.artist}`;
            }
            if (player.album) {
              status += ` (${player.album})`;
            }
          }
          
          if (player.volume !== undefined) {
            status += `\n  🔊 Volume: ${Math.round(player.volume * 100)}%`;
          }
          
          if (player.queue_position && player.queue_size) {
            status += `\n  📋 Queue: ${player.queue_position}/${player.queue_size}`;
          }
          
          return status;
        }).join('\n\n');
        
        await logger.info("TOOL", "Music status retrieved", { playerCount: targetPlayers.length });
        return player ? statusList : `Music Assistant Status:\n\n${statusList}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.error("TOOL", "Failed to get music status", { player, error: errorMessage });
        return `Failed to get music status: ${errorMessage}`;
      }
    },
  },
  searchMusic: {
    description: "Search for music in Music Assistant without playing it",
    parameters: z.object({
      query: z.string().describe("Search query for music (artist, song, album, etc.)")
    }),
    execute: async ({ query }) => {
      await logger.info("TOOL", "Searching for music", { query });
      
      try {
        // Try Music Assistant search service
        const searchResult = await callHomeAssistantService("music_assistant", "search", {
          search_query: query,
          limit: 10
        });
        
        await logger.info("TOOL", "Music search completed", { query, resultCount: searchResult?.length || 0 });
        return `Search results for "${query}":\n${JSON.stringify(searchResult, null, 2)}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logger.warn("TOOL", "Music Assistant search failed", { query, error: errorMessage });
        return `Music search for "${query}" completed. Use the play command to start playback.`;
      }
    },
  },
};
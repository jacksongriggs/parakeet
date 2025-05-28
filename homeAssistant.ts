// Home Assistant integration functionality

import { HOME_ASSISTANT_URL, HOME_ASSISTANT_TOKEN, CACHE_DURATION_MS } from "./config.ts";
import type { Light, ClimateEntity, MediaPlayer } from "./types.ts";
import { logger } from "./logger.ts";

// Cache for Home Assistant entities
let lightsCache: Light[] = [];
let climateCache: ClimateEntity[] = [];
let mediaPlayersCache: MediaPlayer[] = [];
let lightsCacheTime = 0;
let climateCacheTime = 0;
let mediaPlayersCacheTime = 0;

// Helper function to fetch area for an entity
async function getEntityArea(entityId: string): Promise<string | undefined> {
  try {
    const areaResponse = await fetch(
      `${HOME_ASSISTANT_URL}/api/template`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HOME_ASSISTANT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template: `{{ area_name("${entityId}") }}`,
        }),
      },
    );
    const area = await areaResponse.text();
    return area.trim() || undefined;
  } catch (_error) {
    return undefined;
  }
}

export async function getAllEntities(domainFilter?: string) {
  try {
    await logger.info("HA_API", "Getting all entities from Home Assistant", { domainFilter });
    
    const response = await fetch(`${HOME_ASSISTANT_URL}/api/states`, {
      headers: {
        "Authorization": `Bearer ${HOME_ASSISTANT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch entities: ${response.status}`);
    }

    const states = await response.json() as Array<{
      entity_id: string;
      state: string;
      attributes?: { 
        friendly_name?: string;
        [key: string]: unknown;
      };
    }>;

    // Filter by domain if specified
    const filteredStates = domainFilter 
      ? states.filter(state => state.entity_id.startsWith(`${domainFilter}.`))
      : states;

    // Group entities by domain
    const entitiesByDomain: Record<string, Array<{entity_id: string, friendly_name: string, state: string}>> = {};
    
    for (const state of filteredStates) {
      const entityDomain = state.entity_id.split('.')[0];
      if (!entitiesByDomain[entityDomain]) {
        entitiesByDomain[entityDomain] = [];
      }
      
      entitiesByDomain[entityDomain].push({
        entity_id: state.entity_id,
        friendly_name: state.attributes?.friendly_name || state.entity_id,
        state: state.state
      });
    }

    return {
      totalEntities: filteredStates.length,
      domainCount: Object.keys(entitiesByDomain).length,
      domains: Object.keys(entitiesByDomain).sort(),
      entitiesByDomain
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error("HA_API", "Failed to get all entities", { error: errorMessage });
    throw error;
  }
}

export async function callHomeAssistantService(
  domain: string,
  service: string,
  data: Record<string, unknown>,
) {
  await logger.debug("HA_API", "Calling Home Assistant service", { domain, service, data });
  
  const response = await fetch(
    `${HOME_ASSISTANT_URL}/api/services/${domain}/${service}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HOME_ASSISTANT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    await logger.error("HA_API", "Home Assistant API error", { 
      domain, 
      service, 
      status: response.status, 
      statusText: response.statusText,
      errorText 
    });
    await logger.error("HA_API", "API Response Error", { errorText });
    throw new Error(
      `Home Assistant API error: ${response.status} ${response.statusText}`,
    );
  }

  const result = await response.json();
  await logger.debug("HA_API", "Home Assistant service call successful", { domain, service });
  return result;
}

export async function getAvailableLights(): Promise<Light[]> {
  const now = Date.now();

  // Return cached entities if still fresh
  if (lightsCache.length > 0 && now - lightsCacheTime < CACHE_DURATION_MS) {
    await logger.debug("HA_CACHE", "Using cached lights data", { lightsCount: lightsCache.length });
    return lightsCache;
  }

  await logger.debug("HA_API", "Fetching lights from Home Assistant");

  try {
    const response = await fetch(`${HOME_ASSISTANT_URL}/api/states`, {
      headers: {
        "Authorization": `Bearer ${HOME_ASSISTANT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch entities: ${response.status}`);
    }

    const states = await response.json() as Array<{
      entity_id: string;
      attributes?: { 
        friendly_name?: string;
        supported_color_modes?: string[];
        color_mode?: string;
      };
    }>;
    const lightStates = states.filter((state) =>
      state.entity_id.startsWith("light.")
    );

    // Get area information for each light using the template API
    // Note: We keep Promise.all here as it already executes in parallel
    lightsCache = await Promise.all(
      lightStates.map(async (state) => {
        const area = await getEntityArea(state.entity_id);
        return {
          entity_id: state.entity_id,
          friendly_name: state.attributes?.friendly_name || state.entity_id,
          area,
          supported_color_modes: state.attributes?.supported_color_modes,
          color_mode: state.attributes?.color_mode,
        };
      }),
    );
    lightsCacheTime = now;

    await logger.info("HA_API", "Successfully fetched lights from Home Assistant", { 
      lightsCount: lightsCache.length 
    });
    await logger.info("HA_API", "Lights discovery completed", { 
      lightsCount: lightsCache.length,
      status: "success"
    });

    return lightsCache;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error("HA_API", "Failed to fetch lights", { error: errorMessage });
    await logger.error("HA_API", "Lights fetch failed", { error: errorMessage });
    return lightsCache; // Return cached data if fetch fails
  }
}

export async function getAvailableClimateEntities(): Promise<ClimateEntity[]> {
  const now = Date.now();

  // Return cached entities if still fresh
  if (climateCache.length > 0 && now - climateCacheTime < CACHE_DURATION_MS) {
    await logger.debug("HA_CACHE", "Using cached climate data", { climateCount: climateCache.length });
    return climateCache;
  }

  await logger.debug("HA_API", "Fetching climate entities from Home Assistant");

  try {
    const response = await fetch(`${HOME_ASSISTANT_URL}/api/states`, {
      headers: {
        "Authorization": `Bearer ${HOME_ASSISTANT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch entities: ${response.status}`);
    }

    const states = await response.json() as Array<{
      entity_id: string;
      attributes?: { friendly_name?: string };
    }>;
    const climateStates = states.filter((state) =>
      state.entity_id.startsWith("climate.")
    );

    // Get area information for each climate entity
    climateCache = await Promise.all(
      climateStates.map(async (state) => {
        const area = await getEntityArea(state.entity_id);
        return {
          entity_id: state.entity_id,
          friendly_name: state.attributes?.friendly_name || state.entity_id,
          area,
        };
      }),
    );
    climateCacheTime = now;

    await logger.info("HA_API", "Successfully fetched climate entities from Home Assistant", { 
      climateCount: climateCache.length 
    });

    return climateCache;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error("HA_API", "Failed to fetch climate entities", { error: errorMessage });
    return climateCache; // Return cached data if fetch fails
  }
}

// Utility functions to check light capabilities
export function supportsColorControl(light: Light): boolean {
  const colorModes = light.supported_color_modes || [];
  return colorModes.some(mode => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(mode));
}

export function supportsTemperatureControl(light: Light): boolean {
  const colorModes = light.supported_color_modes || [];
  return colorModes.some(mode => ['color_temp', 'rgbww'].includes(mode));
}

export function getBestLightControlMode(light: Light): 'color' | 'temperature' | 'brightness_only' {
  if (supportsColorControl(light)) {
    return 'color';
  } else if (supportsTemperatureControl(light)) {
    return 'temperature';
  } else {
    return 'brightness_only';
  }
}

export async function getAvailableMediaPlayers(): Promise<MediaPlayer[]> {
  const now = Date.now();

  // Return cached entities if still fresh
  if (mediaPlayersCache.length > 0 && now - mediaPlayersCacheTime < CACHE_DURATION_MS) {
    await logger.debug("HA_CACHE", "Using cached media players data", { mediaPlayersCount: mediaPlayersCache.length });
    return mediaPlayersCache;
  }

  await logger.debug("HA_API", "Fetching media players from Home Assistant");

  try {
    const response = await fetch(`${HOME_ASSISTANT_URL}/api/states`, {
      headers: {
        "Authorization": `Bearer ${HOME_ASSISTANT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch entities: ${response.status}`);
    }

    const states = await response.json() as Array<{
      entity_id: string;
      state: string;
      attributes?: { 
        friendly_name?: string;
        volume_level?: number;
      };
    }>;
    const mediaPlayerStates = states.filter((state) =>
      state.entity_id.startsWith("media_player.")
    );

    // Get area information for each media player
    mediaPlayersCache = await Promise.all(
      mediaPlayerStates.map(async (state) => {
        const area = await getEntityArea(state.entity_id);
        return {
          entity_id: state.entity_id,
          friendly_name: state.attributes?.friendly_name || state.entity_id,
          area,
          state: state.state,
          volume: state.attributes?.volume_level,
        };
      }),
    );
    mediaPlayersCacheTime = now;

    await logger.info("HA_API", "Successfully fetched media players from Home Assistant", { 
      mediaPlayersCount: mediaPlayersCache.length 
    });

    return mediaPlayersCache;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error("HA_API", "Failed to fetch media players", { error: errorMessage });
    return mediaPlayersCache; // Return cached data if fetch fails
  }
}

// Initialize caches on module load
getAvailableLights();
getAvailableClimateEntities();
getAvailableMediaPlayers();
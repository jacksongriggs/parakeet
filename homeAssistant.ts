// Home Assistant integration functionality

import { HOME_ASSISTANT_URL, HOME_ASSISTANT_TOKEN, CACHE_DURATION_MS } from "./config.ts";
import type { Light, ClimateEntity } from "./types.ts";
import { logger } from "./logger.ts";

// Cache for Home Assistant entities
let lightsCache: Light[] = [];
let climateCache: ClimateEntity[] = [];
let lightsCacheTime = 0;
let climateCacheTime = 0;

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
      attributes?: { friendly_name?: string };
    }>;
    const lightStates = states.filter((state) =>
      state.entity_id.startsWith("light.")
    );

    // Get area information for each light using the template API
    // Note: We keep Promise.all here as it already executes in parallel
    lightsCache = await Promise.all(
      lightStates.map(async (state) => {
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
                template: `{{ area_name("${state.entity_id}") }}`,
              }),
            },
          );

          const area = await areaResponse.text();

          return {
            entity_id: state.entity_id,
            friendly_name: state.attributes?.friendly_name || state.entity_id,
            area: area.trim() || undefined,
          };
        } catch (_error) {
          // If area lookup fails, return without area
          return {
            entity_id: state.entity_id,
            friendly_name: state.attributes?.friendly_name || state.entity_id,
          };
        }
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
                template: `{{ area_name("${state.entity_id}") }}`,
              }),
            },
          );

          const area = await areaResponse.text();

          return {
            entity_id: state.entity_id,
            friendly_name: state.attributes?.friendly_name || state.entity_id,
            area: area.trim() || undefined,
          };
        } catch (_error) {
          // If area lookup fails, return without area
          return {
            entity_id: state.entity_id,
            friendly_name: state.attributes?.friendly_name || state.entity_id,
          };
        }
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

// Initialize caches on module load
getAvailableLights();
getAvailableClimateEntities();
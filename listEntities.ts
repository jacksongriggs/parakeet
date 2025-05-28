// Standalone script to fetch and log all Home Assistant entities to a file

import { HOME_ASSISTANT_URL, HOME_ASSISTANT_TOKEN } from "./config.ts";

async function getAllEntities() {
  try {
    console.log("Fetching all entities from Home Assistant...");
    
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

    // Group entities by domain
    const entitiesByDomain: Record<string, Array<{entity_id: string, friendly_name: string, state: string}>> = {};
    
    for (const state of states) {
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

    // Create detailed output
    const output = Object.entries(entitiesByDomain).map(([domainName, entities]) => {
      const entityList = entities.map(e => `  - ${e.friendly_name} (${e.entity_id}) [${e.state}]`).join('\n');
      return `${domainName.toUpperCase()} (${entities.length} entities):\n${entityList}`;
    }).join('\n\n');

    const domainCounts = Object.entries(entitiesByDomain)
      .map(([domain, entities]) => `${domain}: ${entities.length}`)
      .join(', ');

    const finalOutput = `Home Assistant Entity Inventory
Generated: ${new Date().toISOString()}
Total Entities: ${states.length}
Domains: ${Object.keys(entitiesByDomain).length}

SUMMARY:
${domainCounts}

DETAILED BREAKDOWN:
${output}`;

    // Write to file
    const filename = `ha_entities_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.txt`;
    await Deno.writeTextFile(filename, finalOutput);
    
    console.log(`Found ${states.length} entities across ${Object.keys(entitiesByDomain).length} domains`);
    console.log(`Entity list saved to: ${filename}`);
    console.log("\nDomain summary:");
    console.log(domainCounts);

  } catch (error) {
    console.error("Failed to fetch entities:", error);
  }
}

if (import.meta.main) {
  await getAllEntities();
}
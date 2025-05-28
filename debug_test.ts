#!/usr/bin/env -S deno run --allow-all --env-file=.env

// Quick debug script to test rollback system components
import { logger } from "./logger.ts";
import { captureEntityState, startGeneration, getCurrentGeneration, cancelAndRollback, completeGeneration } from "./generationTracker.ts";
import { getAvailableLights } from "./homeAssistant.ts";

await logger.sessionStart();

console.log("🔧 Testing Rollback System Components...\n");

// Test 1: Generation tracking
console.log("1. Testing generation tracking...");
const mockAbortController = new AbortController();
const genId = startGeneration("test_utterance_123", "turn on the lights", mockAbortController);
console.log(`   ✓ Started generation: ${genId}`);

const currentGen = getCurrentGeneration();
console.log(`   ✓ Current generation: ${currentGen?.id || 'none'}`);

// Test 2: Entity state capture
console.log("\n2. Testing entity state capture...");
try {
  const lights = await getAvailableLights();
  if (lights.length > 0) {
    const testLight = lights[0];
    console.log(`   Testing with light: ${testLight.entity_id}`);
    
    await captureEntityState(testLight.entity_id);
    console.log(`   ✓ Captured state for ${testLight.entity_id}`);
    
    const gen = getCurrentGeneration();
    console.log(`   ✓ Generation has ${gen?.entitySnapshots.length || 0} entity snapshots`);
  } else {
    console.log("   ⚠️  No lights found for testing");
  }
} catch (error) {
  console.log(`   ❌ Error capturing entity state: ${error.message}`);
}

// Test 3: Rollback functionality
console.log("\n3. Testing rollback functionality...");
try {
  const success = await cancelAndRollback("Debug test rollback");
  console.log(`   ${success ? '✓' : '❌'} Rollback ${success ? 'successful' : 'failed'}`);
} catch (error) {
  console.log(`   ❌ Rollback error: ${error.message}`);
}

// Test 4: Generation completion
console.log("\n4. Testing generation completion...");
startGeneration("test_utterance_456", "test command", new AbortController());
completeGeneration();
const afterComplete = getCurrentGeneration();
console.log(`   ✓ Generation after completion: ${afterComplete?.id || 'none (cleared)'}`);

console.log("\n🎉 Component test complete!");
console.log("\nNext steps:");
console.log("1. Run the main application: deno task dev");
console.log("2. Follow the TEST_SCRIPT.md for full integration testing");

await logger.sessionEnd();
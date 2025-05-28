# Incomplete Utterance Detection & Rollback Test Script

This script will help you test the new intelligent error detection and rollback system for incomplete voice commands.

## Prerequisites

1. Ensure Home Assistant is running and accessible
2. Have at least 2-3 lights in different rooms/areas  
3. Run the application: `deno task dev`
4. Say "polly" to activate, then wait for "🦜 polly detected! Listening..."

## Test Cases

### Test 1: Basic Light Rollback (Primary Test Case)

**Objective**: Test rollback when command is cut off early

**Steps**:
1. Say: "polly turn the lights on"
2. **Immediately continue** (within 1-2 seconds): "in the bedroom"
3. Watch the logs carefully

**Expected Behavior**:
- AI should start processing "turn the lights on" (tries to turn on ALL lights)
- System detects continuation when you say "in the bedroom"  
- Should see log: "Detected utterance continuation - cancelling and rolling back"
- All lights should return to their previous state
- AI should then process complete command: "turn the lights on in the bedroom"
- Only bedroom lights should turn on

**Log Markers to Look For**:
```
GENERATION: Started tracking generation
TOOL: Setting lights by area (if it gets that far)
VOICE: Detected utterance continuation - cancelling and rolling back  
GENERATION: Cancelling generation and rolling back
GENERATION: Restored entity state
VOICE: Rollback successful, processing updated command
AI: AI analysis completed (for the complete command)
```

### Test 2: Color Change Rollback

**Objective**: Test rollback with color changes

**Steps**:
1. Turn some lights on to a specific color first: "polly set the living room lights to blue"
2. Wait for completion
3. Say: "polly set the lights to red"  
4. **Immediately continue**: "in the kitchen only"

**Expected Behavior**:
- AI starts changing ALL lights to red
- System detects continuation  
- All lights should rollback to their previous states (blue in living room, others unchanged)
- Only kitchen lights should turn red

### Test 3: Brightness Rollback

**Objective**: Test rollback with brightness changes

**Steps**:
1. Set lights to specific brightness: "polly set bedroom lights to 50% brightness"
2. Wait for completion
3. Say: "polly turn the lights"
4. **Immediately continue**: "to full brightness in the bedroom"

**Expected Behavior**:
- System should detect the continuation
- Lights should maintain their current state during rollback
- Bedroom lights should go to full brightness

### Test 4: Climate Control Rollback

**Objective**: Test rollback with climate entities

**Steps**:
1. Say: "polly set the temperature to 22"
2. **Immediately continue**: "degrees in the living room"

**Expected Behavior**:
- AI starts setting ALL thermostats to 22°C
- System detects continuation and rolls back
- Only living room thermostat should be set to 22°C

### Test 5: Partial Result Rollback

**Objective**: Test rollback with partial transcription timeout

**Steps**:
1. Say: "polly turn off the lights" (speak slowly)
2. **Pause for 2-3 seconds** (let partial timeout trigger)
3. **Then continue**: "except the bedroom lights"

**Expected Behavior**:
- First part should trigger partial timeout processing
- When you continue, system should detect continuation
- Should rollback the "turn off all lights" action
- Should process complete command correctly

## What to Monitor

### 1. **Log Output**
Watch for these key log entries in order:
```
GENERATION: Started tracking generation
TOOL: Capturing entity states
VOICE: Detected utterance continuation  
GENERATION: Cancelling generation and rolling back
GENERATION: Restored entity state (for each affected entity)
VOICE: Rollback successful
AI: AI analysis completed (for complete command)
```

### 2. **Physical Light Behavior**
- Lights should briefly start changing, then return to original state
- Final state should match the complete command only

### 3. **Timing**
- Rollback should happen within 1-2 seconds of continuation
- No noticeable delay in final command execution

## Troubleshooting

### If Rollback Doesn't Trigger:
1. **Check timing**: You need to continue speaking while AI is still processing
2. **Check utterance ID**: Same utterance must have same ID (try speaking more naturally)
3. **Check logs**: Look for "detectUtteranceContinuation" calls

### If Rollback Fails:
1. **Check entity states**: Logs should show "Captured entity state" before changes
2. **Check Home Assistant connection**: Ensure API calls are working
3. **Check entity permissions**: Ensure HA token has write access

### If AI Doesn't Process Complete Command:
1. **Check conversation history**: Should include complete text
2. **Check wake word timeout**: Make sure you're still within timeout window
3. **Check partial processing**: Ensure USE_PARTIAL_RESULTS is configured correctly

## Success Criteria

✅ **System successfully detects utterance continuations**  
✅ **Entities are restored to exact previous states**  
✅ **Complete command is processed correctly**  
✅ **No user intervention required**  
✅ **Logs show clear audit trail of rollback actions**  

## Advanced Test Cases

### Test 6: Multiple Tool Rollback
Say: "polly turn on the lights and set temperature to 20" then continue "degrees in just the bedroom"

### Test 7: Fast Continuation  
Say: "polly turn off" then immediately "the living room lights only" (test very fast continuation)

### Test 8: Complex Command Rollback
Say: "polly set the lights to warm white and turn up" then continue "the bedroom thermostat to 24 degrees"

## Expected Log Output Sample

```
GENERATION: Started tracking generation [gen_1234567890_abc123]
TOOL: Setting lights by area
GENERATION: Captured entity state [light.bedroom_light]
VOICE: Detected utterance continuation - cancelling and rolling back
GENERATION: Cancelling generation and rolling back [reason: Utterance continuation detected]
GENERATION: Restored entity state [light.bedroom_light] 
VOICE: Rollback successful, processing updated command
AI: AI analysis completed [input: turn the lights on in the bedroom]
```

This should give you a comprehensive test of the rollback system!
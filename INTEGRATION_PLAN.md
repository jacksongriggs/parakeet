# Parakeet Home Assistant Integration Plan

## Overview
Based on entity discovery, we have 220 entities across 26 domains. This plan outlines integration priorities for voice control expansion.

## Current Integration Status
✅ **Implemented**: 
- Lights (34 entities) - Individual and area control
- Climate (3 entities) - Temperature and mode control

## Priority 1: Media Control (10 entities)
**Entities**: Apple TV 4K, LG C1 OLED, various speakers
- `media_player.turn_on/off`
- `media_player.play_media` 
- `media_player.volume_set`
- `media_player.media_play_pause`

**Voice Commands**:
- "Turn on the TV"
- "Play music on living room speaker"
- "Set TV volume to 50%"

## Priority 2: Switch Control (22 entities)
**Entities**: Smart plugs, various switches
- `switch.turn_on/off`
- `switch.toggle`

**Voice Commands**:
- "Turn on the coffee maker"
- "Turn off all plugs"

## Priority 3: Automation & Scenes
**Entities**: Scripts, automations, scenes
- `script.turn_on`
- `automation.trigger`
- `scene.turn_on`

**Voice Commands**:
- "Run bedtime routine"
- "Activate movie mode"

## Priority 4: Vacuum Control (1 entity)
**Entity**: Carl (robot vacuum)
- `vacuum.start`
- `vacuum.return_to_base`
- `vacuum.stop`

**Voice Commands**:
- "Start vacuuming"
- "Send Carl home"

## Priority 5: Security & Monitoring
**Entities**: Device trackers, sensors, cameras
- Status queries only (no control for security)

**Voice Commands**:
- "Who's home?"
- "Check front door sensor"

## Implementation Strategy
1. Add tools for Priority 1 entities first
2. Test voice commands thoroughly
3. Implement error handling for offline devices
4. Add entity state caching for performance
5. Expand to lower priority items

## Technical Considerations
- Use entity-specific service calls
- Implement device availability checks
- Add friendly name resolution
- Consider area-based grouping for bulk operations
- Maintain existing conversation context system
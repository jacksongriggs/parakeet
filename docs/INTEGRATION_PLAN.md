# Parakeet Integration Plan

## Overview
This plan outlines integration priorities for expanding Parakeet's voice control capabilities across Home Assistant entities and music control systems.

## Current Integration Status
✅ **Implemented**: 
- Lights (34 entities) - Individual and area control
- Climate (3 entities) - Temperature and mode control
- TTS (Text-to-Speech) - Voice responses and feedback

🚧 **In Development**:
- Music Control System - Spotify API + AirPlay 2 multi-room audio

## Priority 0: Music Control System (Spotify + AirPlay 2)
**Status**: Design completed, implementation planned

**Architecture**: 
- Spotify Web API for music search, playback control, and playlist access
- Airfoil + AppleScript for AirPlay 2 multi-room broadcasting
- Voice commands for natural music control ("play jazz in the living room")
- Multi-device synchronization and room-based audio grouping

**Implementation Phases**:
1. Basic Spotify integration (search, play, pause, skip)
2. AirPlay 2 multi-room via Airfoil automation
3. Advanced features (smart grouping, playlist learning)
4. Home Assistant scene integration

**See**: `docs/MUSIC_CONTROL_DESIGN.md` for detailed technical specifications

---

## Priority 1: Home Assistant Media Control (10 entities)
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

### Music Control (Priority 0)
1. Phase 1: Spotify API authentication and basic playback
2. Phase 2: Airfoil integration for multi-room AirPlay 2
3. Phase 3: Advanced features and Home Assistant coordination
4. Phase 4: Optimization and user preference learning

### Home Assistant Expansion
1. Add tools for Priority 1 entities first
2. Test voice commands thoroughly
3. Implement error handling for offline devices
4. Add entity state caching for performance
5. Expand to lower priority items

## Technical Considerations

### Music Control System
- Spotify Premium subscription required for playback control
- Airfoil commercial software dependency ($29)
- macOS limitation: No native multi-room AirPlay 2 APIs
- Rate limiting and API quota management for Spotify
- Secure token storage and refresh handling

### Home Assistant Integration
- Use entity-specific service calls
- Implement device availability checks
- Add friendly name resolution
- Consider area-based grouping for bulk operations
- Maintain existing conversation context system

### Cross-System Coordination
- Music commands work alongside existing HA controls
- Respect "Do Not Disturb" modes and scene states
- Coordinate with lighting and climate for ambiance control
- Unified logging and cost tracking across all integrations
# Home Assistant Integration Setup

## Prerequisites

1. Home Assistant instance running and accessible
2. Long-lived access token from Home Assistant

## Getting Your Access Token

1. Go to your Home Assistant dashboard
2. Click on your profile (bottom left)
3. Scroll to "Long-Lived Access Tokens"
4. Click "Create Token"
5. Give it a name (e.g., "Parakeet Voice Control")
6. Copy the generated token

## Configuration

Set these environment variables before running Parakeet:

```bash
export HOME_ASSISTANT_URL="http://your-homeassistant-ip:8123"
export HOME_ASSISTANT_TOKEN="your-long-lived-access-token"
```

Or add them to a `.env` file:

```env
HOME_ASSISTANT_URL=http://192.168.1.100:8123
HOME_ASSISTANT_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

## Running with Home Assistant

```bash
deno task dev
```

## Voice Commands

Now you can control your lights with voice commands:

- "Turn on the kitchen light"
- "Turn off all lights"
- "Dim the bedroom light to 50%"
- "Make the living room light blue"
- "Set office light to bright"
- "Turn on the hallway light and make it warm"

## Finding Entity IDs

To control specific lights, you need their entity IDs. Find them in Home
Assistant:

1. Go to Settings → Devices & Services → Entities
2. Filter by "Light" domain
3. Note the entity IDs (e.g., `light.kitchen_ceiling`, `light.bedroom_lamp`)

The voice control will try to match your spoken name to the entity ID
automatically.

## Extending to Other Devices

To add more device types (switches, climate, covers), modify the `tools` object
in `main.ts`:

```typescript
const tools: Record<string, Tool> = {
  // ... existing tools
  
  setSwitch: {
    description: "Control a switch",
    parameters: z.object({
      switch: z.string(),
      state: z.enum(["on", "off"])
    }),
    execute: async ({ switch, state }) => {
      const entityId = switch.includes('.') ? switch : `switch.${switch.toLowerCase().replace(/\s+/g, '_')}`;
      await callHomeAssistantService('switch', state === 'on' ? 'turn_on' : 'turn_off', {
        entity_id: entityId
      });
      return `Turned ${switch} ${state}`;
    }
  }
}
```

## Troubleshooting

1. **Connection errors**: Check your HOME_ASSISTANT_URL is correct
2. **401 Unauthorized**: Your token may be invalid or expired
3. **Entity not found**: Check the entity ID exists in Home Assistant
4. **Network errors**: Ensure Home Assistant is accessible from your machine

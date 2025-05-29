# Parakeet Voice - iOS App

A SwiftUI iOS app that provides voice control for your Parakeet smart home system.

## Features

- **Speech Recognition**: Uses iOS Speech framework for high-quality voice recognition
- **HTTP Communication**: Sends voice commands to your Parakeet server via HTTP
- **Real-time Feedback**: Shows transcription and responses in real-time
- **Connection Status**: Visual indicator of connection to Parakeet server
- **Automatic Silence Detection**: Stops listening after 2 seconds of silence

## Requirements

- iOS 15.0+
- Xcode 15.0+
- iPhone or iPad with microphone
- Parakeet server running on your local network

## Setup

### 1. Open in Xcode
```bash
cd ios
open ParakeetVoice.xcodeproj
```

### 2. Configure Your Development Team
1. Select the project in Xcode
2. Go to "Signing & Capabilities"
3. Select your development team
4. Change the bundle identifier if needed (e.g., `com.yourname.ParakeetVoice`)

### 3. Find Your Mac's IP Address
Run this command on your Mac to find the IP address:
```bash
ifconfig | grep 'inet ' | grep -v 127.0.0.1
```

### 4. Update Server URL
In `ParakeetClient.swift`, update the default server URL:
```swift
@Published var serverURL = "http://YOUR-MACBOOK-IP:3001"
```

Replace `YOUR-MACBOOK-IP` with your actual IP address (e.g., `192.168.1.100`).

### 5. Build and Run
1. Connect your iPhone/iPad
2. Select your device in Xcode
3. Click "Run" (⌘+R)

## Usage

### First Launch
1. **Grant Permissions**: The app will request microphone and speech recognition permissions
2. **Check Connection**: Look for the green connection indicator at the top
3. **Test Commands**: Tap the microphone button and say "turn on kitchen lights"

### Voice Commands
1. **Tap the microphone button** (blue circle)
2. **Speak your command** (button turns red while listening)
3. **Wait for response** from Parakeet
4. **View the result** in the response area

### Example Commands
- "turn on kitchen lights"
- "play jazz in the living room"
- "set bedroom temperature to 72"
- "turn off all lights"

## Architecture

### Files Overview
- **`App.swift`**: Main app entry point
- **`ContentView.swift`**: Main UI with speech button and status
- **`SpeechManager.swift`**: Handles iOS speech recognition
- **`ParakeetClient.swift`**: HTTP communication with Parakeet server
- **`Info.plist`**: App configuration and permissions

### Communication Flow
1. **Speech Input**: iOS Speech framework captures and transcribes voice
2. **HTTP Request**: Sends text to `http://your-mac:3001/voice-command`
3. **Parakeet Processing**: Your Parakeet server processes the command
4. **Response**: App displays the response from Parakeet

## Troubleshooting

### Connection Issues
- **Red indicator**: Check that Parakeet server is running on your Mac
- **Wrong IP**: Update the server URL in `ParakeetClient.swift`
- **Network**: Ensure iPhone and Mac are on same WiFi network

### Permission Issues
- **Microphone**: Go to Settings > Privacy > Microphone > Parakeet Voice
- **Speech Recognition**: Go to Settings > Privacy > Speech Recognition > Parakeet Voice

### Speech Recognition Issues
- **Speak clearly** and close to the device
- **Wait for the red button** to indicate listening
- **Avoid background noise** when possible
- **Try shorter commands** first

## Development Notes

### Testing Without Device
- Use the iOS Simulator for UI development
- Speech recognition requires a physical device
- HTTP communication works in simulator with localhost

### Customization
- **UI Colors**: Modify colors in `ContentView.swift`
- **Speech Timeout**: Adjust the 2-second timer in `SpeechManager.swift`
- **Server Configuration**: Add settings screen for easy URL changes

### Adding Features
- **Settings Screen**: Let users configure server URL in-app
- **Voice Feedback**: Add text-to-speech for responses
- **Shortcuts Integration**: Support Siri Shortcuts
- **Background Mode**: Keep app active for always-listening mode

## Integration with Main Parakeet

This iOS app is designed to work seamlessly with your existing Parakeet installation:

- **Same Commands**: Uses identical voice commands as Parakeet
- **Same AI**: Your Parakeet server processes commands with the same AI
- **Same Home Assistant**: Controls the same smart home devices
- **Same Tools**: Access to all your configured Parakeet tools

The only difference is the audio input source - instead of your Mac's microphone, it uses your iPhone's microphone with better noise cancellation and mobility.

## Security Notes

- **Local Network Only**: Communication happens over your local WiFi
- **No Cloud**: Voice processing happens on-device and on your Mac
- **HTTP**: Uses unencrypted HTTP (fine for local network)
- **Permissions**: Only requests necessary microphone and speech permissions

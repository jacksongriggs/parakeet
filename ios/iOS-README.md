# iOS App Structure

This directory contains the iOS companion app for Parakeet Voice Control.

## Quick Start

1. **Find your Mac's IP address:**
   ```bash
   ./find-ip.sh
   ```

2. **Open the project in Xcode:**
   ```bash
   open ParakeetVoice.xcodeproj
   ```

3. **Build and run on your iPhone/iPad**

## Files

- **`ParakeetVoice.xcodeproj`** - Xcode project file
- **`ParakeetVoice/`** - Source code directory
  - **`App.swift`** - Main app entry point
  - **`ContentView.swift`** - Main UI with speech interface  
  - **`SettingsView.swift`** - Configuration screen for server URL
  - **`SpeechManager.swift`** - iOS Speech Framework wrapper
  - **`ParakeetClient.swift`** - HTTP client for Parakeet server
  - **`Info.plist`** - App permissions and configuration
- **`find-ip.sh`** - Helper script to find your Mac's IP address
- **`README.md`** - Detailed documentation

## Features

✅ **Speech Recognition** - High-quality iOS speech-to-text  
✅ **HTTP Communication** - Sends commands to Parakeet server  
✅ **Real-time UI** - Shows transcription and responses  
✅ **Settings Screen** - Easy server configuration  
✅ **Connection Status** - Visual connection indicator  
✅ **Auto-Discovery** - Script finds your Mac's IP automatically  

## Architecture

```
iPhone App ──HTTP──> Parakeet Server ──Tools──> Home Assistant
     ↑                       ↑                        ↓
 Speech Rec.              AI Analysis              Smart Home
```

The iOS app captures speech, converts to text, and sends it to your existing Parakeet server. Everything else (AI processing, Home Assistant control, Music Assistant integration) works exactly the same as before.

## Next Steps

1. **Test the connection** using the find-ip script
2. **Open in Xcode** and configure your development team  
3. **Install on device** and grant microphone permissions
4. **Configure server URL** in the settings screen
5. **Start voice controlling** your smart home from anywhere!

Perfect for walking around the house while controlling your smart home system! 🏠🎤

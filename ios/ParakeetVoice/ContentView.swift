import SwiftUI

struct ContentView: View {
    @StateObject private var speechManager = SpeechManager()
    @StateObject private var parakeetClient = ParakeetClient()
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                // Header
                VStack {
                    Image(systemName: "bird.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.blue)
                    
                    Text("Parakeet Voice")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                }
                
                // Connection Status
                ConnectionStatusView(client: parakeetClient)
                
                // Speech Recognition Button
                SpeechButton(speechManager: speechManager, parakeetClient: parakeetClient)
                
                // Transcription Display
                TranscriptionView(speechManager: speechManager)
                
                // Response Display
                ResponseView(parakeetClient: parakeetClient)
                
                Spacer()
            }
            .padding()
            .navigationBarHidden(true)
        }
        .onAppear {
            speechManager.requestPermission()
            parakeetClient.testConnection()
        }
    }
}

struct ConnectionStatusView: View {
    @ObservedObject var client: ParakeetClient
    @State private var showSettings = false
    
    var body: some View {
        HStack {
            Circle()
                .fill(client.isConnected ? Color.green : Color.red)
                .frame(width: 12, height: 12)
            
            Text(client.isConnected ? "Connected to Parakeet" : "Disconnected")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Button("Settings") {
                showSettings = true
            }
            .font(.caption)
        }
        .padding(.horizontal)
        .sheet(isPresented: $showSettings) {
            SettingsView(parakeetClient: client)
        }
    }
}

struct SpeechButton: View {
    @ObservedObject var speechManager: SpeechManager
    @ObservedObject var parakeetClient: ParakeetClient
    
    var body: some View {
        Button(action: {
            if speechManager.isListening {
                speechManager.stopListening()
            } else {
                speechManager.startListening { transcript in
                    parakeetClient.sendCommand(transcript)
                }
            }
        }) {
            VStack {
                Image(systemName: speechManager.isListening ? "mic.fill" : "mic")
                    .font(.system(size: 40))
                    .foregroundColor(.white)
                
                Text(speechManager.isListening ? "Listening..." : "Tap to Speak")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            .frame(width: 200, height: 120)
            .background(
                RoundedRectangle(cornerRadius: 25)
                    .fill(speechManager.isListening ? Color.red : Color.blue)
                    .shadow(radius: speechManager.isListening ? 10 : 5)
            )
            .scaleEffect(speechManager.isListening ? 1.1 : 1.0)
            .animation(.easeInOut(duration: 0.2), value: speechManager.isListening)
        }
        .disabled(!speechManager.hasPermission || !parakeetClient.isConnected)
    }
}

struct TranscriptionView: View {
    @ObservedObject var speechManager: SpeechManager
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your Command:")
                .font(.headline)
                .foregroundColor(.secondary)
            
            Text(speechManager.transcript.isEmpty ? "Tap the microphone to speak..." : speechManager.transcript)
                .font(.body)
                .padding()
                .frame(maxWidth: .infinity, minHeight: 60)
                .background(Color.gray.opacity(0.1))
                .cornerRadius(10)
        }
    }
}

struct ResponseView: View {
    @ObservedObject var parakeetClient: ParakeetClient
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Parakeet Response:")
                .font(.headline)
                .foregroundColor(.secondary)
            
            ScrollView {
                Text(parakeetClient.lastResponse.isEmpty ? "Response will appear here..." : parakeetClient.lastResponse)
                    .font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding()
            .frame(maxWidth: .infinity, minHeight: 80)
            .background(Color.blue.opacity(0.1))
            .cornerRadius(10)
            
            if parakeetClient.isLoading {
                HStack {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Processing...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

#Preview {
    ContentView()
}

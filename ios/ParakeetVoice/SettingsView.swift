import SwiftUI

struct SettingsView: View {
    @ObservedObject var parakeetClient: ParakeetClient
    @State private var serverURL: String = ""
    @State private var showAlert = false
    @State private var alertMessage = ""
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Server Configuration")) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Parakeet Server URL")
                            .font(.headline)
                        
                        TextField("http://192.168.1.100:3001", text: $serverURL)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .keyboardType(.URL)
                        
                        Text("Enter your Mac's IP address and port 3001")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Section(header: Text("Connection Status")) {
                    HStack {
                        Circle()
                            .fill(parakeetClient.isConnected ? Color.green : Color.red)
                            .frame(width: 12, height: 12)
                        
                        Text(parakeetClient.isConnected ? "Connected" : "Disconnected")
                        
                        Spacer()
                        
                        Button("Test") {
                            testConnection()
                        }
                        .disabled(serverURL.isEmpty)
                    }
                }
                
                Section(header: Text("How to Find Your Mac's IP")) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("1. Open Terminal on your Mac")
                        Text("2. Run: ifconfig | grep 'inet ' | grep -v 127.0.0.1")
                        Text("3. Look for an address like 192.168.1.100")
                        Text("4. Enter it above with :3001 at the end")
                        
                        Text("Example: http://192.168.1.100:3001")
                            .font(.caption)
                            .foregroundColor(.blue)
                            .padding(.top, 4)
                    }
                    .font(.caption)
                }
                
                Section(header: Text("Troubleshooting")) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("• Make sure Parakeet is running on your Mac")
                        Text("• Ensure iPhone and Mac are on same WiFi")
                        Text("• Check that port 3001 is not blocked")
                        Text("• Try pinging your Mac from iPhone")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveSettings()
                    }
                    .disabled(serverURL.isEmpty)
                }
            }
            .onAppear {
                serverURL = parakeetClient.serverURL
            }
            .alert("Connection Test", isPresented: $showAlert) {
                Button("OK") { }
            } message: {
                Text(alertMessage)
            }
        }
    }
    
    private func testConnection() {
        let testURL = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        
        guard !testURL.isEmpty else { return }
        guard URL(string: testURL) != nil else {
            alertMessage = "Invalid URL format"
            showAlert = true
            return
        }
        
        // Update client URL temporarily for testing
        let originalURL = parakeetClient.serverURL
        parakeetClient.serverURL = testURL
        parakeetClient.testConnection()
        
        // Give it a moment to test
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if parakeetClient.isConnected {
                alertMessage = "✅ Connected successfully!"
            } else {
                alertMessage = "❌ Connection failed. Check the URL and make sure Parakeet is running."
                // Restore original URL if test failed
                parakeetClient.serverURL = originalURL
                parakeetClient.testConnection()
            }
            showAlert = true
        }
    }
    
    private func saveSettings() {
        let newURL = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        
        guard !newURL.isEmpty else { return }
        guard URL(string: newURL) != nil else {
            alertMessage = "Please enter a valid URL"
            showAlert = true
            return
        }
        
        parakeetClient.updateServerURL(newURL)
        dismiss()
    }
}

#Preview {
    SettingsView(parakeetClient: ParakeetClient())
}

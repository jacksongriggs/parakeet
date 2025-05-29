import Foundation
import Combine

class ParakeetClient: ObservableObject {
    @Published var isConnected = false
    @Published var isLoading = false
    @Published var lastResponse = ""
    @Published var serverURL = "http://192.168.1.109:3001" // Update this with your Mac's IP
    
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        // Load saved server URL from UserDefaults
        if let savedURL = UserDefaults.standard.string(forKey: "ParakeetServerURL") {
            serverURL = savedURL
        }
    }
    
    func updateServerURL(_ url: String) {
        serverURL = url
        UserDefaults.standard.set(url, forKey: "ParakeetServerURL")
        testConnection()
    }
    
    func testConnection() {
        guard let url = URL(string: "\(serverURL)/health") else {
            isConnected = false
            return
        }
        
        URLSession.shared.dataTaskPublisher(for: url)
            .map { $0.response as? HTTPURLResponse }
            .map { $0?.statusCode == 200 }
            .replaceError(with: false)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] connected in
                self?.isConnected = connected
                if connected {
                    print("✅ Connected to Parakeet server at \(self?.serverURL ?? "")")
                } else {
                    print("❌ Failed to connect to Parakeet server at \(self?.serverURL ?? "")")
                }
            }
            .store(in: &cancellables)
    }
    
    func sendCommand(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        guard let url = URL(string: "\(serverURL)/voice-command") else { return }
        
        isLoading = true
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = VoiceCommandRequest(
            text: text.trimmingCharacters(in: .whitespacesAndNewlines),
            utteranceId: "ios_app_\(UUID().uuidString)"
        )
        
        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            print("Failed to encode request: \(error)")
            isLoading = false
            return
        }
        
        print("🎤 Sending command to Parakeet: '\(text)'")
        
        URLSession.shared.dataTaskPublisher(for: request)
            .tryMap { output in
                guard let httpResponse = output.response as? HTTPURLResponse else {
                    throw URLError(.badServerResponse)
                }
                
                if httpResponse.statusCode == 200 {
                    return output.data
                } else {
                    throw URLError(.badServerResponse)
                }
            }
            .decode(type: VoiceCommandResponse.self, decoder: JSONDecoder())
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    
                    switch completion {
                    case .finished:
                        break
                    case .failure(let error):
                        print("❌ Command failed: \(error)")
                        self?.lastResponse = "Error: Failed to communicate with Parakeet server"
                        self?.isConnected = false
                    }
                },
                receiveValue: { [weak self] response in
                    print("✅ Parakeet response: '\(response.response)'")
                    self?.lastResponse = response.response
                }
            )
            .store(in: &cancellables)
    }
}

// MARK: - Request/Response Models
struct VoiceCommandRequest: Codable {
    let text: String
    let utteranceId: String
}

struct VoiceCommandResponse: Codable {
    let response: String
    let input: String
    let timestamp: String
}

import Foundation
import WatchConnectivity

struct WatchCredentials: Equatable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Double
    var apiBase: String
    var supabaseUrl: String
    var supabaseAnonKey: String

    var isUsable: Bool {
        !accessToken.isEmpty && !apiBase.isEmpty
    }

    init?(_ payload: [String: Any]) {
        guard
            let accessToken = payload["accessToken"] as? String,
            let refreshToken = payload["refreshToken"] as? String,
            !accessToken.isEmpty
        else { return nil }
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = payload["expiresAt"] as? Double ?? 0
        self.apiBase = (payload["apiBase"] as? String)?.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            ?? "https://rutina.al"
        self.supabaseUrl = payload["supabaseUrl"] as? String ?? ""
        self.supabaseAnonKey = payload["supabaseAnonKey"] as? String ?? ""
    }
}

struct WatchToday: Decodable, Equatable {
    var date: String
    var locale: String
    var workout: WatchWorkout
    var nutrition: WatchNutrition
    var steps: WatchSteps
    var water: WatchWater
    var cardio: WatchCardio
}

struct WatchWorkout: Decodable, Equatable {
    var title: String?
    var status: String
    var canLogSets: Bool
    var sessionId: String?
    var exerciseName: String?
    var setNumber: Int?
    var setId: String?
    var targetReps: String?
}

struct WatchNutrition: Decodable, Equatable {
    var calories: Int
    var protein: Int
    var carbs: Int
    var fat: Int
    var targetCalories: Int
    var targetProtein: Int
    var targetCarbs: Int
    var targetFat: Int
}

struct WatchSteps: Decodable, Equatable {
    var goal: Int
}

struct WatchWater: Decodable, Equatable {
    var ml: Int
    var goalMl: Int
}

struct WatchCardio: Decodable, Equatable {
    var id: String?
    var title: String?
    var plannedMinutes: Int?
    var status: String
    var elapsedSeconds: Int
    var completed: Bool
}

struct WatchActionResponse: Decodable {
    var today: WatchToday?
    var message: String?
    var reply: String?
    var error: String?
}

enum WatchAPIError: LocalizedError {
    case signedOut
    case message(String)

    var errorDescription: String? {
        switch self {
        case .signedOut:
            return "Open RUTINA on your iPhone and sign in."
        case .message(let text):
            return text
        }
    }
}

enum WatchAPI {
    static func today(date: String) async throws -> WatchToday {
        let response = try await post(["action": "today", "date": date])
        guard let today = response.today else {
            throw WatchAPIError.message(response.error ?? "Couldn't load today.")
        }
        return today
    }

    static func perform(_ action: String, date: String, extra: [String: Any] = [:]) async throws -> WatchActionResponse {
        var body: [String: Any] = ["action": action, "date": date]
        extra.forEach { body[$0.key] = $0.value }
        return try await post(body)
    }

    private static func post(_ body: [String: Any], retry: Bool = true) async throws -> WatchActionResponse {
        let credentials = await WatchSessionBridge.shared.credentialsForRequest()
        guard let credentials, credentials.isUsable else {
            throw WatchAPIError.signedOut
        }

        guard let url = URL(string: "\(credentials.apiBase)/api/watch") else {
            throw WatchAPIError.message("Missing server address. Open RUTINA on your iPhone.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(credentials.accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let decoded = try? JSONDecoder().decode(WatchActionResponse.self, from: data)

        if status == 401, retry {
            let refreshed = await WatchSessionBridge.shared.requestCredentialsFromPhone()
            if refreshed {
                return try await post(body, retry: false)
            }
            throw WatchAPIError.signedOut
        }

        if let error = decoded?.error, status >= 400 {
            throw WatchAPIError.message(error)
        }
        if status >= 400 {
            throw WatchAPIError.message("Couldn't reach RUTINA.")
        }
        return decoded ?? WatchActionResponse(today: nil, message: nil, reply: nil, error: nil)
    }
}

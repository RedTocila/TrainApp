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

struct WatchSet: Decodable, Equatable, Identifiable {
    var id: String
    var number: Int
    var done: Bool
}

struct WatchHiitPhase: Decodable, Equatable {
    var type: String
    var seconds: Int
    var label: String
    var name: String?
    var gifUrl: String?
}

struct WatchExercise: Decodable, Equatable, Identifiable {
    var id: String
    var name: String
    var gifUrl: String?
    var videoUrl: String?
    var targetReps: String?
    var setCount: Int
    var completedSets: Int
    var openSetId: String?
    var openSetNumber: Int?
    var lastWeightKg: Double?
    var lastReps: Int?
    var sets: [WatchSet]

    init(
        id: String,
        name: String,
        gifUrl: String?,
        videoUrl: String? = nil,
        targetReps: String?,
        setCount: Int,
        completedSets: Int,
        openSetId: String?,
        openSetNumber: Int?,
        lastWeightKg: Double?,
        lastReps: Int?,
        sets: [WatchSet] = []
    ) {
        self.id = id
        self.name = name
        self.gifUrl = gifUrl
        self.videoUrl = videoUrl
        self.targetReps = targetReps
        self.setCount = setCount
        self.completedSets = completedSets
        self.openSetId = openSetId
        self.openSetNumber = openSetNumber
        self.lastWeightKg = lastWeightKg
        self.lastReps = lastReps
        self.sets = sets
    }

    enum CodingKeys: String, CodingKey {
        case id, name, gifUrl, videoUrl, targetReps, setCount, completedSets
        case openSetId, openSetNumber, lastWeightKg, lastReps, sets
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        gifUrl = try container.decodeIfPresent(String.self, forKey: .gifUrl)
        videoUrl = try container.decodeIfPresent(String.self, forKey: .videoUrl)
        targetReps = try container.decodeIfPresent(String.self, forKey: .targetReps)
        setCount = try container.decodeIfPresent(Int.self, forKey: .setCount) ?? 1
        completedSets = try container.decodeIfPresent(Int.self, forKey: .completedSets) ?? 0
        openSetId = try container.decodeIfPresent(String.self, forKey: .openSetId)
        openSetNumber = try container.decodeIfPresent(Int.self, forKey: .openSetNumber)
        lastWeightKg = try container.decodeIfPresent(Double.self, forKey: .lastWeightKg)
        lastReps = try container.decodeIfPresent(Int.self, forKey: .lastReps)
        sets = try container.decodeIfPresent([WatchSet].self, forKey: .sets) ?? []
    }
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
    var exercises: [WatchExercise]
    var mode: String
    var phases: [WatchHiitPhase]

    enum CodingKeys: String, CodingKey {
        case title, status, canLogSets, sessionId, exerciseName, setNumber, setId, targetReps, exercises, mode, phases
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        status = try container.decode(String.self, forKey: .status)
        canLogSets = try container.decodeIfPresent(Bool.self, forKey: .canLogSets) ?? false
        sessionId = try container.decodeIfPresent(String.self, forKey: .sessionId)
        exerciseName = try container.decodeIfPresent(String.self, forKey: .exerciseName)
        setNumber = try container.decodeIfPresent(Int.self, forKey: .setNumber)
        setId = try container.decodeIfPresent(String.self, forKey: .setId)
        targetReps = try container.decodeIfPresent(String.self, forKey: .targetReps)
        exercises = try container.decodeIfPresent([WatchExercise].self, forKey: .exercises) ?? []
        mode = try container.decodeIfPresent(String.self, forKey: .mode) ?? "strength"
        phases = try container.decodeIfPresent([WatchHiitPhase].self, forKey: .phases) ?? []
    }
}

struct WatchMeal: Decodable, Equatable, Identifiable {
    var id: String
    var name: String
    var calories: Int
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
    var meals: [WatchMeal]

    enum CodingKeys: String, CodingKey {
        case calories, protein, carbs, fat
        case targetCalories, targetProtein, targetCarbs, targetFat, meals
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        calories = try container.decode(Int.self, forKey: .calories)
        protein = try container.decode(Int.self, forKey: .protein)
        carbs = try container.decode(Int.self, forKey: .carbs)
        fat = try container.decode(Int.self, forKey: .fat)
        targetCalories = try container.decode(Int.self, forKey: .targetCalories)
        targetProtein = try container.decode(Int.self, forKey: .targetProtein)
        targetCarbs = try container.decode(Int.self, forKey: .targetCarbs)
        targetFat = try container.decode(Int.self, forKey: .targetFat)
        meals = try container.decodeIfPresent([WatchMeal].self, forKey: .meals) ?? []
    }
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
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(credentials.accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let decoded = try? JSONDecoder().decode(WatchActionResponse.self, from: data)

        if status == 401, retry {
            if await WatchSessionBridge.shared.refreshSession() {
                return try await post(body, retry: false)
            }
            let refreshed = await WatchSessionBridge.shared.requestCredentialsFromPhone()
            if refreshed {
                _ = await WatchSessionBridge.shared.refreshSession()
                let usable = await WatchSessionBridge.shared.credentials?.isUsable == true
                if usable {
                    return try await post(body, retry: false)
                }
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

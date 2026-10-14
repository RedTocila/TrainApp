import ActivityKit
import AppIntents
import Foundation
import UIKit

enum LiveWorkoutStore {
    static let suiteName = "group.al.rutina.app"
    private static let credentialsKey = "credentials"
    private static let focusKey = "focusIndex"
    private static let quickKey = "quickOpen"
    private static let draftKey = "draft"
    private static let imageTokenKey = "imageToken"
    private static let imageName = "live-exercise.jpg"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }

    static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suiteName)
    }

    static func saveCredentials(_ payload: [String: Any]) {
        defaults.set(payload, forKey: credentialsKey)
    }

    static func clearCredentials() {
        defaults.removeObject(forKey: credentialsKey)
    }

    static func credentials() -> [String: Any]? {
        defaults.dictionary(forKey: credentialsKey)
    }

    static var focusIndex: Int {
        get { defaults.integer(forKey: focusKey) }
        set { defaults.set(newValue, forKey: focusKey) }
    }

    static func markQuickOpen() {
        defaults.set(true, forKey: quickKey)
        defaults.set(focusIndex, forKey: "quickExercise")
    }

    static func consumeQuickOpen() -> (open: Bool, exerciseIndex: Int) {
        let open = defaults.bool(forKey: quickKey)
        let index = defaults.integer(forKey: "quickExercise")
        if open { defaults.set(false, forKey: quickKey) }
        return (open, index)
    }

    static func saveDraft(index: Int, setId: String, reps: Int, weight: Double) {
        defaults.set(
            ["exerciseIndex": index, "setId": setId, "reps": reps, "weightKg": weight],
            forKey: draftKey
        )
        focusIndex = index
    }

    static func draft() -> [String: Any]? {
        defaults.dictionary(forKey: draftKey)
    }

    static func clearDraft() {
        defaults.removeObject(forKey: draftKey)
    }

    static var imageToken: Int {
        get { defaults.integer(forKey: imageTokenKey) }
        set { defaults.set(newValue, forKey: imageTokenKey) }
    }

    static func thumbnail() -> UIImage? {
        guard let url = containerURL?.appendingPathComponent(imageName),
              let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    /// Writes the first frame of the exercise GIF for the Lock Screen card.
    static func cacheImage(from urlString: String?) async -> Int {
        guard
            let urlString,
            let url = URL(string: urlString),
            let folder = containerURL
        else { return imageToken }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode ?? 500 < 300,
                  let image = UIImage(data: data) else { return imageToken }
            let longest = max(image.size.width, image.size.height)
            let scale = longest > 240 ? 240 / longest : 1
            let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
            let renderer = UIGraphicsImageRenderer(size: size)
            let scaled = renderer.image { _ in
                image.draw(in: CGRect(origin: .zero, size: size))
            }
            guard let jpeg = scaled.jpegData(compressionQuality: 0.72) else { return imageToken }
            try jpeg.write(to: folder.appendingPathComponent(imageName), options: .atomic)
            imageToken += 1
            return imageToken
        } catch {
            return imageToken
        }
    }
}

@available(iOS 16.2, *)
struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var exerciseName: String
        var setLabel: String
        var reps: Int
        var weightKg: Double
        var setId: String
        var exerciseIndex: Int
        var exerciseCount: Int
        var imageToken: Int
    }

    var title: String
}

enum LiveWorkoutFormatting {
    static func weight(_ value: Double) -> String {
        let rounded = (value * 10).rounded() / 10
        return rounded.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", rounded)
            : String(format: "%.1f", rounded)
    }

    static func setLabel(number: Int, count: Int) -> String {
        guard number > 0, count > 0 else { return "Set" }
        return "Set \(number) of \(count)"
    }
}

private struct LiveCredentials {
    var accessToken: String
    var refreshToken: String
    var apiBase: String
    var supabaseUrl: String
    var supabaseAnonKey: String

    init?(_ payload: [String: Any]?) {
        guard
            let payload,
            let accessToken = payload["accessToken"] as? String,
            !accessToken.isEmpty,
            let apiBase = payload["apiBase"] as? String,
            !apiBase.isEmpty
        else { return nil }
        self.accessToken = accessToken
        self.refreshToken = payload["refreshToken"] as? String ?? ""
        self.apiBase = apiBase.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.supabaseUrl = payload["supabaseUrl"] as? String ?? ""
        self.supabaseAnonKey = payload["supabaseAnonKey"] as? String ?? ""
    }
}

struct LiveSnapshot: Decodable {
    var active: Bool
    var exerciseName: String
    var exerciseIndex: Int
    var exerciseCount: Int
    var gifUrl: String?
    var setId: String?
    var setNumber: Int
    var setCount: Int
    var reps: Int
    var weightKg: Double
}

private struct LiveEnvelope: Decodable {
    var live: LiveSnapshot?
    var error: String?
}

enum LiveWorkoutAPI {
    static func live(exerciseIndex: Int, advance: Bool) async throws -> LiveSnapshot {
        let body: [String: Any] = [
            "action": "workout.live",
            "date": dateKey(),
            "exerciseIndex": exerciseIndex,
            "advance": advance
        ]
        let envelope = try await post(body)
        guard let live = envelope.live else {
            throw LiveWorkoutError.message(envelope.error ?? "Couldn't load the set.")
        }
        return live
    }

    static func logSet(setId: String, reps: Int, weight: Double) async throws {
        let body: [String: Any] = [
            "action": "workout.logSet",
            "date": dateKey(),
            "setId": setId,
            "reps": reps,
            "weightKg": weight
        ]
        let envelope = try await post(body)
        if let error = envelope.error, !error.isEmpty {
            throw LiveWorkoutError.message(error)
        }
    }

    private static func dateKey() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private static func post(_ body: [String: Any], retry: Bool = true) async throws -> LiveEnvelope {
        guard let credentials = LiveCredentials(LiveWorkoutStore.credentials()) else {
            throw LiveWorkoutError.signedOut
        }
        guard let url = URL(string: "\(credentials.apiBase)/api/watch") else {
            throw LiveWorkoutError.message("Missing server address.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(credentials.accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401, retry, await refresh(credentials) {
            return try await post(body, retry: false)
        }
        let envelope = (try? JSONDecoder().decode(LiveEnvelope.self, from: data)) ?? LiveEnvelope(live: nil, error: nil)
        if status >= 400 {
            throw LiveWorkoutError.message(envelope.error ?? "Couldn't reach RUTINA.")
        }
        return envelope
    }

    private static func refresh(_ current: LiveCredentials) async -> Bool {
        guard
            !current.refreshToken.isEmpty,
            !current.supabaseUrl.isEmpty,
            !current.supabaseAnonKey.isEmpty,
            let url = URL(string: "\(current.supabaseUrl)/auth/v1/token?grant_type=refresh_token")
        else { return false }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(current.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": current.refreshToken])
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode ?? 500 < 300,
                  let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let accessToken = json["access_token"] as? String,
                  let refreshToken = json["refresh_token"] as? String,
                  !accessToken.isEmpty
            else { return false }
            var payload = LiveWorkoutStore.credentials() ?? [:]
            payload["accessToken"] = accessToken
            payload["refreshToken"] = refreshToken
            LiveWorkoutStore.saveCredentials(payload)
            return true
        } catch {
            return false
        }
    }
}

private enum LiveWorkoutError: LocalizedError {
    case signedOut
    case message(String)

    var errorDescription: String? {
        switch self {
        case .signedOut:
            return "Open RUTINA and sign in."
        case .message(let text):
            return text
        }
    }
}

@available(iOS 16.2, *)
enum LiveWorkoutSync {
    static func state(
        name: String,
        setNumber: Int,
        setCount: Int,
        reps: Int,
        weightKg: Double,
        setId: String,
        exerciseIndex: Int,
        exerciseCount: Int,
        imageToken: Int
    ) -> WorkoutActivityAttributes.ContentState {
        WorkoutActivityAttributes.ContentState(
            exerciseName: name,
            setLabel: LiveWorkoutFormatting.setLabel(number: setNumber, count: setCount),
            reps: min(40, max(1, reps)),
            weightKg: min(200, max(0, (weightKg * 10).rounded() / 10)),
            setId: setId,
            exerciseIndex: exerciseIndex,
            exerciseCount: max(exerciseCount, 1),
            imageToken: imageToken
        )
    }

    static func state(from snapshot: LiveSnapshot, imageToken: Int) -> WorkoutActivityAttributes.ContentState {
        state(
            name: snapshot.exerciseName,
            setNumber: snapshot.setNumber,
            setCount: snapshot.setCount,
            reps: snapshot.reps,
            weightKg: snapshot.weightKg,
            setId: snapshot.setId ?? "",
            exerciseIndex: snapshot.exerciseIndex,
            exerciseCount: snapshot.exerciseCount,
            imageToken: imageToken
        )
    }

    @MainActor
    static func update(_ state: WorkoutActivityAttributes.ContentState) async {
        LiveWorkoutStore.saveDraft(
            index: state.exerciseIndex,
            setId: state.setId,
            reps: state.reps,
            weight: state.weightKg
        )
        let content = ActivityContent(state: state, staleDate: nil)
        for activity in Activity<WorkoutActivityAttributes>.activities {
            await activity.update(content)
        }
    }

    @MainActor
    static func endAll() async {
        LiveWorkoutStore.clearDraft()
        for activity in Activity<WorkoutActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    @MainActor
    static func apply(_ snapshot: LiveSnapshot) async {
        guard snapshot.active else {
            await endAll()
            return
        }
        let token = await LiveWorkoutStore.cacheImage(from: snapshot.gifUrl)
        await update(state(from: snapshot, imageToken: token))
    }

    @MainActor
    static func adjust(repsDelta: Int, weightDelta: Double) async {
        for activity in Activity<WorkoutActivityAttributes>.activities {
            var state = activity.content.state
            if repsDelta != 0 {
                state.reps = min(40, max(1, state.reps + repsDelta))
            }
            if weightDelta != 0 {
                let next = min(200, max(0, state.weightKg + weightDelta))
                state.weightKg = (next * 10).rounded() / 10
            }
            await update(state)
        }
    }
}

@available(iOS 16.2, *)
struct AdjustRepsIntent: AppIntent {
    static var title: LocalizedStringResource = "Change reps"
    static var openAppWhenRun = false

    @Parameter(title: "Change") var delta: Int

    init() { delta = 0 }
    init(delta: Int) { self.delta = delta }

    func perform() async throws -> some IntentResult {
        await LiveWorkoutSync.adjust(repsDelta: delta, weightDelta: 0)
        return .result()
    }
}

@available(iOS 16.2, *)
struct AdjustWeightIntent: AppIntent {
    static var title: LocalizedStringResource = "Change weight"
    static var openAppWhenRun = false

    @Parameter(title: "Change") var delta: Double

    init() { delta = 0 }
    init(delta: Double) { self.delta = delta }

    func perform() async throws -> some IntentResult {
        await LiveWorkoutSync.adjust(repsDelta: 0, weightDelta: delta)
        return .result()
    }
}

@available(iOS 16.2, *)
struct LogLiveSetIntent: AppIntent {
    static var title: LocalizedStringResource = "Log set"
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        guard let state = Activity<WorkoutActivityAttributes>.activities.first?.content.state,
              !state.setId.isEmpty else { return .result() }
        try await LiveWorkoutAPI.logSet(setId: state.setId, reps: state.reps, weight: state.weightKg)
        let live = try await LiveWorkoutAPI.live(exerciseIndex: state.exerciseIndex, advance: true)
        await LiveWorkoutSync.apply(live)
        return .result()
    }
}

@available(iOS 16.2, *)
struct NextLiveExerciseIntent: AppIntent {
    static var title: LocalizedStringResource = "Next exercise"
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        guard let state = Activity<WorkoutActivityAttributes>.activities.first?.content.state,
              state.exerciseCount > 1 else { return .result() }
        let next = (state.exerciseIndex + 1) % state.exerciseCount
        let live = try await LiveWorkoutAPI.live(exerciseIndex: next, advance: false)
        await LiveWorkoutSync.apply(live)
        return .result()
    }
}

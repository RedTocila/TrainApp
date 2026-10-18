import ActivityKit
import AppIntents
import Foundation
import ImageIO
import UIKit

enum LiveWorkoutStore {
    static let suiteName = "group.al.rutina.app"
    private static let credentialsKey = "credentials"
    private static let focusKey = "focusIndex"
    private static let quickKey = "quickOpen"
    private static let draftKey = "draft"
    private static let imageTokenKey = "imageToken"
    private static let imageName = "live-exercise.jpg"
    private static let generationKey = "syncGeneration"
    private static let activeKey = "liveActive"
    private static let boardKey = "liveBoard"
    private static let revisionKey = "liveRevision"
    private static let pendingKey = "pendingLogs"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }

    /// `synchronize()` blocks the app-group store for a long time and holds
    /// Lock Screen taps (and in-workout updates) until it finishes.
    private static func flush() {}

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
        flush()
    }

    static func draft() -> [String: Any]? {
        defaults.dictionary(forKey: draftKey)
    }

    static func clearDraft() {
        defaults.removeObject(forKey: draftKey)
        flush()
    }

    /// Bumps on every Lock Screen edit so a stale phone publish cannot rewind it.
    static var revision: Int {
        get { defaults.integer(forKey: revisionKey) }
        set {
            defaults.set(newValue, forKey: revisionKey)
            flush()
        }
    }

    @available(iOS 16.2, *)
    static var board: LiveBoard? {
        get {
            guard let data = defaults.data(forKey: boardKey) else { return nil }
            return try? JSONDecoder().decode(LiveBoard.self, from: data)
        }
        set {
            if let newValue, let data = try? JSONEncoder().encode(newValue) {
                defaults.set(data, forKey: boardKey)
            } else {
                defaults.removeObject(forKey: boardKey)
            }
            flush()
        }
    }

    static var boardJSON: String {
        guard let data = defaults.data(forKey: boardKey) else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }

    static var pendingJSON: String {
        guard let data = defaults.data(forKey: pendingKey) else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }

    @available(iOS 16.2, *)
    static func shouldIgnorePhoneSync(baseRevision: Int, board incoming: LiveBoard?) -> Bool {
        if baseRevision != revision { return true }
        if let incoming, let local = board, local.isAhead(of: incoming) { return true }
        return false
    }

    @available(iOS 16.2, *)
    static func pendingLogs() -> [PendingLiveLog] {
        guard let data = defaults.data(forKey: pendingKey) else { return [] }
        return (try? JSONDecoder().decode([PendingLiveLog].self, from: data)) ?? []
    }

    @available(iOS 16.2, *)
    static func savePendingLogs(_ logs: [PendingLiveLog]) {
        if logs.isEmpty {
            defaults.removeObject(forKey: pendingKey)
        } else if let data = try? JSONEncoder().encode(logs) {
            defaults.set(data, forKey: pendingKey)
        }
        flush()
    }

    /// Bumped when the workout ends so an in-flight sync cannot bring the card back.
    static var syncGeneration: Int {
        defaults.integer(forKey: generationKey)
    }

    /// `nil` until a workout has started or ended on this install.
    static var liveFlag: Bool? {
        guard defaults.object(forKey: activeKey) != nil else { return nil }
        return defaults.bool(forKey: activeKey)
    }

    static var isLive: Bool {
        liveFlag == true
    }

    static func beginSync() -> Int {
        defaults.set(true, forKey: activeKey)
        return syncGeneration
    }

    static func cancelSync() {
        defaults.set(false, forKey: activeKey)
        defaults.set(syncGeneration + 1, forKey: generationKey)
    }

    static func isSyncCurrent(_ generation: Int) -> Bool {
        isLive && syncGeneration == generation
    }

    static var imageToken: Int {
        get { defaults.integer(forKey: imageTokenKey) }
        set { defaults.set(newValue, forKey: imageTokenKey) }
    }

    static func thumbnail() -> UIImage? {
        imageFile(imageName)
    }

    static func thumbnail(at index: Int) -> UIImage? {
        imageFile("live-\(index).jpg") ?? (index == focusIndex ? thumbnail() : nil)
    }

    private static func imageFile(_ name: String) -> UIImage? {
        guard let url = containerURL?.appendingPathComponent(name),
              let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    private static func imageExists(_ name: String) -> Bool {
        guard let url = containerURL?.appendingPathComponent(name) else { return false }
        return FileManager.default.fileExists(atPath: url.path)
    }

    /// Writes the first frame of the exercise GIF for the Lock Screen card.
    /// Rep taps repeat the same URL. Pulling that GIF into memory each time
    /// stalled the workout and jetsammed the web view.
    private static var inflightURL: String?

    static func cacheImage(from urlString: String?, index: Int? = nil) async -> Int {
        guard
            let urlString,
            let url = URL(string: urlString),
            let folder = containerURL
        else { return imageToken }

        let cacheKey = "cachedGifURL-\(index ?? -1)"
        let fileName = index.map { "live-\($0).jpg" } ?? imageName
        if defaults.string(forKey: cacheKey) == urlString, imageExists(fileName) {
            return imageToken
        }
        if inflightURL == urlString { return imageToken }
        inflightURL = urlString
        defer { if inflightURL == urlString { inflightURL = nil } }

        do {
            let (fileURL, response) = try await URLSession.shared.download(from: url)
            defer { try? FileManager.default.removeItem(at: fileURL) }
            let bytes = (try? fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            guard (response as? HTTPURLResponse)?.statusCode ?? 500 < 300,
                  bytes > 0, bytes < 8_000_000,
                  let image = stillImage(at: fileURL) else {
                if bytes >= 8_000_000 {
                    defaults.set(urlString, forKey: cacheKey)
                }
                return imageToken
            }
            let longest = max(image.size.width, image.size.height)
            let scale = longest > 240 ? 240 / longest : 1
            let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let renderer = UIGraphicsImageRenderer(size: size, format: format)
            let scaled = renderer.image { _ in
                image.draw(in: CGRect(origin: .zero, size: size))
            }
            guard let jpeg = scaled.jpegData(compressionQuality: 0.72) else { return imageToken }
            if let index {
                try jpeg.write(to: folder.appendingPathComponent("live-\(index).jpg"), options: .atomic)
            }
            try jpeg.write(to: folder.appendingPathComponent(imageName), options: .atomic)
            defaults.set(urlString, forKey: cacheKey)
            imageToken += 1
            return imageToken
        } catch {
            return imageToken
        }
    }

    /// First frame only, from a file. `Data(contentsOf:)` plus `UIImage(data:)` expands every GIF frame.
    private static func stillImage(at url: URL) -> UIImage? {
        let sourceOptions: [CFString: Any] = [kCGImageSourceShouldCache: false]
        guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions as CFDictionary) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceThumbnailMaxPixelSize: 240,
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: false
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: image)
    }
}

@available(iOS 16.2, *)
struct PendingLiveLog: Codable, Equatable {
    var setId: String
    var reps: Int
    var weightKg: Double
}

@available(iOS 16.2, *)
struct LiveBoardSet: Codable, Equatable {
    var id: String
    var number: Int
    var reps: Int
    var weightKg: Double
    var done: Bool
}

@available(iOS 16.2, *)
struct LiveBoardExercise: Codable, Equatable {
    var name: String
    var gifUrl: String?
    var sets: [LiveBoardSet]
    var restSeconds: Int

    init(name: String, gifUrl: String?, sets: [LiveBoardSet], restSeconds: Int = 90) {
        self.name = name
        self.gifUrl = gifUrl
        self.sets = sets
        self.restSeconds = restSeconds
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        gifUrl = try container.decodeIfPresent(String.self, forKey: .gifUrl)
        sets = try container.decode([LiveBoardSet].self, forKey: .sets)
        restSeconds = try container.decodeIfPresent(Int.self, forKey: .restSeconds) ?? 90
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(gifUrl, forKey: .gifUrl)
        try container.encode(sets, forKey: .sets)
        try container.encode(restSeconds, forKey: .restSeconds)
    }

    private enum CodingKeys: String, CodingKey {
        case name, gifUrl, sets, restSeconds
    }
}

@available(iOS 16.2, *)
struct LiveBoard: Codable, Equatable {
    var exercises: [LiveBoardExercise]

    init?(json: String?) {
        guard
            let json,
            let data = json.data(using: .utf8),
            let board = try? JSONDecoder().decode(LiveBoard.self, from: data),
            !board.exercises.isEmpty
        else { return nil }
        self = board
    }

    func isAhead(of other: LiveBoard) -> Bool {
        let incoming = Set(other.exercises.flatMap { $0.sets.filter(\.done).map(\.id) })
        return exercises.flatMap { $0.sets.filter(\.done).map(\.id) }.contains { !incoming.contains($0) }
    }

    func contentState(index: Int, imageToken: Int) -> WorkoutActivityAttributes.ContentState? {
        guard exercises.indices.contains(index) else { return nil }
        let exercise = exercises[index]
        let open = exercise.sets.first { !$0.done }
        let count = max(exercise.sets.count, 1)
        return LiveWorkoutSync.state(
            name: exercise.name,
            setNumber: open?.number ?? count,
            setCount: count,
            reps: open?.reps ?? exercise.sets.last?.reps ?? 6,
            weightKg: open?.weightKg ?? exercise.sets.last?.weightKg ?? 10,
            setId: open?.id ?? "",
            exerciseIndex: index,
            exerciseCount: max(exercises.count, 1),
            imageToken: imageToken,
            restSeconds: exercise.restSeconds
        )
    }

    func restSeconds(for setId: String) -> Int {
        for exercise in exercises where exercise.sets.contains(where: { $0.id == setId }) {
            return exercise.restSeconds
        }
        return 90
    }

    mutating func write(setId: String, reps: Int, weight: Double) -> Bool {
        for exercise in exercises.indices {
            for set in exercises[exercise].sets.indices where exercises[exercise].sets[set].id == setId {
                exercises[exercise].sets[set].reps = reps
                exercises[exercise].sets[set].weightKg = weight
                return true
            }
        }
        return false
    }

    /// Marks the set done and points at the next open exercise.
    mutating func complete(setId: String, reps: Int, weight: Double) -> (found: Bool, nextIndex: Int?) {
        var owner: Int?
        for exercise in exercises.indices {
            for set in exercises[exercise].sets.indices where exercises[exercise].sets[set].id == setId {
                exercises[exercise].sets[set].done = true
                exercises[exercise].sets[set].reps = reps
                exercises[exercise].sets[set].weightKg = weight
                owner = exercise
            }
        }
        guard let owner else { return (false, nil) }
        let order = Array(owner..<exercises.count) + Array(0..<owner)
        for index in order {
            guard let set = exercises[index].sets.indices.first(where: { !exercises[index].sets[$0].done }) else {
                continue
            }
            exercises[index].sets[set].reps = reps
            exercises[index].sets[set].weightKg = weight
            return (true, index)
        }
        return (true, nil)
    }
}

@available(iOS 16.2, *)
enum LiveWorkoutQueue {
    private static let lock = NSLock()
    private static var posting = Set<String>()

    static func enqueue(setId: String, reps: Int, weight: Double) {
        guard !setId.isEmpty else { return }
        lock.withLock {
            var logs = LiveWorkoutStore.pendingLogs()
            logs.removeAll { $0.setId == setId }
            logs.append(PendingLiveLog(setId: setId, reps: reps, weightKg: weight))
            LiveWorkoutStore.savePendingLogs(logs)
        }
    }

    static func remove(setId: String) {
        lock.withLock {
            var logs = LiveWorkoutStore.pendingLogs()
            logs.removeAll { $0.setId == setId }
            LiveWorkoutStore.savePendingLogs(logs)
            posting.remove(setId)
        }
    }

    /// Starts the save without waiting. The request is not tied to the button's task.
    static func scheduleFlush() {
        for log in LiveWorkoutStore.pendingLogs() {
            let busy = lock.withLock { () -> Bool in
                if posting.contains(log.setId) { return true }
                posting.insert(log.setId)
                return false
            }
            if busy { continue }
            post(log, retry: true)
        }
    }

    static func flush() async {
        for log in LiveWorkoutStore.pendingLogs() {
            do {
                try await LiveWorkoutAPI.logSet(setId: log.setId, reps: log.reps, weight: log.weightKg)
                remove(setId: log.setId)
            } catch LiveWorkoutError.signedOut {
                continue
            } catch let LiveWorkoutError.message(text) where text == "Couldn't reach RUTINA." {
                continue
            } catch is LiveWorkoutError {
                remove(setId: log.setId)
            } catch {
                continue
            }
        }
    }

    private static func post(_ log: PendingLiveLog, retry: Bool) {
        guard let request = LiveWorkoutAPI.logSetRequest(setId: log.setId, reps: log.reps, weight: log.weightKg) else {
            clearPosting(log.setId)
            return
        }
        URLSession.shared.dataTask(with: request) { _, response, error in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if error != nil || status >= 500 || status == 0 {
                clearPosting(log.setId)
                return
            }
            if status == 401, retry {
                Task {
                    let refreshed = await LiveWorkoutAPI.refreshTokens()
                    if refreshed {
                        post(log, retry: false)
                    } else {
                        clearPosting(log.setId)
                    }
                }
                return
            }
            if (200..<300).contains(status) || (400..<500).contains(status) {
                remove(setId: log.setId)
                return
            }
            clearPosting(log.setId)
        }.resume()
    }

    private static func clearPosting(_ setId: String) {
        lock.withLock {
            posting.remove(setId)
        }
    }
}

@available(iOS 16.2, *)
struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable, Sendable {
        var exerciseName: String
        var setLabel: String
        var reps: Int
        var weightKg: Double
        var setId: String
        var exerciseIndex: Int
        var exerciseCount: Int
        var imageToken: Int
        var restSeconds: Int
        var restEndsAt: Date?

        var isResting: Bool {
            guard let restEndsAt else { return false }
            return restEndsAt.timeIntervalSinceNow > 0
        }

        init(
            exerciseName: String,
            setLabel: String,
            reps: Int,
            weightKg: Double,
            setId: String,
            exerciseIndex: Int,
            exerciseCount: Int,
            imageToken: Int,
            restSeconds: Int = 90,
            restEndsAt: Date? = nil
        ) {
            self.exerciseName = exerciseName
            self.setLabel = setLabel
            self.reps = reps
            self.weightKg = weightKg
            self.setId = setId
            self.exerciseIndex = exerciseIndex
            self.exerciseCount = exerciseCount
            self.imageToken = imageToken
            self.restSeconds = restSeconds
            self.restEndsAt = restEndsAt
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            exerciseName = try container.decode(String.self, forKey: .exerciseName)
            setLabel = try container.decode(String.self, forKey: .setLabel)
            reps = try container.decode(Int.self, forKey: .reps)
            weightKg = try container.decode(Double.self, forKey: .weightKg)
            setId = try container.decode(String.self, forKey: .setId)
            exerciseIndex = try container.decode(Int.self, forKey: .exerciseIndex)
            exerciseCount = try container.decode(Int.self, forKey: .exerciseCount)
            imageToken = try container.decode(Int.self, forKey: .imageToken)
            restSeconds = try container.decodeIfPresent(Int.self, forKey: .restSeconds) ?? 90
            restEndsAt = try container.decodeIfPresent(Date.self, forKey: .restEndsAt)
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(exerciseName, forKey: .exerciseName)
            try container.encode(setLabel, forKey: .setLabel)
            try container.encode(reps, forKey: .reps)
            try container.encode(weightKg, forKey: .weightKg)
            try container.encode(setId, forKey: .setId)
            try container.encode(exerciseIndex, forKey: .exerciseIndex)
            try container.encode(exerciseCount, forKey: .exerciseCount)
            try container.encode(imageToken, forKey: .imageToken)
            try container.encode(restSeconds, forKey: .restSeconds)
            try container.encodeIfPresent(restEndsAt, forKey: .restEndsAt)
        }

        private enum CodingKeys: String, CodingKey {
            case exerciseName, setLabel, reps, weightKg, setId
            case exerciseIndex, exerciseCount, imageToken, restSeconds, restEndsAt
        }
    }

    var title: String
}

@available(iOS 16.2, *)
enum LiveRestClock {
    private static var pending: DispatchWorkItem?

    static func arm(until end: Date) {
        cancel()
        let item = DispatchWorkItem {
            Task { await LiveWorkoutSync.finishRest(expectedEnd: end) }
        }
        pending = item
        DispatchQueue.global(qos: .userInitiated).asyncAfter(
            deadline: .now() + max(0, end.timeIntervalSinceNow),
            execute: item
        )
    }

    static func cancel() {
        pending?.cancel()
        pending = nil
    }
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

    static func logSetRequest(setId: String, reps: Int, weight: Double) -> URLRequest? {
        guard let credentials = LiveCredentials(LiveWorkoutStore.credentials()) else { return nil }
        return try? makeRequest(credentials, body: [
            "action": "workout.logSet",
            "date": dateKey(),
            "setId": setId,
            "reps": reps,
            "weightKg": weight
        ])
    }

    static func refreshTokens() async -> Bool {
        guard let credentials = LiveCredentials(LiveWorkoutStore.credentials()) else { return false }
        return await refresh(credentials)
    }

    private static func dateKey() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private static func makeRequest(_ credentials: LiveCredentials, body: [String: Any]) throws -> URLRequest {
        guard let url = URL(string: "\(credentials.apiBase)/api/watch") else {
            throw LiveWorkoutError.message("Missing server address.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(credentials.accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return request
    }

    private static func post(_ body: [String: Any], retry: Bool = true) async throws -> LiveEnvelope {
        guard let credentials = LiveCredentials(LiveWorkoutStore.credentials()) else {
            throw LiveWorkoutError.signedOut
        }
        let request = try makeRequest(credentials, body: body)

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
    /// Latest numbers from a Lock Screen tap. Activity content lags behind the tap.
    private static var pending: WorkoutActivityAttributes.ContentState?

    static func remember(_ state: WorkoutActivityAttributes.ContentState) {
        pending = state
    }
    /// Serializes card paints. The button intent must not await them: the widget
    /// is the process drawing the card, so waiting deadlocks for about a second.
    private static let publishLock = NSLock()
    private static var publishChain: Task<Void, Never> = Task {}

    static func state(
        name: String,
        setNumber: Int,
        setCount: Int,
        reps: Int,
        weightKg: Double,
        setId: String,
        exerciseIndex: Int,
        exerciseCount: Int,
        imageToken: Int,
        restSeconds: Int = 90
    ) -> WorkoutActivityAttributes.ContentState {
        WorkoutActivityAttributes.ContentState(
            exerciseName: name,
            setLabel: LiveWorkoutFormatting.setLabel(number: setNumber, count: setCount),
            reps: min(40, max(1, reps)),
            weightKg: min(200, max(0, (weightKg * 10).rounded() / 10)),
            setId: setId,
            exerciseIndex: exerciseIndex,
            exerciseCount: max(exerciseCount, 1),
            imageToken: imageToken,
            restSeconds: min(600, max(0, restSeconds))
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

    static func update(_ state: WorkoutActivityAttributes.ContentState) async {
        guard LiveWorkoutStore.isLive else { return }
        pending = state
        await publish(state)
        LiveWorkoutStore.saveDraft(
            index: state.exerciseIndex,
            setId: state.setId,
            reps: state.reps,
            weight: state.weightKg
        )
    }

    /// Lock Screen edits schedule the card update and return. Awaiting it here
    /// deadlocks the widget until the system gives up, about a second later.
    static func pushLocal(_ state: WorkoutActivityAttributes.ContentState) async {
        let shouldPaint = enqueue(state)
        guard shouldPaint else { return }
        LiveWorkoutStore.revision += 1
        LiveWorkoutStore.saveDraft(
            index: state.exerciseIndex,
            setId: state.setId,
            reps: state.reps,
            weight: state.weightKg
        )
    }

    private static func enqueue(_ state: WorkoutActivityAttributes.ContentState) -> Bool {
        publishLock.lock()
        defer { publishLock.unlock() }
        if pending == state { return false }
        pending = state
        let previous = publishChain
        publishChain = Task.detached(priority: .userInitiated) {
            _ = await previous.value
            await publish(state)
        }
        return true
    }

    private static func publish(_ state: WorkoutActivityAttributes.ContentState) async {
        let content = ActivityContent(state: state, staleDate: state.isResting ? state.restEndsAt : nil)
        for activity in Activity<WorkoutActivityAttributes>.activities {
            await activity.update(content)
        }
    }

    @MainActor
    static func endAll() async {
        if LiveWorkoutStore.isLive {
            LiveWorkoutStore.cancelSync()
        }
        let generation = LiveWorkoutStore.syncGeneration
        guard !LiveWorkoutStore.isLive, LiveWorkoutStore.syncGeneration == generation else { return }
        pending = nil
        LiveWorkoutStore.clearDraft()
        LiveWorkoutStore.board = nil
        LiveWorkoutStore.revision = 0
        LiveRestClock.cancel()
        await dismissAll(unlessGenerationChangesFrom: generation)
    }

    /// Removes a card left behind after the workout already ended.
    @MainActor
    static func endIfInactive() async {
        let generation = LiveWorkoutStore.syncGeneration
        guard LiveWorkoutStore.liveFlag == false else { return }
        await dismissAll(unlessGenerationChangesFrom: generation)
    }

    @MainActor
    private static func dismissAll(unlessGenerationChangesFrom generation: Int? = nil) async {
        for activity in Activity<WorkoutActivityAttributes>.activities {
            if let generation, LiveWorkoutStore.syncGeneration != generation || LiveWorkoutStore.isLive {
                return
            }
            await activity.end(activity.content, dismissalPolicy: .immediate)
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

    static func adjust(repsDelta: Int, weightDelta: Double) async {
        if pending == nil {
            pending = Activity<WorkoutActivityAttributes>.activities.first?.content.state
        }
        publishLock.lock()
        guard var state = pending, !state.isResting else {
            publishLock.unlock()
            return
        }
        if repsDelta != 0 {
            state.reps = min(40, max(1, state.reps + repsDelta))
        }
        if weightDelta != 0 {
            let next = min(200, max(0, state.weightKg + weightDelta))
            state.weightKg = (next * 10).rounded() / 10
        }
        let previous = publishChain
        pending = state
        let snapshot = state
        publishChain = Task.detached(priority: .userInitiated) {
            _ = await previous.value
            await publish(snapshot)
        }
        publishLock.unlock()
        LiveWorkoutStore.revision += 1
        LiveWorkoutStore.saveDraft(
            index: snapshot.exerciseIndex,
            setId: snapshot.setId,
            reps: snapshot.reps,
            weight: snapshot.weightKg
        )
        if var board = LiveWorkoutStore.board, board.write(setId: snapshot.setId, reps: snapshot.reps, weight: snapshot.weightKg) {
            LiveWorkoutStore.board = board
        }
    }

    static func logCurrent() async {
        guard let state = pending ?? Activity<WorkoutActivityAttributes>.activities.first?.content.state,
              !state.setId.isEmpty,
              !state.isResting else { return }
        LiveWorkoutQueue.enqueue(setId: state.setId, reps: state.reps, weight: state.weightKg)
        LiveWorkoutQueue.scheduleFlush()
        if var board = LiveWorkoutStore.board {
            let rest = min(600, max(0, board.restSeconds(for: state.setId)))
            let logged = board.complete(setId: state.setId, reps: state.reps, weight: state.weightKg)
            if logged.found {
                LiveWorkoutStore.board = board
                if let nextIndex = logged.nextIndex,
                   var next = board.contentState(index: nextIndex, imageToken: state.imageToken) {
                    if rest > 0 {
                        next.restSeconds = rest
                        next.restEndsAt = Date().addingTimeInterval(TimeInterval(rest))
                        if let end = next.restEndsAt {
                            LiveRestClock.arm(until: end)
                        }
                    }
                    await pushLocal(next)
                } else {
                    LiveRestClock.cancel()
                    await endAll()
                }
                return
            }
        }
        Task {
            do {
                try await LiveWorkoutAPI.logSet(setId: state.setId, reps: state.reps, weight: state.weightKg)
                LiveWorkoutQueue.remove(setId: state.setId)
                let live = try await LiveWorkoutAPI.live(exerciseIndex: state.exerciseIndex, advance: true)
                await apply(live)
            } catch {
                // The queued log is retried when the app opens.
            }
        }
    }

    static func skipRest() async {
        LiveRestClock.cancel()
        guard var state = Activity<WorkoutActivityAttributes>.activities.first?.content.state,
              state.restEndsAt != nil else { return }
        state.restEndsAt = nil
        await pushLocal(state)
    }

    static func finishRest(expectedEnd: Date) async {
        guard var state = Activity<WorkoutActivityAttributes>.activities.first?.content.state,
              let current = state.restEndsAt,
              abs(current.timeIntervalSince(expectedEnd)) < 1 else { return }
        state.restEndsAt = nil
        LiveRestClock.cancel()
        await pushLocal(state)
    }
}

#if WIDGET_EXTENSION
@available(iOS 16.2, *)
struct AdjustRepsIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Change reps"
    static var openAppWhenRun = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    @Parameter(title: "Change") var delta: Int

    init() { delta = 0 }
    init(delta: Int) { self.delta = delta }

    func perform() async throws -> some IntentResult {
        await LiveWorkoutSync.adjust(repsDelta: delta, weightDelta: 0)
        return .result()
    }
}

@available(iOS 16.2, *)
struct AdjustWeightIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Change weight"
    static var openAppWhenRun = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    @Parameter(title: "Tenths of a kilogram") var tenths: Int

    init() { tenths = 0 }
    init(tenths: Int) { self.tenths = tenths }

    func perform() async throws -> some IntentResult {
        await LiveWorkoutSync.adjust(repsDelta: 0, weightDelta: Double(tenths) / 10)
        return .result()
    }
}

@available(iOS 16.2, *)
struct LogLiveSetIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Log set"
    static var openAppWhenRun = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    func perform() async throws -> some IntentResult {
        await LiveWorkoutSync.logCurrent()
        return .result()
    }
}

@available(iOS 16.2, *)
struct SkipLiveRestIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Skip rest"
    static var openAppWhenRun = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    func perform() async throws -> some IntentResult {
        await LiveWorkoutSync.skipRest()
        return .result()
    }
}
#endif

import SwiftUI
import HealthKit

@MainActor
final class WatchDashboardModel: ObservableObject {
    static weak var current: WatchDashboardModel?

    @Published var today: WatchToday?
    @Published var steps: Int?
    @Published var moveKcal: Int?
    @Published var moveKm: Double?
    @Published var moveHeart: Int?
    @Published var stepHours: [Int] = Array(repeating: 0, count: 24)
    @Published var error: String?
    @Published var notice: String?
    @Published var busy = false
    @Published var fetchedAt = Date()
    @Published var mirrorGeneration = 0
    @Published var mirrorAction = ""
    @Published var remoteStamp = 0
    /// Mirror fields stay unpublished. Publishing them on every tap rebuilt the
    /// whole watch UI mid-gesture and crashed the set screen.
    var liveIndex = 0
    var liveReps = 8
    var liveWeight = 20.0
    var liveSetId = ""

    private var lastMirrorSeq = 0
    private var lastSentKey = ""
    private var echoing = false
    private var mirrorTask: Task<Void, Never>?
    private var localEditAt = Date.distantPast

    init() {
        WatchDashboardModel.current = self
    }

    private let health = HKHealthStore()

    var dateKey: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    var cardioElapsed: Int {
        cardioElapsed(at: Date())
    }

    func cardioElapsed(at moment: Date) -> Int {
        guard let cardio = today?.cardio else { return 0 }
        guard cardio.status == "running" else { return cardio.elapsedSeconds }
        return cardio.elapsedSeconds + max(0, Int(moment.timeIntervalSince(fetchedAt)))
    }

    @Published var hiitIndex = 0
    @Published var hiitRunning = false
    @Published var hiitLeft = 0
    private var hiitEndsAt: Date?
    private var hiitPausedLeft = 0
    private var hiitBeepSecond: Int?
    private var hiitTicker: Timer?

    var hiitPhases: [WatchHiitPhase] { today?.workout.phases ?? [] }

    /// When this phase began, so the demo can stay on the same beat as the countdown.
    var hiitPhaseStart: Date? {
        guard hiitPhases.indices.contains(hiitIndex), let end = hiitEndsAt else { return nil }
        return end.addingTimeInterval(-TimeInterval(max(hiitPhases[hiitIndex].seconds, 1)))
    }

    func startHiit() {
        let phases = hiitPhases
        guard let first = phases.first else { return }
        hiitIndex = 0
        hiitRunning = true
        hiitPausedLeft = first.seconds
        hiitEndsAt = Date().addingTimeInterval(TimeInterval(first.seconds))
        hiitLeft = first.seconds
        hiitBeepSecond = nil
        WatchTone.prepare()
        WatchTone.playStart()
        armHiitTicker()
        broadcast("hiit")
        if today?.workout.status != "in_progress" {
            Task { await startWorkout() }
        }
    }

    func pauseHiit() {
        hiitPausedLeft = hiitRemaining()
        hiitLeft = hiitPausedLeft
        hiitRunning = false
        hiitEndsAt = nil
        broadcast("hiit")
    }

    func endHiit() {
        hiitRunning = false
        hiitEndsAt = nil
        hiitLeft = 0
        hiitPausedLeft = 0
        hiitTicker?.invalidate()
        hiitTicker = nil
    }

    func resumeHiit() {
        let left = max(hiitPausedLeft, 1)
        hiitRunning = true
        hiitEndsAt = Date().addingTimeInterval(TimeInterval(left))
        hiitLeft = left
        hiitBeepSecond = nil
        WatchTone.prepare()
        armHiitTicker()
        broadcast("hiit")
    }

    func skipHiit() {
        advanceHiit()
    }

    private func armHiitTicker() {
        hiitTicker?.invalidate()
        let timer = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.tickHiit()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        hiitTicker = timer
    }

    private func hiitRemaining(at now: Date = Date()) -> Int {
        if hiitRunning, let end = hiitEndsAt {
            return max(0, Int(ceil(end.timeIntervalSince(now))))
        }
        return hiitPausedLeft
    }

    private func tickHiit() {
        guard hiitRunning, let end = hiitEndsAt else { return }
        let now = Date()
        let left = hiitRemaining(at: now)
        if hiitLeft != left { hiitLeft = left }
        if left <= 5 && left >= 1 && hiitBeepSecond != left {
            hiitBeepSecond = left
            WatchTone.tick(left)
        }
        if now >= end {
            advanceHiit()
        }
    }

    private func advanceHiit() {
        let phases = hiitPhases
        let next = hiitIndex + 1
        hiitBeepSecond = nil
        guard next < phases.count else {
            hiitRunning = false
            hiitEndsAt = nil
            hiitLeft = 0
            hiitTicker?.invalidate()
            WatchTone.playDone()
            return
        }
        hiitIndex = next
        let seconds = max(phases[next].seconds, 1)
        hiitPausedLeft = seconds
        hiitLeft = seconds
        if hiitRunning {
            hiitEndsAt = Date().addingTimeInterval(TimeInterval(seconds))
        }
        WatchTone.playPhase(phases[next].type)
        broadcast("hiit")
    }

    /// Starts the session on the watch and tells the iPhone immediately.
    func beginFromWatch() {
        if hiitPhases.isEmpty {
            Task { await startWorkout() }
        } else {
            startHiit()
        }
        broadcast("start")
    }

    func noteSet(index: Int, setId: String, reps: Int, weight: Double) {
        let same = liveIndex == index
            && liveSetId == setId
            && liveReps == reps
            && abs(liveWeight - weight) < 0.05
        localEditAt = Date()
        liveIndex = index
        liveSetId = setId
        liveReps = reps
        liveWeight = weight
        guard !same else { return }
        let key = mirrorKey(action: "move")
        guard key != lastSentKey else { return }
        mirrorTask?.cancel()
        mirrorTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(160))
            guard !Task.isCancelled else { return }
            self?.broadcast("move")
        }
    }

    func applyMirror(_ payload: [String: Any]) {
        guard payload["origin"] as? String == "phone" else { return }
        let seq = Self.mirrorInt(payload["seq"])
        if seq > 0, seq <= lastMirrorSeq { return }
        if seq > 0 { lastMirrorSeq = seq }
        let action = payload["action"] as? String ?? "move"
        echoing = true
        defer { echoing = false }

        if action == "move" || action == "log" {
            let nextIndex = Self.mirrorInt(payload["exerciseIndex"], fallback: liveIndex)
            let nextReps = max(1, Self.mirrorInt(payload["reps"], fallback: liveReps))
            let nextWeight = Self.mirrorDouble(payload["weightKg"], fallback: liveWeight)
            let nextSetId = (payload["setId"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? liveSetId
            let echoingOwnEdit = action == "move"
                && Date().timeIntervalSince(localEditAt) < 1.5
                && nextIndex == liveIndex
                && nextSetId == liveSetId
            if echoingOwnEdit {
                lastSentKey = mirrorKey(action: action)
                return
            }
            let changed = nextIndex != liveIndex
                || nextReps != liveReps
                || abs(nextWeight - liveWeight) > 0.05
                || nextSetId != liveSetId
            liveIndex = nextIndex
            liveReps = nextReps
            liveWeight = nextWeight
            liveSetId = nextSetId
            if changed { remoteStamp += 1 }
        }
        lastSentKey = mirrorKey(action: action)

        if payload["mode"] as? String == "hiit" || action == "hiit" {
            let index = Self.mirrorInt(payload["hiitIndex"])
            let running = (payload["hiitRunning"] as? Bool) ?? (payload["hiitRunning"] as? NSNumber)?.boolValue ?? false
            let left = Self.mirrorInt(payload["hiitLeft"])
            let ends = Self.mirrorDouble(payload["hiitEndsAt"])
            if hiitPhases.indices.contains(index) || action == "start" {
                hiitIndex = index
                hiitRunning = running
                hiitLeft = left
                hiitPausedLeft = left
                hiitBeepSecond = nil
                if running, ends > 0 {
                    hiitEndsAt = Date(timeIntervalSince1970: ends)
                    armHiitTicker()
                } else {
                    hiitEndsAt = nil
                }
            }
        }

        mirrorAction = action
        mirrorGeneration += 1

        if action == "cancel" {
            endHiit()
            Task { await refresh() }
        } else if action == "start" || action == "log" {
            Task { await refresh() }
        }
    }

    private func broadcast(_ action: String) {
        guard !echoing else { return }
        let key = mirrorKey(action: action)
        if action == "move", key == lastSentKey { return }
        lastSentKey = key
        var payload: [String: Any] = [
            "status": action == "cancel" ? "idle" : "live",
            "mode": hiitPhases.isEmpty ? "strength" : "hiit",
            "action": action,
            "exerciseIndex": liveIndex,
            "setId": liveSetId,
            "reps": liveReps,
            "weightKg": liveWeight,
            "hiitIndex": hiitIndex,
            "hiitRunning": hiitRunning,
            "hiitLeft": hiitRunning ? hiitRemaining() : hiitLeft,
            "hiitEndsAt": hiitEndsAt?.timeIntervalSince1970 ?? 0,
            "sessionId": today?.workout.sessionId ?? ""
        ]
        payload["channel"] = "workout"
        WatchSessionBridge.shared.sendWorkout(payload)
    }

    private func mirrorKey(action: String) -> String {
        let weight = String(format: "%.1f", liveWeight)
        return "\(action)|\(liveIndex)|\(liveSetId)|\(liveReps)|\(weight)|\(hiitIndex)|\(hiitRunning)|\(hiitLeft)"
    }

    private static func mirrorInt(_ value: Any?, fallback: Int = 0) -> Int {
        if let number = value as? Int { return number }
        if let number = value as? Double { return Int(number.rounded()) }
        if let number = value as? NSNumber { return number.intValue }
        return fallback
    }

    private static func mirrorDouble(_ value: Any?, fallback: Double = 0) -> Double {
        if let number = value as? Double { return number }
        if let number = value as? Int { return Double(number) }
        if let number = value as? NSNumber { return number.doubleValue }
        return fallback
    }

    func refresh() async {
        await run {
            let today = try await WatchAPI.today(date: dateKey)
            self.today = today
            self.fetchedAt = Date()
        }
        await loadSteps()
    }

    func addWater(_ amount: Int) async {
        if var today {
            today.water.ml = max(0, today.water.ml + amount)
            self.today = today
        }
        await mutate("water.add", extra: ["amount": amount])
    }

    func startWorkout() async {
        if var today, today.workout.status != "in_progress" {
            today.workout.status = "in_progress"
            self.today = today
        }
        await mutate("workout.start")
    }

    func cancelWorkout() async {
        broadcast("cancel")
        endHiit()
        await mutate("workout.cancel")
    }

    func restartWorkout() async {
        await cancelWorkout()
        await startWorkout()
    }

    func logSet(setId: String, reps: Int, weight: Double) async {
        liveSetId = setId
        liveReps = reps
        liveWeight = weight
        markSetDone(setId, reps: reps, weight: weight)
        broadcast("log")
        await mutate("workout.logSet", extra: [
            "setId": setId,
            "reps": reps,
            "weightKg": weight
        ])
    }

    func startCardio() async {
        patchCardio(status: "running")
        await mutate("cardio.start")
    }

    func pauseCardio() async {
        patchCardio(status: "paused")
        await mutate("cardio.pause")
    }

    func resetCardio() async {
        patchCardio(status: "idle", reset: true)
        await mutate("cardio.reset")
    }

    func stopCardio() async {
        await pauseCardio()
    }

    private func patchCardio(status: String, reset: Bool = false) {
        guard var today else { return }
        var cardio = today.cardio
        if reset {
            cardio.status = "idle"
            cardio.elapsedSeconds = 0
            cardio.completed = false
        } else if status == "paused" {
            cardio.elapsedSeconds = cardioElapsed
            cardio.status = "paused"
        } else if status == "running" {
            if cardio.status != "running" {
                cardio.elapsedSeconds = cardio.status == "paused" ? cardioElapsed : cardio.elapsedSeconds
            }
            cardio.status = "running"
            cardio.completed = false
        }
        today.cardio = cardio
        self.today = today
        self.fetchedAt = Date()
    }

    private func markSetDone(_ setId: String, reps: Int, weight: Double) {
        guard var today else { return }
        guard let index = today.workout.exercises.firstIndex(where: { exercise in
            exercise.openSetId == setId || exercise.sets.contains(where: { $0.id == setId })
        }) else { return }
        var exercise = today.workout.exercises[index]
        if let setIndex = exercise.sets.firstIndex(where: { $0.id == setId }) {
            exercise.sets[setIndex].done = true
        }
        let done = exercise.sets.filter(\.done).count
        exercise.completedSets = max(exercise.completedSets, done)
        if let next = exercise.sets.first(where: { !$0.done }) {
            exercise.openSetId = next.id
            exercise.openSetNumber = next.number
        } else {
            exercise.openSetId = nil
            exercise.openSetNumber = nil
            exercise.completedSets = max(exercise.completedSets, exercise.setCount)
        }
        exercise.lastReps = reps
        exercise.lastWeightKg = weight
        today.workout.exercises[index] = exercise
        self.today = today
    }

    private func mutate(_ action: String, extra: [String: Any] = [:]) async {
        await run {
            let response = try await WatchAPI.perform(action, date: dateKey, extra: extra)
            if let today = response.today {
                self.today = today
                self.fetchedAt = Date()
            }
            self.notice = response.message
        }
    }

    private func run(_ work: () async throws -> Void) async {
        busy = true
        error = nil
        notice = nil
        defer { busy = false }
        do {
            try await work()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadSteps() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        // Heart rate is disallowed here. Requesting it throws and closes the app on launch.
        let stepType = HKObjectType.quantityType(forIdentifier: .stepCount)
        let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)
        let distanceType = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)
        let readTypes = [stepType, energyType, distanceType].compactMap { $0 }
        guard !readTypes.isEmpty else { return }

        let allowed = await withCheckedContinuation { continuation in
            health.requestAuthorization(toShare: [], read: Set(readTypes)) { granted, _ in
                continuation.resume(returning: granted)
            }
        }
        guard allowed else { return }

        let start = Calendar.current.startOfDay(for: Date())
        guard
            let end = Calendar.current.date(byAdding: .day, value: 1, to: start),
            let stepType,
            let energyType,
            let distanceType
        else { return }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)

        async let stepCount = cumulative(stepType, unit: .count(), predicate: predicate)
        async let hours = hourlySteps(stepType, start: start, end: end, predicate: predicate)
        async let energy = cumulative(energyType, unit: .kilocalorie(), predicate: predicate)
        async let distance = cumulative(distanceType, unit: .meter(), predicate: predicate)

        steps = Int((await stepCount).rounded())
        stepHours = await hours
        moveKcal = Int((await energy).rounded())
        moveKm = await distance / 1000
    }

    private func cumulative(_ type: HKQuantityType, unit: HKUnit, predicate: NSPredicate) async -> Double {
        await withCheckedContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, _ in
                continuation.resume(returning: result?.sumQuantity()?.doubleValue(for: unit) ?? 0)
            }
            health.execute(query)
        }
    }

    private func hourlySteps(
        _ type: HKQuantityType,
        start: Date,
        end: Date,
        predicate: NSPredicate
    ) async -> [Int] {
        await withCheckedContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: start,
                intervalComponents: DateComponents(hour: 1)
            )
            query.initialResultsHandler = { _, collection, _ in
                var hours = Array(repeating: 0, count: 24)
                collection?.enumerateStatistics(from: start, to: end) { stats, _ in
                    let hour = Calendar.current.component(.hour, from: stats.startDate)
                    let value = Int((stats.sumQuantity()?.doubleValue(for: .count()) ?? 0).rounded())
                    if hours.indices.contains(hour) { hours[hour] = value }
                }
                continuation.resume(returning: hours)
            }
            health.execute(query)
        }
    }
}

/// Ticks inside the cardio screens only, and only while the session is running.
final class SecondClock: ObservableObject {
    @Published var now = Date()
    private var timer: Timer?

    func setRunning(_ running: Bool) {
        guard running else {
            timer?.invalidate()
            timer = nil
            return
        }
        guard timer == nil else { return }
        now = Date()
        let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
            self?.now = Date()
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    deinit {
        timer?.invalidate()
    }
}

enum WatchTheme {
    static let red = Color(red: 220 / 255, green: 38 / 255, blue: 38 / 255)
    static let ink = Color.black
    static let card = Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)
    static let mute = Color.white.opacity(0.48)
    static let nutrition = Color(red: 52 / 255, green: 211 / 255, blue: 153 / 255)
    static let water = Color(red: 56 / 255, green: 189 / 255, blue: 248 / 255)
    static let cardio = Color(red: 251 / 255, green: 146 / 255, blue: 60 / 255)
    static let steps = Color(red: 163 / 255, green: 230 / 255, blue: 53 / 255)
    static let protein = Color(red: 244 / 255, green: 63 / 255, blue: 94 / 255)
    static let carbs = Color(red: 251 / 255, green: 191 / 255, blue: 36 / 255)
    static let fat = Color(red: 34 / 255, green: 197 / 255, blue: 94 / 255)
    static let kcal = Color(red: 249 / 255, green: 115 / 255, blue: 22 / 255)

    static func clock(_ seconds: Int) -> String {
        let safe = max(0, seconds)
        return String(format: "%d:%02d", safe / 60, safe % 60)
    }

    static func fraction(_ value: Double, _ total: Double) -> Double {
        guard total > 0 else { return 0 }
        return min(1, max(0, value / total))
    }

    static func milliliters(_ ml: Int) -> String {
        "\(ml.formatted()) ml"
    }

    static func liters(_ ml: Int) -> String {
        let tenths = (Double(ml) / 100).rounded() / 10
        if abs(tenths - tenths.rounded()) < 0.001 {
            return String(Int(tenths.rounded()))
        }
        return String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), tenths)
    }

    static func volume(_ ml: Int, of goal: Int) -> String {
        if max(ml, goal) >= 1000 {
            return "\(liters(ml)) / \(liters(goal)) L"
        }
        return "\(ml.formatted()) / \(goal.formatted()) ml"
    }
}

struct WatchRing: View {
    var progress: Double
    var size: CGFloat = 46
    var tint: Color = WatchTheme.red
    var glow = false

    private var line: CGFloat { max(6, size * 0.13) }

    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.18), lineWidth: line)
            Circle()
                .trim(from: 0, to: WatchTheme.fraction(progress, 1))
                .stroke(tint, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: glow ? tint.opacity(0.9) : .clear, radius: glow ? 7 : 0)
        }
        .frame(width: size, height: size)
    }
}

struct WatchMeter: View {
    var progress: Double
    var tint: Color

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width * WatchTheme.fraction(progress, 1)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.12))
                Capsule()
                    .fill(tint)
                    .frame(width: progress > 0 ? max(5, width) : 0)
            }
        }
        .frame(height: 5)
    }
}

struct WatchAction: View {
    var title: String
    var symbol: String? = nil
    var fill: Color = WatchTheme.red
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let symbol {
                    Image(systemName: symbol)
                        .font(.system(size: 13, weight: .bold))
                }
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(Capsule().fill(fill))
        }
        .buttonStyle(.plain)
    }
}

struct WatchHeader: View {
    @Environment(\.dismiss) private var dismiss
    var title: String
    var back = false
    var onTitle: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 2) {
            if back {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.backward")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(WatchTheme.red)
                        .frame(width: 22, height: 26)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            titleLabel
            Spacer(minLength: 36)
        }
    }

    @ViewBuilder
    private var titleLabel: some View {
        if let onTitle {
            Button(action: onTitle) { titleText }
                .buttonStyle(.plain)
        } else {
            titleText
        }
    }

    private var titleText: some View {
        Text(title)
            .font(.system(size: 18, weight: .bold))
            .foregroundStyle(WatchTheme.red)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }
}

private struct WatchChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 3)
            .padding(.top, 10)
            .padding(.bottom, 2)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .ignoresSafeArea(edges: .top)
            .toolbar(.hidden, for: .navigationBar)
            .navigationBarBackButtonHidden(true)
            .containerBackground(WatchTheme.ink, for: .navigation)
    }
}

extension View {
    func watchChrome() -> some View {
        modifier(WatchChrome())
    }

    func watchCard(_ radius: CGFloat = 16) -> some View {
        background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(WatchTheme.card)
        )
    }
}

private struct MetricTile: View {
    var title: String
    var value: String
    var symbol: String
    var tint: Color
    var progress: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 5) {
                Image(systemName: symbol)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(tint)
                    .frame(width: 16)
                VStack(alignment: .leading, spacing: 0) {
                    Text(title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text(value)
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.white.opacity(0.7))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                Spacer(minLength: 0)
            }
            Spacer(minLength: 5)
            WatchMeter(progress: progress, tint: tint)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .watchCard(14)
    }
}

private struct CardioDashTile: View {
    @EnvironmentObject private var model: WatchDashboardModel
    @StateObject private var clock = SecondClock()

    private var cardio: WatchCardio? { model.today?.cardio }
    private var running: Bool { cardio?.status == "running" }

    private var elapsed: Int {
        let base = cardio?.elapsedSeconds ?? 0
        guard running else { return base }
        return base + max(0, Int(clock.now.timeIntervalSince(model.fetchedAt)))
    }

    private var value: String {
        if cardio == nil || cardio?.status == "none" { return "Rest" }
        if cardio?.completed == true || cardio?.status == "completed" { return "Done" }
        let minutes = elapsed / 60
        if let planned = cardio?.plannedMinutes, planned > 0 {
            return "\(minutes) / \(planned) min"
        }
        return "\(minutes) min"
    }

    private var progress: Double {
        if cardio?.completed == true || cardio?.status == "completed" { return 1 }
        let planned = Double(cardio?.plannedMinutes ?? 0)
        guard planned > 0 else { return 0 }
        return WatchTheme.fraction(Double(elapsed) / 60, planned)
    }

    var body: some View {
        MetricTile(
            title: "Cardio",
            value: value,
            symbol: "heart.fill",
            tint: WatchTheme.cardio,
            progress: progress
        )
        .onAppear { clock.setRunning(running) }
        .onChange(of: running) { _, isRunning in
            clock.setRunning(isRunning)
        }
    }
}

struct DashboardView: View {
    @EnvironmentObject private var session: WatchSessionBridge
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 6) {
                WatchHeader(title: "Rutina") {
                    Task { await model.refresh() }
                }
                if let alert = alertLine {
                    Text(alert)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(WatchTheme.red)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                destination { WorkoutWatchView() } label: { workoutCard }
                VStack(spacing: 6) {
                    HStack(spacing: 6) {
                        destination(fills: true) { NutritionWatchView() } label: { nutritionTile }
                        destination(fills: true) { WaterWatchView() } label: { waterTile }
                    }
                    HStack(spacing: 6) {
                        destination(fills: true) { StepsWatchView() } label: { stepsTile }
                        destination(fills: true) { CardioWatchView() } label: { CardioDashTile() }
                    }
                }
                .frame(maxHeight: .infinity)
            }
            .watchChrome()
        }
        .tint(WatchTheme.red)
    }

    private var workoutCard: some View {
        let running = model.today?.workout.status == "in_progress" || model.hiitRunning
        return HStack(spacing: 8) {
            Image(systemName: "dumbbell.fill")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(WatchTheme.red)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 1) {
                Text("Today's Workout")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(workoutTitle)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.72))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(workoutMeta)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.5))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer(minLength: 2)
            ZStack {
                Circle()
                    .fill(WatchTheme.red.opacity(0.28))
                    .frame(width: 40, height: 40)
                Circle()
                    .fill(WatchTheme.red)
                    .frame(width: 30, height: 30)
                    .shadow(color: WatchTheme.red.opacity(0.7), radius: 5)
                Image(systemName: running ? "pause.fill" : "play.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .offset(x: running ? 0 : 1)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .watchCard(16)
    }

    private var nutritionTile: some View {
        let nutrition = model.today?.nutrition
        let calories = nutrition?.calories ?? 0
        let target = nutrition?.targetCalories ?? 0
        return MetricTile(
            title: "Nutrition",
            value: "\(calories.formatted()) kcal",
            symbol: "flame.fill",
            tint: WatchTheme.nutrition,
            progress: WatchTheme.fraction(Double(calories), Double(max(target, 1)))
        )
    }

    private var waterTile: some View {
        let water = model.today?.water
        let ml = water?.ml ?? 0
        let goal = water?.goalMl ?? 0
        return MetricTile(
            title: "Water",
            value: WatchTheme.volume(ml, of: goal),
            symbol: "drop.fill",
            tint: WatchTheme.water,
            progress: WatchTheme.fraction(Double(ml), Double(max(goal, 1)))
        )
    }

    private var stepsTile: some View {
        let steps = model.steps ?? 0
        let goal = model.today?.steps.goal ?? 10000
        return MetricTile(
            title: "Steps",
            value: steps.formatted(),
            symbol: "shoeprints.fill",
            tint: WatchTheme.steps,
            progress: WatchTheme.fraction(Double(steps), Double(max(goal, 1)))
        )
    }

    private var workoutTitle: String {
        guard let workout = model.today?.workout, workout.status != "none" else { return "Rest day" }
        if let title = workout.title, !title.isEmpty { return title }
        return "Workout"
    }

    private var workoutMeta: String {
        guard let workout = model.today?.workout, workout.status != "none" else { return "Nothing scheduled" }
        if workoutFinished { return "Done" }
        if workout.status == "in_progress" || model.hiitRunning { return "In progress" }
        let count = workout.phases.isEmpty ? workout.exercises.count : workout.phases.count
        if count == 1 { return "1 exercise" }
        if count > 1 { return "\(count) exercises" }
        return "Ready"
    }

    private var workoutFinished: Bool {
        guard let workout = model.today?.workout, workout.status != "none" else { return false }
        if workout.status == "completed" { return true }
        let exercises = workout.exercises
        return !exercises.isEmpty && exercises.allSatisfy { exercise in
            exercise.setCount > 0 && exercise.openSetId == nil && exercise.completedSets >= exercise.setCount
        }
    }

    private var alertLine: String? {
        if session.credentials?.isUsable != true { return "Open iPhone to sign in" }
        if let error = model.error, !error.isEmpty { return error }
        if let notice = model.notice, !notice.isEmpty { return notice }
        return nil
    }

    private func destination<Destination: View, Label: View>(
        fills: Bool = false,
        @ViewBuilder _ destination: () -> Destination,
        @ViewBuilder label: () -> Label
    ) -> some View {
        NavigationLink(destination: destination, label: label)
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity, maxHeight: fills ? .infinity : nil)
            .disabled(session.credentials?.isUsable != true)
            .opacity(session.credentials?.isUsable == true ? 1 : 0.45)
    }
}

struct NutritionWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let nutrition = model.today?.nutrition
        VStack(spacing: 8) {
            WatchHeader(title: "Nutrition", back: true)
            ScrollView {
                VStack(spacing: 8) {
                    HStack(alignment: .center, spacing: 6) {
                        calorieRing(nutrition)
                        VStack(spacing: 7) {
                            macroLine(
                                "Protein",
                                nutrition?.protein,
                                nutrition?.targetProtein,
                                "fish.fill",
                                WatchTheme.protein
                            )
                            macroLine(
                                "Carbs",
                                nutrition?.carbs,
                                nutrition?.targetCarbs,
                                "leaf.fill",
                                WatchTheme.carbs
                            )
                            macroLine(
                                "Fats",
                                nutrition?.fat,
                                nutrition?.targetFat,
                                "drop.fill",
                                WatchTheme.fat
                            )
                        }
                    }
                    .padding(8)
                    .watchCard(16)

                    HStack {
                        Text("Today's Meals")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        Spacer()
                        Text("\((nutrition?.meals.count ?? 0))")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundStyle(WatchTheme.mute)
                    }
                    .padding(.horizontal, 2)
                    meals(nutrition?.meals ?? [])
                    if let error = model.error {
                        Text(error)
                            .font(.system(size: 10))
                            .foregroundStyle(WatchTheme.red)
                            .lineLimit(2)
                    }
                }
                .padding(.bottom, 8)
            }
            .scrollIndicators(.hidden)
        }
        .watchChrome()
    }

    private func calorieRing(_ nutrition: WatchNutrition?) -> some View {
        let current = nutrition?.calories ?? 0
        let goal = nutrition?.targetCalories ?? 0
        return ZStack {
            WatchRing(
                progress: WatchTheme.fraction(Double(current), Double(max(goal, 1))),
                size: 92,
                tint: WatchTheme.kcal,
                glow: true
            )
            VStack(spacing: 0) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(WatchTheme.kcal)
                Text(current.formatted())
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                Text("/ \(goal.formatted())")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(WatchTheme.mute)
                    .lineLimit(1)
                Text("kcal")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(WatchTheme.mute)
            }
            .padding(.horizontal, 16)
        }
        .frame(width: 92, height: 92)
    }

    private func macroLine(_ title: String, _ value: Int?, _ target: Int?, _ symbol: String, _ tint: Color) -> some View {
        let current = value ?? 0
        let goal = target ?? 0
        return VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: symbol)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(tint)
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            Text("\(current) / \(goal) g")
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundStyle(Color.white.opacity(0.62))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            WatchMeter(progress: WatchTheme.fraction(Double(current), Double(max(goal, 1))), tint: tint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func meals(_ meals: [WatchMeal]) -> some View {
        VStack(spacing: 6) {
            if meals.isEmpty {
                Text("No meals yet")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(WatchTheme.mute)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .watchCard(14)
            } else {
                ForEach(meals) { meal in
                    HStack(spacing: 8) {
                        Image(systemName: "fork.knife")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(WatchTheme.kcal)
                            .frame(width: 28, height: 28)
                            .background(Circle().fill(WatchTheme.kcal.opacity(0.16)))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(meal.name)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Text("\(meal.calories.formatted()) kcal")
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundStyle(WatchTheme.mute)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 7)
                    .watchCard(14)
                }
            }
        }
    }
}

struct StepsWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let goal = model.today?.steps.goal ?? 10000
        let steps = model.steps ?? 0
        let progress = WatchTheme.fraction(Double(steps), Double(max(goal, 1)))
        VStack(spacing: 6) {
            WatchHeader(title: "Steps", back: true)
            ScrollView {
                VStack(spacing: 6) {
                    HStack(alignment: .center, spacing: 6) {
                        ZStack {
                            WatchRing(progress: progress, size: 108, tint: WatchTheme.steps, glow: true)
                            VStack(spacing: 0) {
                                Image(systemName: "shoeprints.fill")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(WatchTheme.steps)
                                Text(steps.formatted())
                                    .font(.system(size: 18, weight: .bold, design: .rounded))
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.5)
                                Text("/ \(goal.formatted())")
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundStyle(WatchTheme.mute)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.6)
                                Text("steps")
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundStyle(WatchTheme.mute)
                            }
                            .padding(.horizontal, 18)
                        }
                        .frame(width: 108, height: 108)
                        VStack(spacing: 4) {
                            MoveStat(
                                symbol: "flame.fill",
                                value: model.moveKcal?.formatted() ?? "—",
                                unit: "kcal",
                                tint: WatchTheme.kcal
                            )
                            MoveStat(
                                symbol: "mappin",
                                value: kmText,
                                unit: "km",
                                tint: WatchTheme.steps
                            )
                            MoveStat(
                                symbol: "chart.bar.fill",
                                value: "\(Int((progress * 100).rounded()))%",
                                unit: "of goal",
                                tint: WatchTheme.steps
                            )
                        }
                    }
                    StepDayChart(hours: model.stepHours, tint: WatchTheme.steps)
                    HStack(spacing: 8) {
                        Image(systemName: "shoeprints.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(WatchTheme.steps)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Daily Goal")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(.white)
                            Text("\(goal.formatted()) steps")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(WatchTheme.mute)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 8)
                    .watchCard(14)
                }
                .padding(.bottom, 8)
            }
            .scrollIndicators(.hidden)
        }
        .watchChrome()
    }

    private var kmText: String {
        guard let km = model.moveKm else { return "—" }
        return String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), km)
    }
}

private struct MoveStat: View {
    var symbol: String
    var value: String
    var unit: String
    var tint: Color

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: 12)
            VStack(alignment: .leading, spacing: 0) {
                Text(value)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(unit)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(WatchTheme.mute)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 5)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .watchCard(10)
    }
}

private struct StepDayChart: View {
    var hours: [Int]
    var tint: Color

    var body: some View {
        let peak = max(hours.max() ?? 0, 1)
        VStack(alignment: .leading, spacing: 5) {
            Text("Today")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.82))
            HStack(alignment: .bottom, spacing: 1.5) {
                ForEach(0..<24, id: \.self) { hour in
                    let value = hours.indices.contains(hour) ? hours[hour] : 0
                    RoundedRectangle(cornerRadius: 1.2, style: .continuous)
                        .fill(value > 0 ? tint : Color.white.opacity(0.16))
                        .frame(height: value > 0 ? max(3, 32 * CGFloat(value) / CGFloat(peak)) : 2)
                        .frame(maxWidth: .infinity, maxHeight: 32, alignment: .bottom)
                }
            }
            .frame(height: 32)
            HStack {
                Text("00")
                Spacer()
                Text("06")
                Spacer()
                Text("12")
                Spacer()
                Text("18")
                Spacer()
                Text("24")
            }
            .font(.system(size: 8, weight: .medium))
            .foregroundStyle(Color.white.opacity(0.4))
        }
        .padding(8)
        .watchCard(14)
    }
}

struct WaterWatchView: View {
    @EnvironmentObject private var session: WatchSessionBridge
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let water = model.today?.water
        let ml = water?.ml ?? 0
        let goal = max(water?.goalMl ?? 2500, 1)
        GeometryReader { geo in
            let ring = min(geo.size.width * 0.72, geo.size.height * 0.58)
            VStack(spacing: 8) {
                WatchHeader(title: "Water", back: true)
                Spacer(minLength: 0)
                ZStack {
                    WatchRing(
                        progress: WatchTheme.fraction(Double(ml), Double(goal)),
                        size: ring,
                        tint: WatchTheme.water,
                        glow: true
                    )
                    VStack(spacing: 0) {
                        Image(systemName: "drop.fill")
                            .font(.system(size: ring * 0.16, weight: .bold))
                            .foregroundStyle(WatchTheme.water)
                        Text(ml.formatted())
                            .font(.system(size: ring * 0.24, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                        Text("/ \(goal.formatted()) ml")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(WatchTheme.mute)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                    .padding(.horizontal, ring * 0.18)
                }
                Spacer(minLength: 0)
                HStack(spacing: 6) {
                    addButton("+250 ml", 250)
                    addButton("+500 ml", 500)
                }
                if let error = model.error {
                    Text(error)
                        .font(.system(size: 10))
                        .foregroundStyle(WatchTheme.red)
                        .lineLimit(1)
                }
            }
        }
        .watchChrome()
    }

    private func addButton(_ title: String, _ amount: Int) -> some View {
        Button {
            Task { await model.addWater(amount) }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "drop.fill")
                    .font(.system(size: 11, weight: .bold))
                Text(title)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .foregroundStyle(WatchTheme.water)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(WatchTheme.water.opacity(0.16))
            )
        }
        .buttonStyle(.plain)
        .disabled(session.credentials?.isUsable != true)
    }
}

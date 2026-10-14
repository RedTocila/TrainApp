import SwiftUI
import HealthKit

@MainActor
final class WatchDashboardModel: ObservableObject {
    static weak var current: WatchDashboardModel?

    @Published var today: WatchToday?
    @Published var steps: Int?
    @Published var error: String?
    @Published var notice: String?
    @Published var busy = false
    @Published var fetchedAt = Date()
    @Published var mirrorGeneration = 0
    @Published var mirrorAction = ""
    @Published var remoteStamp = 0
    @Published var liveIndex = 0
    @Published var liveReps = 8
    @Published var liveWeight = 20.0
    @Published var liveSetId = ""

    private var lastMirrorSeq = 0
    private var lastSentKey = ""
    private var echoing = false
    private var mirrorTask: Task<Void, Never>?

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
        guard let cardio = today?.cardio else { return 0 }
        guard cardio.status == "running" else { return cardio.elapsedSeconds }
        return cardio.elapsedSeconds + Int(Date().timeIntervalSince(fetchedAt))
    }

    @Published var hiitIndex = 0
    @Published var hiitRunning = false
    @Published var hiitLeft = 0
    private var hiitEndsAt: Date?
    private var hiitPausedLeft = 0
    private var hiitBeepSecond: Int?
    private var hiitTicker: Timer?

    var hiitPhases: [WatchHiitPhase] { today?.workout.phases ?? [] }

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
        hiitTicker = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.tickHiit()
            }
        }
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
        liveIndex = index
        liveSetId = setId
        liveReps = reps
        liveWeight = weight
        let key = mirrorKey(action: "move")
        guard key != lastSentKey else { return }
        mirrorTask?.cancel()
        mirrorTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(90))
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
            liveIndex = Self.mirrorInt(payload["exerciseIndex"], fallback: liveIndex)
            liveReps = max(1, Self.mirrorInt(payload["reps"], fallback: liveReps))
            liveWeight = Self.mirrorDouble(payload["weightKg"], fallback: liveWeight)
            if let setId = payload["setId"] as? String, !setId.isEmpty {
                liveSetId = setId
            }
            remoteStamp += 1
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
        guard HKHealthStore.isHealthDataAvailable(),
              let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            return
        }
        let allowed = await withCheckedContinuation { continuation in
            health.requestAuthorization(toShare: [], read: [stepType]) { granted, _ in
                continuation.resume(returning: granted)
            }
        }
        guard allowed else { return }

        let start = Calendar.current.startOfDay(for: Date())
        guard let end = Calendar.current.date(byAdding: .day, value: 1, to: start) else { return }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let steps: Int = await withCheckedContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, _ in
                let value = result?.sumQuantity()?.doubleValue(for: .count()) ?? 0
                continuation.resume(returning: Int(value.rounded()))
            }
            health.execute(query)
        }
        self.steps = steps
    }
}

enum WatchTheme {
    static let red = Color(red: 220 / 255, green: 38 / 255, blue: 38 / 255)
    static let ink = Color(red: 12 / 255, green: 12 / 255, blue: 14 / 255)
    static let mute = Color.white.opacity(0.48)
    static let nutrition = Color(red: 52 / 255, green: 211 / 255, blue: 153 / 255)
    static let water = Color(red: 56 / 255, green: 189 / 255, blue: 248 / 255)
    static let cardio = Color(red: 251 / 255, green: 146 / 255, blue: 60 / 255)
    static let steps = Color(red: 163 / 255, green: 230 / 255, blue: 53 / 255)
    static let protein = Color(red: 244 / 255, green: 63 / 255, blue: 94 / 255)
    static let carbs = Color(red: 251 / 255, green: 191 / 255, blue: 36 / 255)
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
}

struct WatchRing: View {
    var progress: Double
    var size: CGFloat = 46
    var tint: Color = WatchTheme.red

    /// Same share of the diameter on every ring, close to Apple Fitness rings.
    private var line: CGFloat { max(6, size * 0.14) }

    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.22), lineWidth: line)
            Circle()
                .trim(from: 0, to: WatchTheme.fraction(progress, 1))
                .stroke(tint, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: size, height: size)
    }
}

struct WatchAction: View {
    var title: String
    var fill: Color = WatchTheme.red
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Capsule().fill(fill))
        }
        .buttonStyle(.plain)
    }
}

private struct DashCard<Content: View>: View {
    var accent: Color
    var done = false
    var tracked = true
    var square = false
    @ViewBuilder var content: () -> Content

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: square ? 18 : 16, style: .continuous)
        ZStack(alignment: .topTrailing) {
            shape.fill(Color(red: 0.06, green: 0.06, blue: 0.07))
            shape.fill(
                LinearGradient(
                    colors: [accent.opacity(0.78), accent.opacity(0.22)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            shape.stroke(accent.opacity(done ? 1 : 0.72), lineWidth: 1.5)
            content()
                .frame(
                    maxWidth: .infinity,
                    maxHeight: square ? .infinity : nil,
                    alignment: square ? .center : .leading
                )
                .padding(.horizontal, square ? 6 : 10)
                .padding(.vertical, square ? 8 : 10)
            if tracked && done {
                Image(systemName: "checkmark")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(.white)
                    .padding(7)
            }
        }
        .frame(maxWidth: .infinity, minHeight: square ? nil : 62)
        .aspectRatio(square ? 1 : nil, contentMode: .fit)
    }
}

private struct DashLabel: View {
    var title: String
    var detail: String
    var symbol: String
    var accent: Color

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 36, height: 36)
                .background(Circle().fill(Color.black.opacity(0.28)))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(detail)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.78))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
        }
    }
}

private enum DashRoute: Hashable {
    case workout, nutrition, water, cardio, steps
}

private struct DeckItem: Identifiable {
    var id: DashRoute
    var title: String
    var detail: String
    var symbol: String
    var accent: Color
    var onLight = false
}

private struct FocusDeck: View {
    var items: [DeckItem]
    var enabled: Bool
    var onOpen: (DeckItem) -> Void
    @State private var focus: Double = 0
    @State private var dragBase: Double = 0
    @State private var dragging = false

    var body: some View {
        GeometryReader { geo in
            let count = max(items.count, 1)
            let large = geo.size.height * 0.62
            let small = max(58, geo.size.height * 0.3)
            let spacing: CGFloat = 8
            let heights: [CGFloat] = items.indices.map { index in
                let delta = min(1, abs(Double(index) - focus))
                return small + (large - small) * CGFloat(1 - delta)
            }
            let offset: CGFloat = {
                let base = min(max(Int(floor(focus)), 0), max(items.count - 1, 0))
                let frac = CGFloat(focus - Double(base))
                var y: CGFloat = 0
                if base > 0 {
                    for index in 0..<base where index < heights.count {
                        y += heights[index] + spacing
                    }
                }
                if base < heights.count {
                    y += frac * (heights[base] + spacing)
                }
                return y
            }()

            VStack(spacing: spacing) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    DeckCard(item: item, focused: abs(Double(index) - focus) < 0.42) {
                        onOpen(item)
                    }
                    .frame(height: heights[index])
                }
            }
            .offset(y: -offset)
            .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
            .clipped()
            .simultaneousGesture(
                DragGesture(minimumDistance: 12)
                    .onChanged { value in
                        if !dragging {
                            dragging = true
                            dragBase = focus
                        }
                        let travel = max(large * 0.72, 70)
                        let next = dragBase - Double(value.translation.height / travel)
                        focus = min(Double(count - 1), max(0, next))
                    }
                    .onEnded { value in
                        dragging = false
                        let flick = Double(value.predictedEndTranslation.height - value.translation.height) / 500
                        let snapped = min(Double(count - 1), max(0, (focus - flick).rounded()))
                        withAnimation(.spring(response: 0.34, dampingFraction: 0.86)) {
                            focus = snapped
                        }
                    }
            )
            .focusable(true)
            .digitalCrownRotation(
                $focus,
                from: 0,
                through: Double(max(items.count - 1, 0)),
                by: 0.01,
                sensitivity: .medium,
                isContinuous: false,
                isHapticFeedbackEnabled: true
            )
        }
        .opacity(enabled ? 1 : 0.45)
    }
}

private struct DeckCard: View {
    var item: DeckItem
    var focused: Bool
    var action: () -> Void

    var body: some View {
        let ink: Color = item.onLight ? Color(red: 0.09, green: 0.11, blue: 0.06) : .white
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [item.accent, item.accent.opacity(0.78)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                VStack(alignment: .leading, spacing: focused ? 5 : 2) {
                    Image(systemName: item.symbol)
                        .font(.system(size: focused ? 28 : 18, weight: .bold))
                        .foregroundStyle(ink)
                    Spacer(minLength: 0)
                    Text(item.title)
                        .font(.system(size: focused ? 20 : 15, weight: .bold))
                        .foregroundStyle(ink)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    Text(item.detail)
                        .font(.system(size: focused ? 13 : 11, weight: .semibold))
                        .foregroundStyle(ink.opacity(0.9))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .padding(.horizontal, focused ? 12 : 9)
                .padding(.vertical, focused ? 12 : 8)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

                Image(systemName: "ellipsis")
                    .font(.system(size: focused ? 13 : 11, weight: .black))
                    .foregroundStyle(item.accent)
                    .frame(width: focused ? 28 : 22, height: focused ? 28 : 22)
                    .background(Circle().fill(ink.opacity(0.94)))
                    .padding(8)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct StartCountdown: View {
    var title: String
    var symbol: String
    var accent: Color
    var value: Int

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Image(systemName: symbol)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(accent)
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(accent.opacity(0.2)))
                Spacer(minLength: 0)
            }
            Spacer(minLength: 0)
            ZStack {
                Circle().stroke(accent.opacity(0.22), lineWidth: 12)
                Circle()
                    .trim(from: 0, to: CGFloat(max(value, 0)) / 3)
                    .stroke(accent, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 0.85), value: value)
                Text("\(max(value, 1))")
                    .font(.system(size: 58, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 14)
            .aspectRatio(1, contentMode: .fit)
            Spacer(minLength: 0)
            Text(title)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.75)
        }
        .padding(.horizontal, 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WatchTheme.ink)
    }
}

struct DashboardView: View {
    @EnvironmentObject private var session: WatchSessionBridge
    @EnvironmentObject private var model: WatchDashboardModel
    @State private var route: DashRoute?
    @State private var countdown: Int?

    var body: some View {
        NavigationStack {
            ZStack {
                VStack(spacing: 2) {
                    header
                    FocusDeck(items: deckItems, enabled: session.credentials?.isUsable == true, onOpen: open)
                        .frame(maxHeight: .infinity)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                if let countdown {
                    StartCountdown(
                        title: model.today?.workout.title ?? "Workout",
                        symbol: (model.today?.workout.phases.isEmpty == false) ? "timer" : "dumbbell.fill",
                        accent: WatchTheme.red,
                        value: countdown
                    )
                    .transition(.opacity)
                }
            }
            .padding(.horizontal, 2)
            .toolbar(.hidden, for: .navigationBar)
            .containerBackground(WatchTheme.ink, for: .navigation)
            .navigationDestination(item: $route) { dest in
                switch dest {
                case .workout:
                    WorkoutWatchView()
                case .nutrition:
                    NutritionWatchView()
                case .water:
                    WaterWatchView()
                case .cardio:
                    CardioWatchView()
                case .steps:
                    StepsWatchView()
                }
            }
        }
        .tint(WatchTheme.red)
        .onChange(of: model.mirrorGeneration) { _, _ in
            if model.mirrorAction == "cancel", route == .workout {
                countdown = nil
                route = nil
            } else if model.mirrorAction == "start" {
                countdown = nil
                route = .workout
            }
        }
        .task(id: countdown) {
            guard let countdown else { return }
            WatchTone.prepare()
            WatchTone.countdown(countdown)
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled, self.countdown == countdown else { return }
            if countdown <= 1 {
                self.countdown = nil
                route = .workout
                model.beginFromWatch()
            } else {
                self.countdown = countdown - 1
            }
        }
    }

    private var deckItems: [DeckItem] {
        let water = model.today?.water
        return [
            DeckItem(id: .workout, title: "Workout", detail: workoutDetail, symbol: "dumbbell.fill", accent: WatchTheme.red),
            DeckItem(id: .nutrition, title: "Nutrition", detail: nutritionDetail, symbol: "fork.knife", accent: WatchTheme.nutrition),
            DeckItem(id: .water, title: "Water", detail: WatchTheme.milliliters(water?.ml ?? 0), symbol: "drop.fill", accent: WatchTheme.water),
            DeckItem(id: .cardio, title: "Cardio", detail: cardioDetail, symbol: "figure.run", accent: WatchTheme.cardio),
            DeckItem(id: .steps, title: "Steps", detail: stepsDetail, symbol: "shoeprints.fill", accent: WatchTheme.steps, onLight: true)
        ]
    }

    private func open(_ item: DeckItem) {
        guard session.credentials?.isUsable == true else { return }
        if item.id == .workout, model.today?.workout.status == "scheduled" {
            countdown = 3
            return
        }
        route = item.id
    }

    private var workoutState: (tracked: Bool, done: Bool) {
        guard let workout = model.today?.workout, workout.status != "none" else {
            return (false, false)
        }
        let exercises = workout.exercises
        let setsDone = !exercises.isEmpty && exercises.allSatisfy { exercise in
            exercise.setCount > 0 && exercise.openSetId == nil && exercise.completedSets >= exercise.setCount
        }
        return (true, workout.status == "completed" || setsDone)
    }

    private var nutritionDone: Bool {
        guard let nutrition = model.today?.nutrition else { return false }
        return macroHit(nutrition.calories, nutrition.targetCalories, calorie: true, floor: 0)
            && macroHit(nutrition.protein, nutrition.targetProtein, calorie: false, floor: 5)
            && macroHit(nutrition.carbs, nutrition.targetCarbs, calorie: false, floor: 10)
            && macroHit(nutrition.fat, nutrition.targetFat, calorie: false, floor: 5)
    }

    private var cardioState: (tracked: Bool, done: Bool) {
        guard let cardio = model.today?.cardio else { return (false, false) }
        let done = cardio.completed || cardio.status == "completed"
        if cardio.status == "none" && !done { return (false, false) }
        return (true, done)
    }

    private var waterDone: Bool {
        let water = model.today?.water
        let goal = water?.goalMl ?? 0
        guard goal > 0 else { return true }
        let band = max(Int((Double(goal) * 0.2).rounded()), 250)
        return (water?.ml ?? 0) >= goal - band
    }

    private var stepsDone: Bool {
        let goal = model.today?.steps.goal ?? 10000
        guard goal > 0 else { return true }
        return (model.steps ?? 0) >= goal
    }

    private func macroHit(_ actual: Int, _ target: Int, calorie: Bool, floor: Int) -> Bool {
        guard target > 0 else { return true }
        let band = calorie ? 300 : max(Int((Double(target) * 0.2).rounded()), floor)
        return actual >= target - band && actual <= target + band
    }

    private var workoutDetail: String {
        guard let workout = model.today?.workout, workout.status != "none" else { return "Rest day" }
        if workout.status == "completed" || workoutState.done { return "Done" }
        if let title = workout.title, !title.isEmpty { return title }
        return workout.status == "in_progress" ? "In progress" : "Ready"
    }

    private var nutritionDetail: String {
        let nutrition = model.today?.nutrition
        let calories = nutrition?.calories ?? 0
        let target = nutrition?.targetCalories ?? 0
        let meals = nutrition?.meals.count ?? 0
        if meals > 0 {
            let mealLine = meals == 1 ? "1 meal" : "\(meals) meals"
            return "\(calories.formatted()) kcal · \(mealLine)"
        }
        return "\(calories.formatted()) / \(target.formatted()) kcal"
    }

    private var cardioDetail: String {
        let cardio = model.today?.cardio
        if cardio?.status == "running" || cardio?.status == "paused" {
            return WatchTheme.clock(model.cardioElapsed)
        }
        if cardio?.completed == true || cardio?.status == "completed" { return "Done" }
        if let minutes = cardio?.plannedMinutes, minutes > 0 { return "\(minutes) min" }
        if cardio?.status == "none" || cardio == nil { return "Rest" }
        return "Ready"
    }

    private var stepsDetail: String {
        let goal = model.today?.steps.goal ?? 10000
        let steps = model.steps ?? 0
        if goal > 0 { return "\(steps.formatted()) / \(goal.formatted())" }
        return steps.formatted()
    }

    private func squareTile(_ title: String, detail: String, symbol: String, accent: Color) -> some View {
        VStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(accent)
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(detail)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.white.opacity(0.82))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.65)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var waterPreview: some View {
        let water = model.today?.water
        let ml = water?.ml ?? 0
        let goal = water?.goalMl ?? 0
        return HStack(spacing: 10) {
            ZStack {
                WatchRing(
                    progress: WatchTheme.fraction(Double(ml), Double(max(goal, 1))),
                    size: 46,
                    tint: WatchTheme.water
                )
                Image(systemName: "drop.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(WatchTheme.water)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Water")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                Text(WatchTheme.milliliters(ml))
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("of \(WatchTheme.milliliters(goal))")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.75))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
        }
    }

    private var header: some View {
        Button {
            Task { await model.refresh() }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text("RUTINA")
                    .font(.system(size: 11, weight: .black))
                    .tracking(1.1)
                    .foregroundStyle(WatchTheme.red)
                Text(statusLine)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(model.error == nil && session.credentials?.isUsable == true ? .white : WatchTheme.red)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }

    private func destination<Destination: View, Label: View>(
        @ViewBuilder _ destination: () -> Destination,
        @ViewBuilder label: () -> Label
    ) -> some View {
        NavigationLink(destination: destination, label: label)
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            .disabled(session.credentials?.isUsable != true)
    }

    private var statusLine: String {
        if session.credentials?.isUsable != true {
            return "Open iPhone to sign in"
        }
        if let error = model.error, !error.isEmpty { return error }
        if let notice = model.notice, !notice.isEmpty { return notice }
        return greeting
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let albanian = model.today?.locale != "en"
        switch hour {
        case 5..<12:
            return albanian ? "Mirë mëngjes" : "Good morning"
        case 12..<18:
            return albanian ? "Mirëdita" : "Good afternoon"
        default:
            return albanian ? "Mirëmbrëma" : "Good evening"
        }
    }
}

struct NutritionWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let nutrition = model.today?.nutrition
        GeometryReader { geo in
            let small = min(CGFloat(54), floor((geo.size.width - 18) / 3))
            let big = min(CGFloat(112), geo.size.width * 0.64)
            ScrollView {
                VStack(spacing: 14) {
                    macroRing(
                        "Kcal",
                        nutrition?.calories,
                        nutrition?.targetCalories,
                        WatchTheme.kcal,
                        unit: "",
                        size: big,
                        valueSize: big * 0.18
                    )
                    HStack(alignment: .top, spacing: 6) {
                        macroRing(
                            "Protein",
                            nutrition?.protein,
                            nutrition?.targetProtein,
                            WatchTheme.protein,
                            unit: "g",
                            size: small,
                            valueSize: small * 0.2
                        )
                        macroRing(
                            "Carbs",
                            nutrition?.carbs,
                            nutrition?.targetCarbs,
                            WatchTheme.carbs,
                            unit: "g",
                            size: small,
                            valueSize: small * 0.2
                        )
                        macroRing(
                            "Fat",
                            nutrition?.fat,
                            nutrition?.targetFat,
                            WatchTheme.water,
                            unit: "g",
                            size: small,
                            valueSize: small * 0.2
                        )
                    }
                    loggedMeals(nutrition?.meals ?? [])
                    note
                }
                .padding(.bottom, 8)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("Nutrition")
        .containerBackground(WatchTheme.ink, for: .navigation)
    }

    private func macroRing(
        _ title: String,
        _ value: Int?,
        _ target: Int?,
        _ tint: Color,
        unit: String,
        size: CGFloat,
        valueSize: CGFloat
    ) -> some View {
        let current = value ?? 0
        let goal = target ?? 0
        let line = max(CGFloat(6), size * 0.14)
        return VStack(spacing: 3) {
            ZStack {
                WatchRing(
                    progress: WatchTheme.fraction(Double(current), Double(max(goal, 1))),
                    size: size,
                    tint: tint
                )
                Text("\(current)")
                    .font(.system(size: valueSize, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .padding(.horizontal, line + 2)
            }
            .frame(width: size, height: size)
            Text(title)
                .font(.system(size: size > 70 ? 12 : 10, weight: .semibold))
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(unit.isEmpty ? "\(goal)" : "\(goal)\(unit)")
                .font(.system(size: size > 70 ? 11 : 9))
                .foregroundStyle(WatchTheme.mute)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
    }

    private func loggedMeals(_ meals: [WatchMeal]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Logged")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(WatchTheme.nutrition)
            if meals.isEmpty {
                Text("No meals yet")
                    .font(.system(size: 12))
                    .foregroundStyle(WatchTheme.mute)
            } else {
                ForEach(meals) { meal in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(WatchTheme.nutrition)
                            .frame(width: 5, height: 5)
                        Text(meal.name)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Text("\(meal.calories)")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundStyle(WatchTheme.mute)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 2)
    }

    private var note: some View {
        Text(model.error ?? model.notice ?? " ")
            .font(.system(size: 10))
            .foregroundStyle(model.error == nil ? WatchTheme.mute : WatchTheme.red)
            .lineLimit(1)
    }
}

struct StepsWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let goal = model.today?.steps.goal ?? 10000
        let steps = model.steps ?? 0
        let progress = WatchTheme.fraction(Double(steps), Double(max(goal, 1)))
        VStack(spacing: 6) {
            Spacer(minLength: 0)
            ZStack {
                WatchRing(progress: progress, size: 112, tint: WatchTheme.steps)
                Image(systemName: "shoeprints.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(WatchTheme.steps)
            }
            Text(steps.formatted())
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
            Text("of \(goal.formatted())")
                .font(.system(size: 12))
                .foregroundStyle(WatchTheme.mute)
            Spacer(minLength: 0)
        }
        .navigationTitle("Steps")
        .containerBackground(WatchTheme.ink, for: .navigation)
    }
}

struct WaterWatchView: View {
    @EnvironmentObject private var session: WatchSessionBridge
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let water = model.today?.water
        let ml = water?.ml ?? 0
        let goal = water?.goalMl ?? 2500
        GeometryReader { geo in
            let ring = min(geo.size.width * 0.58, geo.size.height * 0.46)
            VStack(spacing: 4) {
                ZStack {
                    WatchRing(
                        progress: WatchTheme.fraction(Double(ml), Double(max(goal, 1))),
                        size: ring,
                        tint: WatchTheme.water
                    )
                    Image(systemName: "drop.fill")
                        .font(.system(size: ring * 0.22, weight: .semibold))
                        .foregroundStyle(WatchTheme.water)
                }
                Text(WatchTheme.milliliters(ml))
                    .font(.system(size: min(24, geo.size.height * 0.14), weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text("of \(WatchTheme.milliliters(goal))")
                    .font(.system(size: 12))
                    .foregroundStyle(WatchTheme.mute)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                HStack(spacing: 8) {
                    amount("+250", 250)
                    amount("+500", 500)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .navigationTitle("Water")
        .containerBackground(WatchTheme.ink, for: .navigation)
    }

    private func amount(_ title: String, _ value: Int) -> some View {
        Button {
            Task { await model.addWater(value) }
        } label: {
            Text(title)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Capsule().fill(value < 0 ? Color.white.opacity(0.12) : WatchTheme.water))
        }
        .buttonStyle(.plain)
        .disabled(session.credentials?.isUsable != true)
    }
}


import SwiftUI
import HealthKit

@MainActor
final class WatchDashboardModel: ObservableObject {
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

    private let health = HKHealthStore()
    private var actionToken = 0
    private var pendingLog: (reps: Int, weight: Double)?
    /// Phone start/stop can arrive before the server write is visible.
    private var cardioHeldUntil: Date?

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

    func refresh() async {
        actionToken += 1
        let token = actionToken
        cardioHeldUntil = nil
        busy = true
        error = nil
        notice = nil
        do {
            let today = try await WatchAPI.today(date: dateKey)
            guard token == actionToken else { return }
            self.today = today
            self.fetchedAt = Date()
            self.cardioHeldUntil = nil
        } catch {
            guard token == actionToken else { return }
            self.error = error.localizedDescription
        }
        guard token == actionToken else { return }
        busy = false
        await loadSteps()
    }

    /// Picks up a phone start/stop without blanking the screen.
    func refreshQuiet() async {
        let token = actionToken
        do {
            let next = try await WatchAPI.today(date: dateKey)
            guard token == actionToken else { return }
            applyFetched(next)
        } catch {
            return
        }
    }

    func applyCardioMirror(_ payload: [String: Any]) {
        if payload["origin"] as? String == "watch" { return }
        let status = mirrorString(payload["status"]) ?? "idle"
        let elapsed = mirrorInt(payload["elapsedSeconds"]) ?? 0
        let completed = mirrorBool(payload["completed"]) || status == "completed"
        guard var snapshot = today, snapshot.cardio.status != "none" || snapshot.cardio.id != nil else {
            Task { await refreshQuiet() }
            return
        }
        var cardio = snapshot.cardio
        if let id = mirrorString(payload["cardioId"]) {
            cardio.id = id
        }
        if completed {
            cardio.status = "completed"
            cardio.completed = true
            cardio.elapsedSeconds = max(0, elapsed)
        } else if status == "running" || status == "paused" {
            cardio.status = status
            cardio.completed = false
            cardio.elapsedSeconds = max(0, elapsed)
        } else {
            cardio.status = "idle"
            cardio.completed = false
            cardio.elapsedSeconds = 0
        }
        snapshot.cardio = cardio
        today = snapshot
        fetchedAt = Date()
        cardioHeldUntil = Date().addingTimeInterval(12)
        error = nil
    }

    private func applyFetched(_ next: WatchToday) {
        if let until = cardioHeldUntil, Date() < until, let current = today {
            let agreed =
                next.cardio.status == current.cardio.status &&
                next.cardio.completed == current.cardio.completed
            if agreed || next.cardio.completed {
                today = next
                fetchedAt = Date()
                cardioHeldUntil = nil
                return
            }
            var merged = next
            var cardio = current.cardio
            if cardio.status == "running" {
                cardio.elapsedSeconds = cardioElapsed(at: Date())
            }
            merged.cardio = cardio
            today = merged
            fetchedAt = Date()
            return
        }
        today = next
        fetchedAt = Date()
    }

    private func mirrorString(_ value: Any?) -> String? {
        guard let text = value as? String, !text.isEmpty else { return nil }
        return text
    }

    private func mirrorInt(_ value: Any?) -> Int? {
        if let number = value as? Int { return number }
        if let number = value as? NSNumber { return number.intValue }
        return nil
    }

    private func mirrorBool(_ value: Any?) -> Bool {
        if let flag = value as? Bool { return flag }
        if let number = value as? NSNumber { return number.boolValue }
        return false
    }

    func addWater(_ amount: Int) async {
        await mutate("water.add", extra: ["amount": amount])
    }

    func startWorkout() async {
        actionToken += 1
        let token = actionToken
        beginWorkoutLocally()
        await commit(token) {
            try await WatchAPI.perform("workout.start", date: dateKey)
        }
        guard token == actionToken, let pending = pendingLog else { return }
        pendingLog = nil
        await logSet(reps: pending.reps, weight: pending.weight)
    }

    func cancelWorkout() async {
        actionToken += 1
        let token = actionToken
        pendingLog = nil
        cancelWorkoutLocally()
        await commit(token) {
            try await WatchAPI.perform("workout.cancel", date: dateKey)
        }
    }

    func logSet(reps: Int, weight: Double) async {
        guard let setId = today?.workout.setId else {
            pendingLog = (reps, weight)
            return
        }
        actionToken += 1
        let token = actionToken
        advanceWorkoutLocally(setId: setId, reps: reps, weight: weight)
        await commit(token) {
            try await WatchAPI.perform("workout.logSet", date: dateKey, extra: [
                "setId": setId,
                "reps": reps,
                "weightKg": weight
            ])
        }
    }

    func startCardio() async {
        await mutate("cardio.start")
    }

    func stopCardio() async {
        await mutate("cardio.stop")
    }

    private func mutate(_ action: String, extra: [String: Any] = [:]) async {
        actionToken += 1
        let token = actionToken
        await run {
            let response = try await WatchAPI.perform(action, date: dateKey, extra: extra)
            guard token == self.actionToken else { return }
            if let today = response.today {
                self.cardioHeldUntil = nil
                self.today = today
                self.fetchedAt = Date()
            }
            self.notice = response.message
        }
    }

    private func commit(_ token: Int, _ work: () async throws -> WatchActionResponse) async {
        do {
            let response = try await work()
            guard token == actionToken else { return }
            if let today = response.today {
                cardioHeldUntil = nil
                self.today = today
                self.fetchedAt = Date()
            }
            notice = response.message
            error = nil
        } catch {
            guard token == actionToken else { return }
            self.error = error.localizedDescription
            if let today = try? await WatchAPI.today(date: dateKey), token == actionToken {
                self.today = today
                self.fetchedAt = Date()
            }
        }
    }

    private func beginWorkoutLocally() {
        guard var snapshot = today else { return }
        var workout = snapshot.workout
        workout.status = "in_progress"
        workout.canLogSets = true
        if let first = workout.exercises.first {
            if workout.exerciseName?.isEmpty != false {
                workout.exerciseName = first.name
            }
            if workout.setNumber == nil { workout.setNumber = 1 }
            if workout.targetReps == nil { workout.targetReps = first.targetReps }
        }
        snapshot.workout = workout
        today = snapshot
    }

    private func cancelWorkoutLocally() {
        guard var snapshot = today else { return }
        var workout = snapshot.workout
        workout.status = workout.title == nil ? "none" : "scheduled"
        workout.canLogSets = false
        workout.sessionId = nil
        workout.exerciseName = nil
        workout.setNumber = nil
        workout.setId = nil
        workout.targetReps = nil
        snapshot.workout = workout
        today = snapshot
    }

    private func advanceWorkoutLocally(setId: String, reps: Int, weight: Double) {
        guard var snapshot = today else { return }
        var workout = snapshot.workout
        var exercises = workout.exercises
        var advanced = false
        for index in exercises.indices {
            guard let setIndex = exercises[index].sets.firstIndex(where: { $0.id == setId }) else { continue }
            exercises[index].sets[setIndex].done = true
            exercises[index].completedSets = exercises[index].sets.filter(\.done).count
            exercises[index].lastReps = reps
            exercises[index].lastWeightKg = weight
            if let next = exercises[index].sets.first(where: { !$0.done }) {
                exercises[index].openSetId = next.id
                exercises[index].openSetNumber = next.number
            } else {
                exercises[index].openSetId = nil
                exercises[index].openSetNumber = nil
            }
            advanced = true
            break
        }
        guard advanced else { return }
        workout.exercises = exercises
        if let next = exercises.first(where: { $0.openSetId != nil }) {
            workout.status = "in_progress"
            workout.canLogSets = true
            workout.exerciseName = next.name
            workout.setNumber = next.openSetNumber
            workout.setId = next.openSetId
            workout.targetReps = next.targetReps
        } else {
            workout.status = "completed"
            workout.canLogSets = false
            workout.setId = nil
            workout.exerciseName = nil
            workout.setNumber = nil
        }
        snapshot.workout = workout
        today = snapshot
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
            let gate = WatchResumeOnce<Bool>()
            health.requestAuthorization(toShare: [], read: Set(readTypes)) { granted, _ in
                gate.resume(continuation, returning: granted)
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
            let gate = WatchResumeOnce<Double>()
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, result, _ in
                gate.resume(continuation, returning: result?.sumQuantity()?.doubleValue(for: unit) ?? 0)
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
            let gate = WatchResumeOnce<[Int]>()
            query.initialResultsHandler = { _, collection, _ in
                var hours = Array(repeating: 0, count: 24)
                collection?.enumerateStatistics(from: start, to: end) { stats, _ in
                    let hour = Calendar.current.component(.hour, from: stats.startDate)
                    let value = Int((stats.sumQuantity()?.doubleValue(for: .count()) ?? 0).rounded())
                    if hours.indices.contains(hour) { hours[hour] = value }
                }
                gate.resume(continuation, returning: hours)
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

struct WatchScreenInset {
    var top: CGFloat
    var bottom: CGFloat
    var side: CGFloat
}

enum WatchTheme {
    static let red = Color(red: 220 / 255, green: 38 / 255, blue: 38 / 255)
    static let crown = Color(red: 48 / 255, green: 209 / 255, blue: 88 / 255)
    static let gap: CGFloat = 7
    static let ink = Color.black
    static let card = Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)
    static let mute = Color.white.opacity(0.48)
    static let nutrition = Color(red: 52 / 255, green: 211 / 255, blue: 153 / 255)
    static let water = Color(red: 56 / 255, green: 189 / 255, blue: 248 / 255)
    static let cardio = Color(red: 251 / 255, green: 146 / 255, blue: 60 / 255)
    static let steps = Color(red: 163 / 255, green: 230 / 255, blue: 53 / 255)
    static let protein = Color(red: 244 / 255, green: 63 / 255, blue: 94 / 255)
    static let carbs = Color(red: 251 / 255, green: 191 / 255, blue: 36 / 255)
    static let fat = Color(red: 14 / 255, green: 165 / 255, blue: 233 / 255)
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

    /// Clears the rounded bezel without leaving a band of empty screen.
    static func screenInset(for size: CGSize) -> WatchScreenInset {
        let radius = min(size.width, size.height) * 0.22
        return WatchScreenInset(
            top: max(18, radius * 0.5),
            bottom: max(12, radius * 0.34),
            side: max(10, radius * 0.26)
        )
    }
}

struct WatchRing: View {
    var progress: Double
    var size: CGFloat = 46
    var tint: Color = WatchTheme.red

    private var line: CGFloat { min(9, max(5, size * 0.1)) }

    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.18), lineWidth: line)
            Circle()
                .trim(from: 0, to: WatchTheme.fraction(progress, 1))
                .stroke(tint, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .padding(line / 2)
        .frame(width: size, height: size)
    }
}

private struct MacroArc: Identifiable {
    var id: Int
    var color: Color
    var start: CGFloat
    var end: CGFloat
}

/// One full ring. Protein, carbs, fat, and calories share it as touching colors.
private func macroArcs(calories: Int, target: Int, protein: Int, carbs: Int, fat: Int) -> [MacroArc] {
    _ = target
    let proteinCal = Double(max(protein, 0)) * 4
    let carbsCal = Double(max(carbs, 0)) * 4
    let fatCal = Double(max(fat, 0)) * 9
    let macroSum = proteinCal + carbsCal + fatCal
    guard max(calories, 0) > 0 || macroSum > 0 else { return [] }

    let weights: [(Color, Double)]
    if macroSum <= 0 {
        weights = [(WatchTheme.kcal, 1)]
    } else {
        weights = [
            (WatchTheme.kcal, macroSum * 0.12),
            (WatchTheme.protein, proteinCal),
            (WatchTheme.carbs, carbsCal),
            (WatchTheme.fat, fatCal),
        ].filter { $0.1 > 0 }
    }
    let total = weights.reduce(0) { $0 + $1.1 }
    guard total > 0 else { return [] }

    var cursor = 0.0
    var arcs: [MacroArc] = []
    for (index, item) in weights.enumerated() {
        let length = item.1 / total
        let start = cursor
        cursor += length
        if length > 0.001 {
            arcs.append(MacroArc(id: index, color: item.0, start: CGFloat(start), end: CGFloat(start + length)))
        }
    }
    return arcs
}

struct WatchMacroRing: View {
    var calories: Int
    var target: Int
    var protein: Int
    var carbs: Int
    var fat: Int
    var size: CGFloat

    private var line: CGFloat { min(10, max(6, size * 0.09)) }

    var body: some View {
        let arcs = macroArcs(
            calories: calories,
            target: target,
            protein: protein,
            carbs: carbs,
            fat: fat
        )
        ZStack {
            Circle().stroke(Color.white.opacity(0.12), lineWidth: line)
            if arcs.count == 1, let arc = arcs.first {
                Circle().stroke(arc.color, lineWidth: line)
            } else {
                ForEach(arcs) { arc in
                    Circle()
                        .trim(from: max(0, arc.start - 0.004), to: min(1, arc.end + 0.004))
                        .stroke(arc.color, style: StrokeStyle(lineWidth: line, lineCap: .butt))
                        .rotationEffect(.degrees(-90))
                }
            }
            VStack(spacing: 0) {
                Text(calories.formatted())
                    .font(.system(size: size * 0.22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                Text("kcal")
                    .font(.system(size: max(8, size * 0.09), weight: .semibold))
                    .foregroundStyle(WatchTheme.mute)
                Text("of \(target.formatted())")
                    .font(.system(size: max(8, size * 0.075), weight: .medium))
                    .foregroundStyle(WatchTheme.mute)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }
            .padding(.horizontal, line + 4)
        }
        .padding(line / 2)
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
    var brand = false
    var onRefresh: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 4) {
            if back {
                Button { afterTap { dismiss() } } label: {
                    Image(systemName: "chevron.backward")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 22, height: 26)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            titleText
            if let onRefresh {
                Button { watchAct(onRefresh) } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 22, height: 26)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
        .frame(height: 26)
    }

    private var titleText: some View {
        Group {
            if brand {
                (Text("R").foregroundColor(WatchTheme.red) + Text(String(title.dropFirst())).foregroundColor(.white))
            } else {
                Text(title).foregroundColor(.white)
            }
        }
        .font(.system(size: 17, weight: .bold))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
}

private struct WatchChrome: ViewModifier {
    func body(content: Content) -> some View {
        GeometryReader { geo in
            let inset = WatchTheme.screenInset(for: geo.size)
            content
                .padding(.horizontal, inset.side)
                .padding(.top, inset.top)
                .padding(.bottom, inset.bottom)
                .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
        }
        .ignoresSafeArea()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WatchTheme.ink.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationBarBackButtonHidden(true)
        .persistentSystemOverlays(.hidden)
        .containerBackground(WatchTheme.ink, for: .navigation)
    }
}

/// Runs after the tap has fully ended. watchOS closes the app if a tap updates or removes its own control.
func afterTap(_ action: @escaping () -> Void) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: action)
}

/// Next turn, so the control can change without waiting on the network.
func watchAct(_ action: @escaping () -> Void) {
    DispatchQueue.main.async(execute: action)
}

/// HealthKit and Watch Connectivity callbacks can arrive twice. Resuming a continuation twice is fatal.
final class WatchResumeOnce<T>: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false

    func resume(_ continuation: CheckedContinuation<T, Never>, returning value: T) {
        lock.lock()
        let first = !done
        done = true
        lock.unlock()
        guard first else { return }
        continuation.resume(returning: value)
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

    func watchScroll() -> some View {
        scrollIndicators(.automatic, axes: .vertical)
            .tint(WatchTheme.crown)
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
        .padding(.horizontal, 9)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .watchCard(16)
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
        if cardio?.status == "running" || cardio?.status == "paused" {
            return WatchTheme.clock(elapsed)
        }
        if let planned = cardio?.plannedMinutes, planned > 0 { return "\(planned) min" }
        return "Ready"
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
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var session: WatchSessionBridge
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        NavigationStack {
            VStack(spacing: WatchTheme.gap) {
                WatchHeader(title: "Rutina", brand: true, onRefresh: {
                    Task { await model.refresh() }
                })
                if let alert = alertLine {
                    Text(alert)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(WatchTheme.red)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                destination { WorkoutWatchView() } label: { workoutCard }
                    .frame(height: 58)
                HStack(spacing: WatchTheme.gap) {
                    destination { NutritionWatchView() } label: { nutritionTile }
                    destination { WaterWatchView() } label: { waterTile }
                }
                .frame(maxHeight: .infinity)
                HStack(spacing: WatchTheme.gap) {
                    destination { StepsWatchView() } label: { stepsTile }
                    destination { CardioWatchView() } label: { CardioDashTile() }
                }
                .frame(maxHeight: .infinity)
            }
            .watchChrome()
        }
        .ignoresSafeArea()
        .background(WatchTheme.ink.ignoresSafeArea())
        .tint(WatchTheme.crown)
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await model.refreshQuiet() }
        }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                if Task.isCancelled { break }
                await model.refreshQuiet()
            }
        }
    }

    private var workoutCard: some View {
        let running = model.today?.workout.status == "in_progress"
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
                    .fill(WatchTheme.red)
                    .frame(width: 30, height: 30)
                Image(systemName: running ? "pause.fill" : "play.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .offset(x: running ? 0 : 1)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
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
        if workout.status == "in_progress" { return "In progress" }
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
        @ViewBuilder _ destination: () -> Destination,
        @ViewBuilder label: () -> Label
    ) -> some View {
        NavigationLink(destination: destination) {
            label()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .disabled(session.credentials?.isUsable != true)
        .opacity(session.credentials?.isUsable == true ? 1 : 0.45)
    }
}

private struct ProteinIcon: View {
    var body: some View {
        RutinaStrokeIcon(paths: [
            "M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3",
            "m18.5 6 2.19 4.5a6.48 6.48 0 0 1 .31 2 6.49 6.49 0 0 1-2.6 5.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5",
        ])
    }
}

private struct CarbsIcon: View {
    var body: some View {
        RutinaStrokeIcon(paths: [
            "M2 22 16 8",
            "M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
            "M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
            "M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
            "M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z",
            "M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
            "M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
            "M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
        ])
    }
}

private struct FatIcon: View {
    var body: some View {
        Image(systemName: "drop.fill")
            .font(.system(size: 14, weight: .bold))
    }
}

/// Same stroke icons the phone uses for protein and carbs.
private struct RutinaStrokeIcon: View {
    var paths: [String]

    var body: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 24
            context.scaleBy(x: scale, y: scale)
            let style = StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
            for spec in paths {
                context.stroke(svgPath(spec), with: .foreground, style: style)
            }
        }
    }
}

private func svgPath(_ spec: String) -> Path {
    var path = Path()
    let chars = Array(spec)
    var index = 0
    var command: Character = "M"
    var cx = 0.0
    var cy = 0.0
    var startX = 0.0
    var startY = 0.0
    var lastControl: (Double, Double)?

    func skip() {
        while index < chars.count, chars[index] == "," || chars[index].isWhitespace {
            index += 1
        }
    }

    func number() -> Double? {
        skip()
        guard index < chars.count else { return nil }
        let start = index
        if chars[index] == "+" || chars[index] == "-" { index += 1 }
        var dotted = false
        var digits = false
        while index < chars.count {
            let char = chars[index]
            if char.isNumber {
                digits = true
                index += 1
            } else if char == ".", !dotted {
                dotted = true
                index += 1
            } else {
                break
            }
        }
        guard digits else { return nil }
        return Double(String(chars[start..<index]))
    }

    func point(_ relative: Bool, _ x: Double, _ y: Double) -> CGPoint {
        CGPoint(x: relative ? cx + x : x, y: relative ? cy + y : y)
    }

    while index < chars.count {
        skip()
        if index >= chars.count { break }
        if chars[index].isLetter {
            command = chars[index]
            index += 1
        }
        let relative = command.isLowercase
        switch Character(command.uppercased()) {
        case "M":
            guard let x = number(), let y = number() else { return path }
            let next = point(relative, x, y)
            path.move(to: next)
            cx = next.x
            cy = next.y
            startX = cx
            startY = cy
            command = relative ? "l" : "L"
            lastControl = nil
        case "L":
            guard let x = number(), let y = number() else { return path }
            let next = point(relative, x, y)
            path.addLine(to: next)
            cx = next.x
            cy = next.y
            lastControl = nil
        case "H":
            guard let x = number() else { return path }
            cx = relative ? cx + x : x
            path.addLine(to: CGPoint(x: cx, y: cy))
            lastControl = nil
        case "V":
            guard let y = number() else { return path }
            cy = relative ? cy + y : y
            path.addLine(to: CGPoint(x: cx, y: cy))
            lastControl = nil
        case "C":
            guard let x1 = number(), let y1 = number(), let x2 = number(), let y2 = number(), let x = number(), let y = number() else { return path }
            let control1 = point(relative, x1, y1)
            let control2 = point(relative, x2, y2)
            let next = point(relative, x, y)
            path.addCurve(to: next, control1: control1, control2: control2)
            lastControl = (control2.x, control2.y)
            cx = next.x
            cy = next.y
        case "S":
            guard let x2 = number(), let y2 = number(), let x = number(), let y = number() else { return path }
            let reflected = lastControl.map { CGPoint(x: 2 * cx - $0.0, y: 2 * cy - $0.1) } ?? CGPoint(x: cx, y: cy)
            let control2 = point(relative, x2, y2)
            let next = point(relative, x, y)
            path.addCurve(to: next, control1: reflected, control2: control2)
            lastControl = (control2.x, control2.y)
            cx = next.x
            cy = next.y
        case "A":
            guard let rx = number(), let ry = number(), let _ = number(), let large = number(), let sweep = number(), let x = number(), let y = number() else { return path }
            let next = point(relative, x, y)
            addSVGArc(
                &path,
                from: CGPoint(x: cx, y: cy),
                to: next,
                rx: abs(rx),
                ry: abs(ry),
                large: large != 0,
                sweep: sweep != 0
            )
            cx = next.x
            cy = next.y
            lastControl = nil
        case "Z":
            path.closeSubpath()
            cx = startX
            cy = startY
            lastControl = nil
        default:
            index += 1
        }
    }
    return path
}

private func addSVGArc(
    _ path: inout Path,
    from: CGPoint,
    to: CGPoint,
    rx: Double,
    ry: Double,
    large: Bool,
    sweep: Bool
) {
    if rx == 0 || ry == 0 || from == to {
        path.addLine(to: to)
        return
    }
    let dx = (from.x - to.x) / 2
    let dy = (from.y - to.y) / 2
    var rx = rx
    var ry = ry
    let lambda = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
    if lambda > 1 {
        let scale = sqrt(lambda)
        rx *= scale
        ry *= scale
    }
    let sign: Double = (large == sweep) ? -1 : 1
    let rx2 = rx * rx
    let ry2 = ry * ry
    let factor = max(0, (rx2 * ry2 - rx2 * dy * dy - ry2 * dx * dx) / (rx2 * dy * dy + ry2 * dx * dx))
    let coef = sign * sqrt(factor)
    let cx1 = coef * rx * dy / ry
    let cy1 = coef * -ry * dx / rx
    let centerX = cx1 + (from.x + to.x) / 2
    let centerY = cy1 + (from.y + to.y) / 2
    func angle(_ ux: Double, _ uy: Double, _ vx: Double, _ vy: Double) -> Double {
        let dot = ux * vx + uy * vy
        let length = sqrt(ux * ux + uy * uy) * sqrt(vx * vx + vy * vy)
        var theta = acos(min(1, max(-1, dot / max(length, 0.0001))))
        if ux * vy - uy * vx < 0 { theta = -theta }
        return theta
    }
    let start = angle(1, 0, (from.x - centerX) / rx, (from.y - centerY) / ry)
    var delta = angle((from.x - centerX) / rx, (from.y - centerY) / ry, (to.x - centerX) / rx, (to.y - centerY) / ry)
    if !sweep, delta > 0 { delta -= 2 * .pi }
    if sweep, delta < 0 { delta += 2 * .pi }
    let steps = max(8, Int((abs(delta) / (Double.pi / 8)).rounded(.up)))
    for step in 1...steps {
        let theta = start + delta * Double(step) / Double(steps)
        path.addLine(to: CGPoint(x: centerX + rx * cos(theta), y: centerY + ry * sin(theta)))
    }
}

struct NutritionWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let nutrition = model.today?.nutrition
        GeometryReader { geo in
            let gap = WatchTheme.gap
            let column = min(96, max(72, geo.size.width * 0.44))
            let ring = max(0, min(geo.size.width - column - gap, geo.size.height * 0.48))
            VStack(spacing: gap) {
                WatchHeader(title: "Nutrition", back: true)
                HStack(alignment: .center, spacing: gap) {
                    WatchMacroRing(
                        calories: nutrition?.calories ?? 0,
                        target: nutrition?.targetCalories ?? 0,
                        protein: nutrition?.protein ?? 0,
                        carbs: nutrition?.carbs ?? 0,
                        fat: nutrition?.fat ?? 0,
                        size: ring
                    )
                    VStack(alignment: .leading, spacing: 6) {
                        macroAmount(ProteinIcon(), nutrition?.protein, nutrition?.targetProtein, WatchTheme.protein)
                        macroAmount(CarbsIcon(), nutrition?.carbs, nutrition?.targetCarbs, WatchTheme.carbs)
                        macroAmount(FatIcon(), nutrition?.fat, nutrition?.targetFat, WatchTheme.fat)
                    }
                    .frame(width: column, alignment: .leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                ScrollView {
                    VStack(spacing: gap) {
                        meals(nutrition?.meals ?? [])
                        if let error = model.error {
                            Text(error)
                                .font(.system(size: 10))
                                .foregroundStyle(WatchTheme.red)
                                .lineLimit(2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .contentMargins(0, for: .scrollContent)
                .scrollIndicators(.hidden)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .watchChrome()
    }

    private func macroAmount<Icon: View>(_ icon: Icon, _ value: Int?, _ target: Int?, _ tint: Color) -> some View {
        let current = value ?? 0
        let goal = target ?? 0
        return HStack(alignment: .center, spacing: 5) {
            icon
                .foregroundStyle(tint)
                .frame(width: 16, height: 16)
            VStack(alignment: .leading, spacing: 0) {
                Text("\(current)g")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("of \(goal)")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(WatchTheme.mute)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
        }
    }

    private func meals(_ meals: [WatchMeal]) -> some View {
        VStack(spacing: WatchTheme.gap) {
            if meals.isEmpty {
                Text("No meals yet")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(WatchTheme.mute)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .watchCard(14)
            } else {
                ForEach(Array(meals.enumerated()), id: \.offset) { _, meal in
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
                                .lineLimit(2)
                                .minimumScaleFactor(0.85)
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
        GeometryReader { geo in
            let gap = WatchTheme.gap
            let stats = min(84, max(58, geo.size.width * 0.38))
            let ring = max(0, min(geo.size.width - stats - gap, geo.size.height * 0.48))
            VStack(spacing: gap) {
                WatchHeader(title: "Steps", back: true)
                HStack(alignment: .center, spacing: gap) {
                    ZStack {
                        WatchRing(progress: progress, size: ring, tint: WatchTheme.steps)
                        VStack(spacing: 1) {
                            Text(steps.formatted())
                                .font(.system(size: ring * 0.2, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                                .lineLimit(1)
                                .minimumScaleFactor(0.45)
                            Text("of \(goal.formatted())")
                                .font(.system(size: max(8, ring * 0.09), weight: .medium))
                                .foregroundStyle(WatchTheme.mute)
                                .lineLimit(1)
                                .minimumScaleFactor(0.55)
                        }
                        .padding(.horizontal, ring * 0.2)
                    }
                    .frame(width: ring, height: ring)
                    VStack(spacing: gap) {
                        MoveStat(
                            symbol: "mappin",
                            value: kmText,
                            unit: "km",
                            tint: WatchTheme.steps
                        )
                        MoveStat(
                            symbol: "flame.fill",
                            value: model.moveKcal?.formatted() ?? "—",
                            unit: "kcal",
                            tint: WatchTheme.kcal
                        )
                    }
                    .frame(width: stats)
                    .frame(height: ring)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                StepDayChart(hours: model.stepHours, tint: WatchTheme.steps)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
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
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .watchCard(14)
    }
}

private struct StepDayChart: View {
    var hours: [Int]
    var tint: Color

    var body: some View {
        let peak = max(hours.max() ?? 0, 1)
        VStack(alignment: .leading, spacing: 4) {
            Text("Today")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.82))
            GeometryReader { geo in
                HStack(alignment: .bottom, spacing: 1.5) {
                    ForEach(0..<24, id: \.self) { hour in
                        let value = hours.indices.contains(hour) ? hours[hour] : 0
                        RoundedRectangle(cornerRadius: 1.2, style: .continuous)
                            .fill(value > 0 ? tint : Color.white.opacity(0.16))
                            .frame(height: value > 0 ? max(3, geo.size.height * CGFloat(value) / CGFloat(peak)) : 2)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    }
                }
            }
            .frame(maxHeight: .infinity)
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
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
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
            let buttonHeight: CGFloat = 40
            let headerHeight: CGFloat = 26
            let ring = min(
                geo.size.width - 4,
                min(112, max(48, geo.size.height - headerHeight - buttonHeight - WatchTheme.gap * 2))
            )
            VStack(spacing: WatchTheme.gap) {
                WatchHeader(title: "Water", back: true)
                ZStack {
                    WatchRing(
                        progress: WatchTheme.fraction(Double(ml), Double(goal)),
                        size: ring,
                        tint: WatchTheme.water
                    )
                    VStack(spacing: 2) {
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
                .frame(maxWidth: .infinity)
                addButton("+250 ml", 250)
                    .padding(.horizontal, 6)
                if let error = model.error {
                    Text(error)
                        .font(.system(size: 10))
                        .foregroundStyle(WatchTheme.red)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Spacer(minLength: 0)
            }
        }
        .watchChrome()
    }

    private func addButton(_ title: String, _ amount: Int) -> some View {
        Button {
            afterTap { Task { await model.addWater(amount) } }
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

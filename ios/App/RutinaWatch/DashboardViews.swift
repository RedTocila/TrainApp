import SwiftUI
import HealthKit

@MainActor
final class WatchDashboardModel: ObservableObject {
    @Published var today: WatchToday?
    @Published var steps: Int?
    @Published var error: String?
    @Published var notice: String?
    @Published var busy = false
    @Published var fetchedAt = Date()

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
        if today?.workout.status != "in_progress" {
            Task { await startWorkout() }
        }
    }

    func pauseHiit() {
        hiitPausedLeft = hiitRemaining()
        hiitLeft = hiitPausedLeft
        hiitRunning = false
        hiitEndsAt = nil
    }

    func resumeHiit() {
        let left = max(hiitPausedLeft, 1)
        hiitRunning = true
        hiitEndsAt = Date().addingTimeInterval(TimeInterval(left))
        hiitLeft = left
        hiitBeepSecond = nil
        WatchTone.prepare()
        armHiitTicker()
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
        await mutate("workout.cancel")
    }

    func logSet(setId: String, reps: Int, weight: Double) async {
        markSetDone(setId, reps: reps, weight: weight)
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

    var alexContext: String {
        let workout = today?.workout
        let nutrition = today?.nutrition
        let water = today?.water
        return [
            workout?.title.map { "Workout \($0) \(workout?.status ?? "")" },
            nutrition.map { "Food \($0.calories)/\($0.targetCalories) kcal" },
            water.map { "Water \($0.ml)/\($0.goalMl) ml" }
        ]
        .compactMap { $0 }
        .joined(separator: ". ")
    }

    func askAlexAudio(_ base64: String) async -> String? {
        busy = true
        error = nil
        defer { busy = false }
        do {
            let response = try await WatchAPI.perform(
                "alex.audio",
                date: dateKey,
                extra: ["audioBase64": base64, "context": alexContext]
            )
            return response.reply
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }
    func askAlex(_ message: String) async -> String? {
        busy = true
        error = nil
        defer { busy = false }
        do {
            let response = try await WatchAPI.perform(
                "alex",
                date: dateKey,
                extra: ["message": message, "context": alexContext]
            )
            return response.reply
        } catch {
            self.error = error.localizedDescription
            return nil
        }
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
    static let red = Color(red: 248 / 255, green: 2 / 255, blue: 19 / 255)
    static let ink = Color(red: 12 / 255, green: 12 / 255, blue: 14 / 255)
    static let mute = Color.white.opacity(0.48)
    static let water = Color(red: 0.25, green: 0.62, blue: 1)
    static let stepsGreen = Color(red: 0.28, green: 0.86, blue: 0.48)

    static func clock(_ seconds: Int) -> String {
        let safe = max(0, seconds)
        return String(format: "%d:%02d", safe / 60, safe % 60)
    }

    static func fraction(_ value: Double, _ total: Double) -> Double {
        guard total > 0 else { return 0 }
        return min(1, max(0, value / total))
    }

    static func liters(_ ml: Int) -> String {
        String(format: "%.1f L", Double(ml) / 1000)
    }
}

struct WatchRing: View {
    var progress: Double
    var size: CGFloat = 46
    var tint: Color = WatchTheme.red
    var line: CGFloat = 8

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.12), lineWidth: line)
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
                .padding(.vertical, 8)
                .background(Capsule().fill(fill))
        }
        .buttonStyle(.plain)
    }
}

private struct DashTile: View {
    var title: String
    var symbol: String
    var tint: Color
    var active = false

    var body: some View {
        VStack(spacing: 3) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: symbol)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(tint.opacity(active ? 0.32 : 0.16))
                    )
                if active {
                    Circle()
                        .fill(tint)
                        .frame(width: 6, height: 6)
                        .padding(5)
                }
            }
            Text(title)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }
}

struct DashboardView: View {
    @EnvironmentObject private var session: WatchSessionBridge
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                let gap: CGFloat = 6
                let headerHeight: CGFloat = 28
                let tileHeight = max(44, (geo.size.height - headerHeight - gap) / 2)
                VStack(spacing: gap) {
                    header
                        .frame(height: headerHeight, alignment: .top)
                        HStack(spacing: gap) {
                            destination { WorkoutWatchView() } label: {
                                DashTile(
                                    title: "Workout",
                                    symbol: "dumbbell.fill",
                                    tint: WatchTheme.red,
                                    active: model.today?.workout.status == "in_progress"
                                )
                            }
                            destination { NutritionWatchView() } label: {
                                DashTile(title: "Nutrition", symbol: "fork.knife", tint: WatchTheme.red)
                            }
                            destination { CardioWatchView() } label: {
                                DashTile(
                                    title: "Cardio",
                                    symbol: "figure.run",
                                    tint: WatchTheme.red,
                                    active: model.today?.cardio.status == "running"
                                )
                            }
                        }
                        .frame(height: tileHeight)
                        HStack(spacing: gap) {
                            destination { WaterWatchView() } label: {
                                DashTile(title: "Water", symbol: "drop.fill", tint: WatchTheme.water)
                            }
                            destination { StepsWatchView() } label: {
                                DashTile(title: "Steps", symbol: "shoeprints.fill", tint: WatchTheme.stepsGreen)
                            }
                            destination { AlexWatchView() } label: {
                                DashTile(title: "Alex", symbol: "mic.fill", tint: WatchTheme.red)
                            }
                        }
                        .frame(height: tileHeight)
                }
            }
            .padding(.horizontal, 2)
            .toolbar(.hidden, for: .navigationBar)
            .containerBackground(WatchTheme.ink, for: .navigation)
        }
        .tint(WatchTheme.red)
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
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                macroRing("Kcal", nutrition?.calories, nutrition?.targetCalories, WatchTheme.red, unit: "")
                macroRing("Protein", nutrition?.protein, nutrition?.targetProtein, Color(red: 1, green: 0.38, blue: 0.48), unit: "g")
            }
            HStack(spacing: 8) {
                macroRing("Carbs", nutrition?.carbs, nutrition?.targetCarbs, Color(red: 1, green: 0.72, blue: 0.22), unit: "g")
                macroRing("Fat", nutrition?.fat, nutrition?.targetFat, Color(red: 0.35, green: 0.72, blue: 1), unit: "g")
            }
            note
        }
        .navigationTitle("Nutrition")
        .containerBackground(WatchTheme.ink, for: .navigation)
    }

    private func macroRing(_ title: String, _ value: Int?, _ target: Int?, _ tint: Color, unit: String) -> some View {
        let current = value ?? 0
        let goal = target ?? 0
        return VStack(spacing: 2) {
            ZStack {
                WatchRing(
                    progress: WatchTheme.fraction(Double(current), Double(max(goal, 1))),
                    size: 58,
                    tint: tint,
                    line: 5
                )
                Text("\(current)")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }
            Text(title)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(tint)
            Text("\(goal)\(unit)")
                .font(.system(size: 9))
                .foregroundStyle(WatchTheme.mute)
        }
        .frame(maxWidth: .infinity)
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
                WatchRing(progress: progress, size: 112, tint: WatchTheme.stepsGreen, line: 9)
                Image(systemName: "shoeprints.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(WatchTheme.stepsGreen)
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
        VStack(spacing: 6) {
            Spacer(minLength: 0)
            ZStack {
                WatchRing(
                    progress: WatchTheme.fraction(Double(ml), Double(max(goal, 1))),
                    size: 96,
                    tint: WatchTheme.water,
                    line: 9
                )
                Image(systemName: "drop.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(WatchTheme.water)
            }
            Text(WatchTheme.liters(ml))
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
            Text("of \(WatchTheme.liters(goal))")
                .font(.system(size: 12))
                .foregroundStyle(WatchTheme.mute)
            HStack(spacing: 6) {
                amount("−250", -250)
                amount("+250", 250)
                amount("+500", 500)
            }
            Spacer(minLength: 0)
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
                .padding(.vertical, 7)
                .background(Capsule().fill(value < 0 ? Color.white.opacity(0.12) : WatchTheme.water))
        }
        .buttonStyle(.plain)
        .disabled(session.credentials?.isUsable != true)
    }
}


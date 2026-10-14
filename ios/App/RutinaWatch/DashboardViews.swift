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

    func refresh() async {
        await run {
            let today = try await WatchAPI.today(date: dateKey)
            self.today = today
            self.fetchedAt = Date()
        }
        await loadSteps()
    }

    func addWater(_ amount: Int) async {
        await mutate("water.add", extra: ["amount": amount])
    }

    func startWorkout() async {
        await mutate("workout.start")
    }

    func cancelWorkout() async {
        await mutate("workout.cancel")
    }

    func logSet(reps: Int, weight: Double) async {
        guard let setId = today?.workout.setId else {
            error = "No set to log."
            return
        }
        await mutate("workout.logSet", extra: [
            "setId": setId,
            "reps": reps,
            "weightKg": weight
        ])
    }

    func startCardio() async {
        await mutate("cardio.start")
    }

    func stopCardio() async {
        await mutate("cardio.stop")
    }

    func askAlexAudio(_ base64: String) async -> String? {
        busy = true
        error = nil
        defer { busy = false }
        do {
            let response = try await WatchAPI.perform(
                "alex.audio",
                date: dateKey,
                extra: ["audioBase64": base64]
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
            let response = try await WatchAPI.perform("alex", date: dateKey, extra: ["message": message])
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
    static let card = Color.white.opacity(0.07)
    static let line = Color.white.opacity(0.10)
    static let mute = Color.white.opacity(0.48)

    static func clock(_ seconds: Int) -> String {
        let safe = max(0, seconds)
        return String(format: "%d:%02d", safe / 60, safe % 60)
    }

    static func fraction(_ value: Double, _ total: Double) -> Double {
        guard total > 0 else { return 0 }
        return min(1, max(0, value / total))
    }
}

struct WatchScreen<Content: View>: View {
    var title: String?
    var hidesBar = false
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                content()
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 8)
        }
        .scrollIndicators(.hidden)
        .navigationTitle(title ?? "")
        .toolbar(hidesBar ? .hidden : .automatic, for: .navigationBar)
        .containerBackground(WatchTheme.ink, for: .navigation)
    }
}

struct WatchCard<Content: View>: View {
    var fill: Color = WatchTheme.card
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(fill)
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(WatchTheme.line, lineWidth: 0.6)
                    )
            )
    }
}

struct WatchEyebrow: View {
    var text: String
    var color: Color = WatchTheme.mute

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .semibold))
            .tracking(1.1)
            .foregroundStyle(color)
    }
}

struct WatchTrack: View {
    var progress: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.10))
                Capsule()
                    .fill(WatchTheme.red)
                    .frame(width: max(4, geo.size.width * WatchTheme.fraction(progress, 1)))
            }
        }
        .frame(height: 3)
    }
}

struct WatchRing: View {
    var progress: Double
    var size: CGFloat = 46

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.12), lineWidth: 3.5)
            Circle()
                .trim(from: 0, to: WatchTheme.fraction(progress, 1))
                .stroke(WatchTheme.red, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: size, height: size)
    }
}

struct WatchAction: View {
    var title: String
    var prominent = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(prominent ? Color.white : WatchTheme.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background {
                    if prominent {
                        Capsule().fill(WatchTheme.red)
                    } else {
                        Capsule().stroke(WatchTheme.red.opacity(0.7), lineWidth: 1)
                    }
                }
        }
        .buttonStyle(.plain)
    }
}

struct DashboardView: View {
    @EnvironmentObject private var session: WatchSessionBridge
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                WatchScreen(hidesBar: true) {
                    header
                    messages
                    workoutLink
                    HStack(spacing: 8) {
                        nutritionLink
                        stepsLink
                    }
                    waterCard
                    cardioLink
                    alexLink
                }
            }
        }
        .tint(WatchTheme.red)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("RUTINA")
                .font(.system(size: 13, weight: .black))
                .tracking(1.6)
            Spacer()
            Button {
                Task { await model.refresh() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(WatchTheme.mute)
            }
            .buttonStyle(.plain)
            .disabled(model.busy)
        }
    }

    @ViewBuilder
    private var messages: some View {
        if session.credentials?.isUsable != true {
            WatchCard {
                Text("Open RUTINA on your iPhone and sign in.")
                    .font(.system(size: 12))
                    .foregroundStyle(WatchTheme.mute)
            }
        }
        if let error = model.error {
            Text(error)
                .font(.system(size: 11))
                .foregroundStyle(WatchTheme.red)
        }
        if let notice = model.notice {
            Text(notice)
                .font(.system(size: 11))
                .foregroundStyle(WatchTheme.mute)
        }
    }

    private var workoutActive: Bool {
        model.today?.workout.status == "in_progress"
    }

    private var workoutLink: some View {
        NavigationLink {
            WorkoutWatchView()
        } label: {
            WatchCard(fill: workoutActive ? WatchTheme.red : WatchTheme.card) {
                WatchEyebrow(text: "Workout", color: workoutActive ? Color.white.opacity(0.75) : WatchTheme.mute)
                Text(workoutValue)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
            }
        }
        .buttonStyle(.plain)
    }

    private var nutritionLink: some View {
        NavigationLink {
            NutritionWatchView()
        } label: {
            WatchCard {
                WatchEyebrow(text: "Food")
                Text(nutritionValue)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("kcal")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(WatchTheme.mute)
                WatchTrack(progress: nutritionProgress)
            }
        }
        .buttonStyle(.plain)
    }

    private var stepsLink: some View {
        NavigationLink {
            StepsWatchView()
        } label: {
            WatchCard {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        WatchEyebrow(text: "Steps")
                        Text(shortSteps)
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                    }
                    Spacer(minLength: 0)
                    WatchRing(progress: stepsProgress, size: 28)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var waterCard: some View {
        WatchCard {
            HStack {
                WatchEyebrow(text: "Water")
                Spacer()
                Text(waterValue)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
            }
            WatchTrack(progress: waterProgress)
            HStack(spacing: 6) {
                waterButton(250)
                waterButton(500)
            }
        }
    }

    private func waterButton(_ amount: Int) -> some View {
        Button {
            Task { await model.addWater(amount) }
        } label: {
            Text("+\(amount)")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(Capsule().fill(Color.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .disabled(model.busy || session.credentials?.isUsable != true)
    }

    private var cardioLink: some View {
        NavigationLink {
            CardioWatchView()
        } label: {
            WatchCard {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        WatchEyebrow(text: "Cardio")
                        Text(cardioTitle)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                    }
                    Spacer()
                    Text(cardioValue)
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundStyle(model.today?.cardio.status == "running" ? WatchTheme.red : .white)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var alexLink: some View {
        NavigationLink {
            AlexWatchView()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "mic.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(WatchTheme.red))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Ask Alex")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Hold to talk")
                        .font(.system(size: 11))
                        .foregroundStyle(WatchTheme.mute)
                }
                Spacer()
            }
            .padding(.horizontal, 2)
            .padding(.top, 2)
        }
        .buttonStyle(.plain)
    }

    private var nutritionProgress: Double {
        let nutrition = model.today?.nutrition
        return WatchTheme.fraction(Double(nutrition?.calories ?? 0), Double(nutrition?.targetCalories ?? 1))
    }

    private var stepsProgress: Double {
        WatchTheme.fraction(Double(model.steps ?? 0), Double(model.today?.steps.goal ?? 10000))
    }

    private var waterProgress: Double {
        let water = model.today?.water
        return WatchTheme.fraction(Double(water?.ml ?? 0), Double(water?.goalMl ?? 1))
    }

    private var shortSteps: String {
        let steps = model.steps ?? 0
        if steps >= 1000 {
            return String(format: "%.1fk", Double(steps) / 1000)
        }
        return "\(steps)"
    }

    private var cardioTitle: String {
        guard let cardio = model.today?.cardio, cardio.status != "none" else { return "Rest day" }
        if cardio.completed || cardio.status == "completed" { return "Finished" }
        return cardio.title ?? "Ready"
    }

    private var workoutValue: String {
        guard let workout = model.today?.workout else { return "—" }
        if workout.status == "in_progress", let name = workout.exerciseName, let set = workout.setNumber {
            return "\(name) · \(set)"
        }
        if workout.status == "completed" { return "Done" }
        return workout.title ?? "Rest"
    }

    private var nutritionValue: String {
        guard let nutrition = model.today?.nutrition else { return "—" }
        return "\(nutrition.calories)"
    }

    private var cardioValue: String {
        guard let cardio = model.today?.cardio, cardio.status != "none" else { return "—" }
        if cardio.completed || cardio.status == "completed" { return "Done" }
        if cardio.status == "running" || cardio.status == "paused" {
            return WatchTheme.clock(model.cardioElapsed)
        }
        if let minutes = cardio.plannedMinutes { return "\(minutes)m" }
        return "Ready"
    }

    private var waterValue: String {
        guard let water = model.today?.water else { return "—" }
        return "\(water.ml) ml"
    }
}

struct NutritionWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let nutrition = model.today?.nutrition
        WatchScreen(title: "Nutrition") {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(nutrition?.calories ?? 0)")
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("of \(nutrition?.targetCalories ?? 0) kcal")
                    .font(.system(size: 12))
                    .foregroundStyle(WatchTheme.mute)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
            WatchTrack(progress: WatchTheme.fraction(
                Double(nutrition?.calories ?? 0),
                Double(max(nutrition?.targetCalories ?? 1, 1))
            ))
            macro("Protein", nutrition?.protein, nutrition?.targetProtein)
            macro("Carbs", nutrition?.carbs, nutrition?.targetCarbs)
            macro("Fat", nutrition?.fat, nutrition?.targetFat)
        }
    }

    private func macro(_ title: String, _ value: Int?, _ target: Int?) -> some View {
        WatchCard {
            HStack {
                WatchEyebrow(text: title)
                Spacer()
                Text("\(value ?? 0)")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("/ \(target ?? 0) g")
                    .font(.system(size: 11))
                    .foregroundStyle(WatchTheme.mute)
            }
            WatchTrack(progress: WatchTheme.fraction(Double(value ?? 0), Double(max(target ?? 1, 1))))
        }
    }
}

struct StepsWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let goal = model.today?.steps.goal ?? 10000
        let steps = model.steps ?? 0
        let progress = WatchTheme.fraction(Double(steps), Double(max(goal, 1)))
        WatchScreen(title: "Steps") {
            VStack(spacing: 10) {
                ZStack {
                    WatchRing(progress: progress, size: 108)
                    VStack(spacing: 0) {
                        Text("\(Int((progress * 100).rounded()))%")
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 6)
                Text(steps.formatted())
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("of \(goal.formatted())")
                    .font(.system(size: 12))
                    .foregroundStyle(WatchTheme.mute)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

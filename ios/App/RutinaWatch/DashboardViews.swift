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

private let accent = Color(red: 248 / 255, green: 2 / 255, blue: 19 / 255)

struct DashboardView: View {
    @EnvironmentObject private var session: WatchSessionBridge
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { _ in
            List {
                if session.credentials?.isUsable != true {
                    Text("Open RUTINA on your iPhone and sign in. The Watch picks up that session.")
                        .font(.footnote)
                }

                if let error = model.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                if let notice = model.notice {
                    Text(notice)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section {
                    NavigationLink {
                        WorkoutWatchView()
                    } label: {
                        row("Workout", value: workoutValue)
                    }
                    NavigationLink {
                        NutritionWatchView()
                    } label: {
                        row("Nutrition", value: nutritionValue)
                    }
                    NavigationLink {
                        StepsWatchView()
                    } label: {
                        row("Steps", value: stepsValue)
                    }
                    waterRow
                    NavigationLink {
                        CardioWatchView()
                    } label: {
                        row("Cardio", value: cardioValue)
                    }
                }

                Section {
                    NavigationLink {
                        AlexWatchView()
                    } label: {
                        Label("Ask Alex", systemImage: "mic.fill")
                    }
                }
            }
            }
            .navigationTitle("RUTINA")
            .toolbar {
                ToolbarItem(placement: .automatic) {
                    Button {
                        Task { await model.refresh() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(model.busy)
                }
            }
        }
        .tint(accent)
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
        return "\(nutrition.calories)/\(nutrition.targetCalories)"
    }

    private var stepsValue: String {
        let goal = model.today?.steps.goal ?? 10000
        let steps = model.steps ?? 0
        return "\(steps.formatted())/\(goal.formatted())"
    }

    private var cardioValue: String {
        guard let cardio = model.today?.cardio, cardio.status != "none" else { return "Rest" }
        if cardio.completed || cardio.status == "completed" { return "Done" }
        if cardio.status == "running" || cardio.status == "paused" {
            return clock(model.cardioElapsed)
        }
        return cardio.title ?? "Ready"
    }

    private var waterRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            row("Water", value: waterValue)
            HStack {
                Button("+250") { Task { await model.addWater(250) } }
                Button("+500") { Task { await model.addWater(500) } }
            }
            .buttonStyle(.bordered)
            .disabled(model.busy || session.credentials?.isUsable != true)
        }
    }

    private var waterValue: String {
        guard let water = model.today?.water else { return "—" }
        return "\(water.ml)/\(water.goalMl) ml"
    }

    private func row(_ title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.headline)
            Text(value)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
    }

    private func clock(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

struct NutritionWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let nutrition = model.today?.nutrition
        List {
            line("Calories", nutrition?.calories, nutrition?.targetCalories, "kcal")
            line("Protein", nutrition?.protein, nutrition?.targetProtein, "g")
            line("Carbs", nutrition?.carbs, nutrition?.targetCarbs, "g")
            line("Fat", nutrition?.fat, nutrition?.targetFat, "g")
        }
        .navigationTitle("Nutrition")
    }

    private func line(_ title: String, _ value: Int?, _ target: Int?, _ unit: String) -> some View {
        VStack(alignment: .leading) {
            Text(title).font(.headline)
            Text("\(value ?? 0) / \(target ?? 0) \(unit)")
                .foregroundStyle(.secondary)
        }
    }
}

struct StepsWatchView: View {
    @EnvironmentObject private var model: WatchDashboardModel

    var body: some View {
        let goal = model.today?.steps.goal ?? 10000
        let steps = model.steps ?? 0
        VStack(spacing: 8) {
            Text(steps.formatted())
                .font(.system(size: 36, weight: .bold, design: .rounded))
            Text("of \(goal.formatted())")
                .foregroundStyle(.secondary)
            ProgressView(value: Double(steps), total: Double(max(goal, 1)))
                .tint(accent)
        }
        .navigationTitle("Steps")
    }
}

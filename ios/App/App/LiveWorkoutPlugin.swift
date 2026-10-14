import ActivityKit
import AppIntents
import Capacitor
import Foundation
import UIKit

@available(iOS 16.0, *)
struct ShowCurrentSetIntent: AppIntent {
    static var title: LocalizedStringResource = "Current set"
    static var description = IntentDescription("Open the set you're on and change the weight, reps, or exercise.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        LiveWorkoutStore.markQuickOpen()
        let index = LiveWorkoutStore.focusIndex
        if let url = URL(string: "rutina://dashboard/workout/quick?exercise=\(index)") {
            await UIApplication.shared.open(url)
        }
        return .result()
    }
}

@available(iOS 16.0, *)
struct RutinaShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ShowCurrentSetIntent(),
            phrases: [
                "Current set in \(.applicationName)",
                "Adjust my set in \(.applicationName)"
            ],
            shortTitle: "Current set",
            systemImageName: "dumbbell.fill"
        )
    }
}

@objc(LiveWorkoutPlugin)
public class LiveWorkoutPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveWorkoutPlugin"
    public let jsName = "LiveWorkout"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumeQuickOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentDraft", returnType: CAPPluginReturnPromise)
    ]

    @objc func sync(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        let name = call.getString("exerciseName") ?? "Exercise"
        let exerciseIndex = Self.int(call, "exerciseIndex", fallback: 0)
        let exerciseCount = Self.int(call, "exerciseCount", fallback: 1)
        let setNumber = Self.int(call, "setNumber", fallback: 1)
        let setCount = Self.int(call, "setCount", fallback: 1)
        let reps = Self.int(call, "reps", fallback: 8)
        let weight = Self.double(call, "weightKg", fallback: 20)
        let setId = call.getString("setId") ?? ""
        let gifUrl = call.getString("gifUrl")
        Task {
            let token = await LiveWorkoutStore.cacheImage(from: gifUrl)
            let state = LiveWorkoutSync.state(
                name: name,
                setNumber: setNumber,
                setCount: setCount,
                reps: reps,
                weightKg: weight,
                setId: setId,
                exerciseIndex: exerciseIndex,
                exerciseCount: exerciseCount,
                imageToken: token
            )
            await LiveWorkoutActivity.start(state)
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        Task {
            await LiveWorkoutSync.endAll()
            call.resolve()
        }
    }

    @objc func consumeQuickOpen(_ call: CAPPluginCall) {
        let pending = LiveWorkoutStore.consumeQuickOpen()
        call.resolve([
            "open": pending.open,
            "exerciseIndex": pending.exerciseIndex
        ])
    }

    @objc func currentDraft(_ call: CAPPluginCall) {
        let draft = LiveWorkoutStore.draft() ?? [:]
        call.resolve([
            "exerciseIndex": (draft["exerciseIndex"] as? NSNumber)?.intValue ?? LiveWorkoutStore.focusIndex,
            "setId": draft["setId"] as? String ?? "",
            "reps": (draft["reps"] as? NSNumber)?.intValue ?? 0,
            "weightKg": (draft["weightKg"] as? NSNumber)?.doubleValue ?? 0
        ])
    }

    private static func int(_ call: CAPPluginCall, _ key: String, fallback: Int) -> Int {
        if let value = call.getInt(key) { return value }
        if let value = call.getDouble(key) { return Int(value.rounded()) }
        return fallback
    }

    private static func double(_ call: CAPPluginCall, _ key: String, fallback: Double) -> Double {
        if let value = call.getDouble(key) { return value }
        if let value = call.getInt(key) { return Double(value) }
        return fallback
    }
}

@available(iOS 16.2, *)
enum LiveWorkoutActivity {
    @MainActor
    static func start(_ state: WorkoutActivityAttributes.ContentState) async {
        LiveWorkoutStore.saveDraft(
            index: state.exerciseIndex,
            setId: state.setId,
            reps: state.reps,
            weight: state.weightKg
        )
        let content = ActivityContent(state: state, staleDate: nil)
        if Activity<WorkoutActivityAttributes>.activities.isEmpty {
            let attributes = WorkoutActivityAttributes(title: "RUTINA")
            _ = try? Activity.request(attributes: attributes, content: content, pushType: nil)
        } else {
            for activity in Activity<WorkoutActivityAttributes>.activities {
                await activity.update(content)
            }
        }
    }
}

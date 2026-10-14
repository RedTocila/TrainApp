import ActivityKit
import AppIntents
import Capacitor
import Foundation
import SwiftUI
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
    static var shortcutTileColor: ShortcutTileColor = .red

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

@available(iOS 16.0, *)
private struct BackTapSetupSheet: View {
    var title: String
    var message: String
    var dismissTitle: String
    var onClose: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                Text(message)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                SiriTipView(intent: ShowCurrentSetIntent())
                ShortcutsLink()
                    .shortcutsLinkStyle(.automaticOutline)
                Spacer(minLength: 0)
            }
            .padding(20)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Color(red: 12 / 255, green: 12 / 255, blue: 14 / 255))
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(dismissTitle, action: onClose)
                }
            }
        }
        .preferredColorScheme(.dark)
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
        CAPPluginMethod(name: "currentDraft", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareBackTap", returnType: CAPPluginReturnPromise)
    ]

    @objc func prepareBackTap(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else {
            call.resolve()
            return
        }
        let title = call.getString("title") ?? "Current set"
        let message = call.getString("message") ?? "Add Current set, then choose it under Shortcuts at the bottom of Double Tap."
        let dismissTitle = call.getString("dismiss") ?? "Done"
        DispatchQueue.main.async { [weak self] in
            let sheet = BackTapSetupSheet(title: title, message: message, dismissTitle: dismissTitle) {
                self?.bridge?.viewController?.dismiss(animated: true)
            }
            let host = UIHostingController(rootView: sheet)
            host.modalPresentationStyle = .pageSheet
            self?.bridge?.viewController?.present(host, animated: true)
            call.resolve()
        }
    }

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
        let generation = LiveWorkoutStore.beginSync()
        Task {
            let token = await LiveWorkoutStore.cacheImage(from: gifUrl)
            guard LiveWorkoutStore.isSyncCurrent(generation) else {
                call.resolve()
                return
            }
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
            await LiveWorkoutActivity.start(state, generation: generation)
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        LiveWorkoutStore.cancelSync()
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
    static func start(_ state: WorkoutActivityAttributes.ContentState, generation: Int) async {
        guard LiveWorkoutStore.isSyncCurrent(generation) else { return }
        LiveWorkoutStore.saveDraft(
            index: state.exerciseIndex,
            setId: state.setId,
            reps: state.reps,
            weight: state.weightKg
        )
        let content = ActivityContent(state: state, staleDate: nil)
        if Activity<WorkoutActivityAttributes>.activities.isEmpty {
            guard let activity = try? Activity.request(
                attributes: WorkoutActivityAttributes(title: "RUTINA"),
                content: content,
                pushType: nil
            ) else { return }
            if !LiveWorkoutStore.isSyncCurrent(generation) {
                await activity.end(activity.content, dismissalPolicy: .immediate)
                LiveWorkoutStore.clearDraft()
            }
        } else {
            guard LiveWorkoutStore.isSyncCurrent(generation) else { return }
            for activity in Activity<WorkoutActivityAttributes>.activities {
                await activity.update(content)
            }
        }
    }
}

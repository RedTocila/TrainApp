import ActivityKit
import Capacitor
import Foundation

@objc(LiveWorkoutPlugin)
public class LiveWorkoutPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveWorkoutPlugin"
    public let jsName = "LiveWorkout"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "flush", returnType: CAPPluginReturnPromise),
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
        let baseRevision = Self.int(call, "baseRevision", fallback: 0)
        let board = LiveBoard(json: call.getString("boardJson"))
        if LiveWorkoutStore.shouldIgnorePhoneSync(baseRevision: baseRevision, board: board) {
            call.resolve()
            return
        }
        let generation = LiveWorkoutStore.beginSync()
        Task {
            guard LiveWorkoutStore.isSyncCurrent(generation) else {
                call.resolve()
                return
            }
            if LiveWorkoutStore.shouldIgnorePhoneSync(baseRevision: baseRevision, board: board) {
                call.resolve()
                return
            }
            let token = LiveWorkoutStore.imageToken
            let state = board?.contentState(index: exerciseIndex, imageToken: token) ?? LiveWorkoutSync.state(
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
            await LiveWorkoutActivity.start(state, generation: generation, board: board)
            call.resolve()
            let nextToken = await LiveWorkoutStore.cacheImage(from: gifUrl, index: exerciseIndex)
            guard LiveWorkoutStore.isSyncCurrent(generation), nextToken != token else { return }
            let pictured = board?.contentState(index: exerciseIndex, imageToken: nextToken) ?? LiveWorkoutSync.state(
                name: name,
                setNumber: setNumber,
                setCount: setCount,
                reps: reps,
                weightKg: weight,
                setId: setId,
                exerciseIndex: exerciseIndex,
                exerciseCount: exerciseCount,
                imageToken: nextToken
            )
            await LiveWorkoutActivity.start(pictured, generation: generation)
        }
    }

    @objc func flush(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        Task {
            await LiveWorkoutQueue.flush()
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
            await LiveWorkoutQueue.flush()
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
            "weightKg": (draft["weightKg"] as? NSNumber)?.doubleValue ?? 0,
            "revision": LiveWorkoutStore.revision,
            "boardJson": LiveWorkoutStore.boardJSON,
            "pendingJson": LiveWorkoutStore.pendingJSON
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
    static func start(_ state: WorkoutActivityAttributes.ContentState, generation: Int, board: LiveBoard? = nil) async {
        guard LiveWorkoutStore.isSyncCurrent(generation) else { return }
        if let board {
            LiveWorkoutStore.board = board
        }
        LiveWorkoutStore.saveDraft(
            index: state.exerciseIndex,
            setId: state.setId,
            reps: state.reps,
            weight: state.weightKg
        )
        var outgoing = state
        if let current = Activity<WorkoutActivityAttributes>.activities.first?.content.state,
           let end = current.restEndsAt,
           end.timeIntervalSinceNow > 0 {
            outgoing.restEndsAt = end
            outgoing.restSeconds = current.restSeconds
        }
        let content = ActivityContent(state: outgoing, staleDate: outgoing.restEndsAt)
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

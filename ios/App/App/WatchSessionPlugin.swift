import Capacitor
import WatchConnectivity

/// Holds the signed-in session and pushes it to the paired Apple Watch.
final class WatchConnectivityBridge: NSObject, WCSessionDelegate {
    static let shared = WatchConnectivityBridge()

    private let defaultsKey = "rutina.watch.session"
    private var payload: [String: Any] = [:]

    private override init() {
        super.init()
        if let stored = UserDefaults.standard.dictionary(forKey: defaultsKey) {
            payload = stored
            LiveWorkoutStore.saveCredentials(stored)
        }
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func update(_ next: [String: Any]) {
        payload = next
        UserDefaults.standard.set(next, forKey: defaultsKey)
        LiveWorkoutStore.saveCredentials(next)
        push()
    }

    func clear() {
        payload = ["accessToken": ""]
        UserDefaults.standard.set(payload, forKey: defaultsKey)
        LiveWorkoutStore.clearCredentials()
        push()
    }

    var onWorkout: (([String: Any]) -> Void)?

    private func push() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        try? session.updateApplicationContext(payload)
    }

    func sendWorkout(_ payload: [String: Any]) {
        send(payload, channel: "workout")
    }

    func sendCardio(_ payload: [String: Any]) {
        send(payload, channel: "cardio")
    }

    private func send(_ payload: [String: Any], channel: String) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        var message = payload
        message["channel"] = channel
        message["origin"] = "phone"
        if message["seq"] == nil {
            message["seq"] = Int(Date().timeIntervalSince1970 * 1000)
        }
        if session.isReachable {
            session.sendMessage(message, replyHandler: { _ in }, errorHandler: { _ in
                session.transferUserInfo(message)
            })
        } else {
            session.transferUserInfo(message)
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if activationState == .activated {
            push()
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        if message["request"] as? String == "credentials" {
            replyHandler(payload)
            return
        }
        replyHandler(["ok": true])
        if message["channel"] as? String == "workout" {
            DispatchQueue.main.async {
                self.onWorkout?(message)
            }
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard userInfo["channel"] as? String == "workout" else { return }
        DispatchQueue.main.async {
            self.onWorkout?(userInfo)
        }
    }
}

@objc(WatchSessionPlugin)
public class WatchSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WatchSessionPlugin"
    public let jsName = "WatchSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pushMirror", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pushCardio", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        WatchConnectivityBridge.shared.activate()
        WatchConnectivityBridge.shared.onWorkout = { [weak self] payload in
            self?.notifyListeners("workoutMirror", data: payload)
        }
    }

    @objc func pushMirror(_ call: CAPPluginCall) {
        var payload: [String: Any] = [:]
        if let status = call.getString("status") { payload["status"] = status }
        if let mode = call.getString("mode") { payload["mode"] = mode }
        if let action = call.getString("action") { payload["action"] = action }
        if let sessionId = call.getString("sessionId") { payload["sessionId"] = sessionId }
        if let setId = call.getString("setId") { payload["setId"] = setId }
        payload["exerciseIndex"] = call.getInt("exerciseIndex") ?? 0
        payload["reps"] = call.getInt("reps") ?? 0
        payload["weightKg"] = call.getDouble("weightKg") ?? 0
        payload["hiitIndex"] = call.getInt("hiitIndex") ?? 0
        payload["hiitRunning"] = call.getBool("hiitRunning") ?? false
        payload["hiitLeft"] = call.getInt("hiitLeft") ?? 0
        payload["hiitEndsAt"] = call.getDouble("hiitEndsAt") ?? 0
        WatchConnectivityBridge.shared.activate()
        WatchConnectivityBridge.shared.sendWorkout(payload)
        call.resolve()
    }

    @objc func pushCardio(_ call: CAPPluginCall) {
        var payload: [String: Any] = [:]
        if let status = call.getString("status") { payload["status"] = status }
        if let action = call.getString("action") { payload["action"] = action }
        if let cardioId = call.getString("cardioId") { payload["cardioId"] = cardioId }
        payload["elapsedSeconds"] = call.getInt("elapsedSeconds") ?? 0
        payload["completed"] = call.getBool("completed") ?? false
        WatchConnectivityBridge.shared.activate()
        WatchConnectivityBridge.shared.sendCardio(payload)
        call.resolve()
    }

    @objc func sync(_ call: CAPPluginCall) {
        let accessToken = call.getString("accessToken") ?? ""
        let refreshToken = call.getString("refreshToken") ?? ""
        guard !accessToken.isEmpty, !refreshToken.isEmpty else {
            call.reject("Missing session")
            return
        }
        let payload: [String: Any] = [
            "accessToken": accessToken,
            "refreshToken": refreshToken,
            "expiresAt": call.getDouble("expiresAt") ?? 0,
            "apiBase": call.getString("apiBase") ?? "https://rutina.al",
            "supabaseUrl": call.getString("supabaseUrl") ?? "",
            "supabaseAnonKey": call.getString("supabaseAnonKey") ?? ""
        ]
        WatchConnectivityBridge.shared.activate()
        WatchConnectivityBridge.shared.update(payload)
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        WatchConnectivityBridge.shared.clear()
        call.resolve()
    }
}

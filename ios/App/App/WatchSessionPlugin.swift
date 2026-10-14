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
        push()
    }

    func clear() {
        payload = ["accessToken": ""]
        UserDefaults.standard.set(payload, forKey: defaultsKey)
        push()
    }

    private func push() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        try? session.updateApplicationContext(payload)
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
        replyHandler([:])
    }
}

@objc(WatchSessionPlugin)
public class WatchSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WatchSessionPlugin"
    public let jsName = "WatchSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        WatchConnectivityBridge.shared.activate()
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

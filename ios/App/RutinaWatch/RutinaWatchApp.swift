import SwiftUI
import WatchConnectivity

@MainActor
final class WatchSessionBridge: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = WatchSessionBridge()

    @Published var credentials: WatchCredentials?
    private let defaultsKey = "rutina.watch.credentials"

    private override init() {
        super.init()
        if
            let data = UserDefaults.standard.data(forKey: defaultsKey),
            let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        {
            credentials = WatchCredentials(payload)
        }
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func credentialsForRequest() async -> WatchCredentials? {
        if let credentials, credentials.isUsable, !isExpiring(credentials) {
            return credentials
        }
        if WCSession.isSupported(), WCSession.default.activationState == .activated, WCSession.default.isReachable {
            _ = await requestCredentialsFromPhone()
        }
        return credentials
    }

    @discardableResult
    func requestCredentialsFromPhone() async -> Bool {
        guard WCSession.isSupported() else { return false }
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else { return false }

        return await withCheckedContinuation { continuation in
            var resumed = false
            session.sendMessage(["request": "credentials"], replyHandler: { payload in
                DispatchQueue.main.async {
                    self.apply(payload)
                    if !resumed {
                        resumed = true
                        continuation.resume(returning: self.credentials?.isUsable == true)
                    }
                }
            }, errorHandler: { _ in
                if !resumed {
                    resumed = true
                    continuation.resume(returning: false)
                }
            })
        }
    }

    private func isExpiring(_ credentials: WatchCredentials) -> Bool {
        guard credentials.expiresAt > 0 else { return false }
        return Date().timeIntervalSince1970 > credentials.expiresAt - 60
    }

    private func apply(_ payload: [String: Any]) {
        guard let next = WatchCredentials(payload) else {
            if payload["accessToken"] as? String == "" {
                credentials = nil
                UserDefaults.standard.removeObject(forKey: defaultsKey)
            }
            return
        }
        credentials = next
        if let data = try? JSONSerialization.data(withJSONObject: payload) {
            UserDefaults.standard.set(data, forKey: defaultsKey)
        }
    }

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        let context = session.receivedApplicationContext
        Task { @MainActor in
            self.apply(context)
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        Task { @MainActor in
            self.apply(applicationContext)
        }
    }
}

@main
struct RutinaWatchApp: App {
    @StateObject private var session = WatchSessionBridge.shared
    @StateObject private var model = WatchDashboardModel()

    var body: some Scene {
        WindowGroup {
            DashboardView()
                .environmentObject(session)
                .environmentObject(model)
                .task {
                    session.activate()
                    await model.refresh()
                }
        }
    }
}

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
        if await refreshSession() {
            return credentials
        }
        if WCSession.isSupported(), WCSession.default.activationState == .activated, WCSession.default.isReachable {
            _ = await requestCredentialsFromPhone()
            if let credentials, isExpiring(credentials) {
                _ = await refreshSession()
            }
        }
        return credentials
    }

    @discardableResult
    func refreshSession() async -> Bool {
        guard
            let current = credentials,
            current.isUsable,
            !current.refreshToken.isEmpty,
            !current.supabaseUrl.isEmpty,
            !current.supabaseAnonKey.isEmpty,
            let url = URL(string: "\(current.supabaseUrl)/auth/v1/token?grant_type=refresh_token")
        else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(current.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": current.refreshToken])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode ?? 500 < 300 else { return false }
            guard
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                let accessToken = json["access_token"] as? String,
                let refreshToken = json["refresh_token"] as? String,
                !accessToken.isEmpty
            else { return false }
            var expiresAt = jsonNumber(json["expires_at"])
            if expiresAt <= 0 {
                let expiresIn = jsonNumber(json["expires_in"])
                expiresAt = Date().timeIntervalSince1970 + (expiresIn > 0 ? expiresIn : 3600)
            }
            apply([
                "accessToken": accessToken,
                "refreshToken": refreshToken,
                "expiresAt": expiresAt,
                "apiBase": current.apiBase,
                "supabaseUrl": current.supabaseUrl,
                "supabaseAnonKey": current.supabaseAnonKey
            ])
            return credentials?.isUsable == true && !isExpiring(credentials ?? current)
        } catch {
            return false
        }
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

    private func jsonNumber(_ value: Any?) -> Double {
        if let number = value as? Double { return number }
        if let number = value as? Int { return Double(number) }
        if let number = value as? NSNumber { return number.doubleValue }
        return 0
    }

    private func apply(_ payload: [String: Any]) {
        guard let next = WatchCredentials(payload) else {
            if payload["accessToken"] as? String == "" {
                credentials = nil
                UserDefaults.standard.removeObject(forKey: defaultsKey)
            }
            return
        }
        if let current = credentials, current.expiresAt > next.expiresAt + 30, current.isUsable {
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

    func sendWorkout(_ payload: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        var message = payload
        message["channel"] = "workout"
        message["origin"] = "watch"
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

    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        Task { @MainActor in
            self.deliver(applicationContext)
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        replyHandler(["ok": true])
        Task { @MainActor in
            self.deliver(message)
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        Task { @MainActor in
            self.deliver(userInfo)
        }
    }

    private func deliver(_ payload: [String: Any]) {
        if payload["channel"] as? String == "workout" {
            WatchDashboardModel.current?.applyMirror(payload)
            return
        }
        apply(payload)
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

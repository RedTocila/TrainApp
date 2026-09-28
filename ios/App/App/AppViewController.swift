import UIKit
import WebKit
import Capacitor

/// Capacitor bridge with Safari-style pull-to-refresh on the web view.
class AppViewController: CAPBridgeViewController {
    private let pullToRefresh = WebViewPullToRefresh()

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView = webView else { return }
        pullToRefresh.attach(to: webView)
    }
}

/// Pulling past the top of the page reloads it, with the system spoke spinner.
/// The web app can pause it (open sheets, active workouts) by posting
/// `{ enabled: false }` to `window.webkit.messageHandlers.rutinaPullToRefresh`.
final class WebViewPullToRefresh: NSObject {
    static let messageName = "rutinaPullToRefresh"

    /// Content offset (pt) past the top that commits a refresh.
    private let triggerDistance: CGFloat = 100
    /// How far content stays pushed down while the page reloads.
    private let holdDistance: CGFloat = 44
    private let minimumSpinDuration: TimeInterval = 0.6
    private let timeoutDuration: TimeInterval = 20

    private weak var webView: WKWebView?
    private let spinner = PullSpinnerView()
    private let haptics = UIImpactFeedbackGenerator(style: .medium)
    private var offsetObservation: NSKeyValueObservation?
    private var loadingObservation: NSKeyValueObservation?

    private var isEnabled = true
    private var isArmed = false
    private var isRefreshing = false
    private var reloadStarted = false
    private var refreshStartedAt = Date.distantPast
    private var timeoutWork: DispatchWorkItem?

    func attach(to webView: WKWebView) {
        self.webView = webView
        let scrollView = webView.scrollView
        scrollView.alwaysBounceHorizontal = false
        applyBounce()

        webView.addSubview(spinner)

        webView.configuration.userContentController.add(
            WeakScriptMessageHandler(self),
            name: Self.messageName
        )
        scrollView.panGestureRecognizer.addTarget(self, action: #selector(handlePan(_:)))

        offsetObservation = scrollView.observe(\.contentOffset, options: [.new]) { [weak self] _, _ in
            self?.scrollDidChange()
        }
        loadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] webView, _ in
            self?.loadingDidChange(webView.isLoading)
        }
    }

    private var pullDistance: CGFloat {
        guard let scrollView = webView?.scrollView else { return 0 }
        return max(0, -scrollView.contentOffset.y)
    }

    private func applyBounce() {
        guard let scrollView = webView?.scrollView else { return }
        let bounce = isEnabled || isRefreshing
        scrollView.bounces = bounce
        scrollView.alwaysBounceVertical = bounce
    }

    private func setEnabled(_ enabled: Bool) {
        guard enabled != isEnabled else { return }
        isEnabled = enabled
        if !enabled && !isRefreshing {
            isArmed = false
            spinner.reset()
        }
        applyBounce()
    }

    private func layoutSpinner() {
        guard let webView = webView else { return }
        let safeTop = webView.safeAreaInsets.top
        let visibleGap = min(pullDistance, holdDistance)
        spinner.center = CGPoint(x: webView.bounds.midX, y: safeTop + visibleGap / 2)
        webView.bringSubviewToFront(spinner)
    }

    private func scrollDidChange() {
        guard isEnabled || isRefreshing else { return }
        layoutSpinner()
        if isRefreshing || isArmed { return }

        let pull = pullDistance
        spinner.alpha = min(1, max(0, (pull - 10) / 24))
        spinner.setProgress((pull - 10) / (triggerDistance - 10))

        guard let scrollView = webView?.scrollView, scrollView.isTracking else { return }
        if pull >= triggerDistance {
            isArmed = true
            haptics.impactOccurred()
            spinner.startSpinning()
        }
    }

    @objc private func handlePan(_ recognizer: UIPanGestureRecognizer) {
        switch recognizer.state {
        case .began:
            haptics.prepare()
        case .ended, .cancelled, .failed:
            if isArmed && !isRefreshing {
                beginRefresh()
            }
        default:
            break
        }
    }

    private func beginRefresh() {
        guard let webView = webView else { return }
        isArmed = false
        isRefreshing = true
        reloadStarted = false
        refreshStartedAt = Date()
        applyBounce()

        let scrollView = webView.scrollView
        UIView.animate(withDuration: 0.25, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
            scrollView.contentInset.top = self.holdDistance
        }

        let timeout = DispatchWorkItem { [weak self] in self?.endRefresh() }
        timeoutWork = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + timeoutDuration, execute: timeout)

        if webView.reload() == nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + minimumSpinDuration) { [weak self] in
                self?.endRefresh()
            }
        }
    }

    private func loadingDidChange(_ loading: Bool) {
        if loading {
            if isRefreshing { reloadStarted = true }
            // New document: its own scroll-lock state hasn't been reported yet.
            setEnabled(true)
            return
        }
        guard isRefreshing, reloadStarted else { return }
        let remaining = minimumSpinDuration - Date().timeIntervalSince(refreshStartedAt)
        DispatchQueue.main.asyncAfter(deadline: .now() + max(0, remaining)) { [weak self] in
            self?.endRefresh()
        }
    }

    private func endRefresh() {
        guard isRefreshing, let webView = webView else { return }
        timeoutWork?.cancel()
        timeoutWork = nil
        isRefreshing = false

        let scrollView = webView.scrollView
        UIView.animate(withDuration: 0.3, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
            scrollView.contentInset.top = 0
            if scrollView.contentOffset.y < 0 {
                scrollView.contentOffset.y = 0
            }
            self.spinner.alpha = 0
        } completion: { _ in
            self.spinner.reset()
            self.applyBounce()
        }
    }

    fileprivate func receive(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let enabled = body["enabled"] as? Bool else { return }
        setEnabled(enabled)
    }
}

/// Keeps WKUserContentController from retaining the pull-to-refresh controller.
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var target: WebViewPullToRefresh?

    init(_ target: WebViewPullToRefresh) {
        self.target = target
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.receive(message)
    }
}

/// The spoke spinner Safari shows: spokes appear one by one while pulling,
/// then it becomes the standard activity indicator once the refresh commits.
private final class PullSpinnerView: UIView {
    private let spokeCount = 8
    private let spokeColor = UIColor.systemGray
    private var spokes: [CALayer] = []
    private let indicator = UIActivityIndicatorView(style: .medium)

    init() {
        super.init(frame: CGRect(x: 0, y: 0, width: 28, height: 28))
        isUserInteractionEnabled = false
        alpha = 0

        indicator.color = spokeColor
        indicator.hidesWhenStopped = true
        indicator.center = CGPoint(x: bounds.midX, y: bounds.midY)
        addSubview(indicator)

        let center = CGPoint(x: bounds.midX, y: bounds.midY)
        for index in 0..<spokeCount {
            let spoke = CALayer()
            spoke.backgroundColor = spokeColor.cgColor
            spoke.bounds = CGRect(x: 0, y: 0, width: 2.5, height: 5.5)
            spoke.cornerRadius = 1.25
            spoke.anchorPoint = CGPoint(x: 0.5, y: 1.9)
            spoke.position = center
            spoke.transform = CATransform3DMakeRotation(
                CGFloat(index) * 2 * .pi / CGFloat(spokeCount), 0, 0, 1
            )
            spoke.opacity = 0
            layer.addSublayer(spoke)
            spokes.append(spoke)
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        for spoke in spokes {
            spoke.backgroundColor = spokeColor.resolvedColor(with: traitCollection).cgColor
        }
    }

    func setProgress(_ progress: CGFloat) {
        let clamped = min(1, max(0, progress))
        let visible = clamped * CGFloat(spokeCount)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        for (index, spoke) in spokes.enumerated() {
            spoke.opacity = Float(min(1, max(0, visible - CGFloat(index))))
        }
        CATransaction.commit()
    }

    func startSpinning() {
        alpha = 1
        setProgress(0)
        indicator.startAnimating()
    }

    func reset() {
        indicator.stopAnimating()
        setProgress(0)
        alpha = 0
    }
}

import SwiftUI
import WebKit

/// MeSticker booth app: the mesticker.fun booth/admin pages in a full-screen web view, plus native
/// printer links the pages can't get in a browser: Bluetooth LE (as Web Bluetooth) and the faster
/// classic-Bluetooth link the Liene app uses (ExternalAccessory). The screens all live on the
/// website, so design changes ship without a new app build.
@main
struct MeStickerApp: App {
    init() {
        // a sleeping screen drops the printer: keep it on while the app is open
        UIApplication.shared.isIdleTimerDisabled = true
    }

    var body: some Scene {
        WindowGroup {
            BoothWebView()
                .ignoresSafeArea()
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
        }
    }
}

struct BoothWebView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> BoothViewController { BoothViewController() }
    func updateUIViewController(_ vc: BoothViewController, context: Context) {}
}

final class BoothViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    private var webView: WKWebView!
    private var bridge: NativeBridge!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default() // keeps the station key and settings between launches

        let controller = WKUserContentController()
        if let url = Bundle.main.url(forResource: "bridge", withExtension: "js"), let js = try? String(contentsOf: url) {
            controller.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        }
        config.userContentController = controller

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.customUserAgent = nil
        if #available(iOS 16.4, *) { webView.isInspectable = true } // Safari → Develop menu, for debugging
        view.addSubview(webView)

        bridge = NativeBridge(webView: webView, presenter: self)
        controller.add(bridge, name: "mesticker")

        let start = (Bundle.main.object(forInfoDictionaryKey: "MeStickerStartURL") as? String) ?? "https://mesticker.fun/booth/admin"
        webView.load(URLRequest(url: URL(string: start)!))
    }

    // camera for the booth: no second permission prompt inside the page
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host.hasSuffix("mesticker.fun") || origin.host == "localhost" ? .grant : .prompt)
    }

    // window.confirm / alert from the pages
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    // payment and other outside links open in Safari; mesticker.fun stays in the app
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, let host = url.host else { return decisionHandler(.allow) }
        let ours = host.hasSuffix("mesticker.fun") || host == "localhost" || host.hasSuffix(".vercel.app")
        if !ours && action.targetFrame?.isMainFrame != false && (url.scheme == "https" || url.scheme == "http") {
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    // target=_blank links
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { UIApplication.shared.open(url) }
        return nil
    }

    // the web content process can be killed in the background: reload instead of a blank screen
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}

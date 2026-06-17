import UIKit
import Capacitor
import SafariServices
import WebKit
import AuthenticationServices

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UIScrollViewDelegate, WKScriptMessageHandler, SFSafariViewControllerDelegate, ASWebAuthenticationPresentationContextProviding {

    var window: UIWindow?
    private var loombusOAuthHandlerConfigured = false
    private var safariViewController: SFSafariViewController?
    private var webAuthenticationSession: ASWebAuthenticationSession?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        DispatchQueue.main.async {
            self.enableWebViewZoom()
        }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions or when the app begins the transition to the background.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough app state information to restore the app if it is terminated later.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        DispatchQueue.main.async {
            self.enableWebViewZoom()
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the app is about to terminate.
    }

    private func enableWebViewZoom() {
        guard let bridgeController = findBridgeViewController(from: window?.rootViewController),
              let webView = bridgeController.webView else {
            return
        }

        let scrollView = webView.scrollView
        scrollView.minimumZoomScale = 1.0
        scrollView.maximumZoomScale = 5.0
        scrollView.bouncesZoom = true
        scrollView.delegate = self

        if !loombusOAuthHandlerConfigured {
            webView.configuration.userContentController.add(self, name: "loombusOAuth")
            loombusOAuthHandlerConfigured = true
        }
    }

    private func findBridgeViewController(from controller: UIViewController?) -> CAPBridgeViewController? {
        if let bridgeController = controller as? CAPBridgeViewController {
            return bridgeController
        }

        for child in controller?.children ?? [] {
            if let bridgeController = findBridgeViewController(from: child) {
                return bridgeController
            }
        }

        if let presentedController = controller?.presentedViewController {
            return findBridgeViewController(from: presentedController)
        }

        return nil
    }

    private func topMostViewController(from controller: UIViewController?) -> UIViewController? {
        if let navigationController = controller as? UINavigationController {
            return topMostViewController(from: navigationController.visibleViewController)
        }

        if let tabBarController = controller as? UITabBarController {
            return topMostViewController(from: tabBarController.selectedViewController)
        }

        if let presentedController = controller?.presentedViewController {
            return topMostViewController(from: presentedController)
        }

        return controller
    }

    private func presentLoombusOAuthSession(url: URL) {
        DispatchQueue.main.async {
            self.safariViewController?.dismiss(animated: false)
            self.safariViewController = nil
            self.webAuthenticationSession?.cancel()

            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: "loombus"
            ) { callbackUrl, error in
                self.webAuthenticationSession = nil

                guard error == nil, let callbackUrl = callbackUrl else {
                    return
                }

                _ = self.handleLoombusAuthCallback(callbackUrl)
            }

            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.webAuthenticationSession = session
            session.start()
        }
    }

    private func handleLoombusAuthCallback(_ url: URL) -> Bool {
        guard url.scheme == "loombus",
              url.host == "auth",
              url.path == "/callback" else {
            return false
        }

        var components = URLComponents()
        components.scheme = "https"
        components.host = "loombus.com"
        components.path = "/auth/callback"
        components.percentEncodedQuery = URLComponents(url: url, resolvingAgainstBaseURL: false)?.percentEncodedQuery

        guard let callbackUrl = components.url else {
            return false
        }

        DispatchQueue.main.async {
            self.safariViewController?.dismiss(animated: true)
            self.safariViewController = nil

            guard let bridgeController = self.findBridgeViewController(from: self.window?.rootViewController),
                  let webView = bridgeController.webView else {
                return
            }

            webView.load(URLRequest(url: callbackUrl))
        }

        return true
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "loombusOAuth",
              let urlString = message.body as? String,
              let url = URL(string: urlString) else {
            return
        }

        presentLoombusOAuthSession(url: url)
    }

    func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
        if safariViewController === controller {
            safariViewController = nil
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return window ?? ASPresentationAnchor()
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? {
        return scrollView.subviews.first
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        if handleLoombusAuthCallback(url) {
            return true
        }

        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call.
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call.
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }


    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken
        )
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }


}

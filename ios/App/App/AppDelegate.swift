import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UIScrollViewDelegate {

    var window: UIWindow?

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
            guard let bridgeController = self.findBridgeViewController(from: self.window?.rootViewController),
                  let webView = bridgeController.webView else {
                return
            }

            webView.load(URLRequest(url: callbackUrl))
        }

        return true
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

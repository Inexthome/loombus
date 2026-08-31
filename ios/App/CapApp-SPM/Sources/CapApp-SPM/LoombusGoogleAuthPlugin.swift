import Capacitor
import Foundation
import GoogleSignIn

@objc(LoombusGoogleAuthPlugin)
public class LoombusGoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LoombusGoogleAuthPlugin"
    public let jsName = "LoombusGoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    @objc func signIn(_ call: CAPPluginCall) {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
              !clientID.isEmpty,
              !clientID.contains("$(") else {
            call.reject("Google Sign-In is not configured for this iOS build.")
            return
        }

        let serverClientID = Bundle.main.object(forInfoDictionaryKey: "GIDServerClientID") as? String
        let normalizedServerClientID = serverClientID.flatMap { value in
            value.isEmpty || value.contains("$(") ? nil : value
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: clientID,
            serverClientID: normalizedServerClientID
        )

        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                call.reject("Google Sign-In could not find the presenting view controller.")
                return
            }

            GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { result, error in
                if let error {
                    let nsError = error as NSError
                    if nsError.domain == "com.google.GIDSignIn" && nsError.code == -5 {
                        call.reject("Google Sign-In was cancelled.", "google_sign_in_cancelled")
                        return
                    }

                    call.reject(error.localizedDescription)
                    return
                }

                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString,
                      !idToken.isEmpty else {
                    call.reject("Google did not return an ID token.")
                    return
                }

                var payload: [String: Any] = ["idToken": idToken]
                let accessToken = user.accessToken.tokenString
                if !accessToken.isEmpty {
                    payload["accessToken"] = accessToken
                }

                call.resolve(payload)
            }
        }
    }
}

public func handleLoombusGoogleSignInURL(_ url: URL) -> Bool {
    GIDSignIn.sharedInstance.handle(url)
}

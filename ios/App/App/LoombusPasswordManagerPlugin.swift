import AuthenticationServices
import Capacitor
import Foundation
import Security

@objc(LoombusPasswordManagerPlugin)
public class LoombusPasswordManagerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LoombusPasswordManagerPlugin"
    public let jsName = "LoombusPasswordManager"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "savePassword", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCredentialState", returnType: CAPPluginReturnPromise)
    ]

    @objc func savePassword(_ call: CAPPluginCall) {
        guard let email = call.getString("email")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !email.isEmpty else {
            call.reject("Email is required.")
            return
        }
        guard let password = call.getString("password"), !password.isEmpty else {
            call.reject("Password is required.")
            return
        }

        if #available(iOS 26.2, *) {
            savePasswordWithCredentialDataManager(
                email: email,
                password: password,
                call: call
            )
            return
        }

        savePasswordWithSharedWebCredentials(
            email: email,
            password: password,
            call: call
        )
    }

    @available(iOS 26.2, *)
    private func savePasswordWithCredentialDataManager(
        email: String,
        password: String,
        call: CAPPluginCall
    ) {
        DispatchQueue.main.async {
            guard let anchor = self.bridge?.viewController?.view.window else {
                call.reject("Apple Passwords could not present credential-saving UI.")
                return
            }

            let credential = ASPasswordCredential(user: email, password: password)
            let scope = ASAutoFillURLScope(
                scheme: .https,
                host: "loombus.com",
                path: "/"
            )

            Task { @MainActor in
                do {
                    try await ASCredentialDataManager().save(
                        password: credential,
                        for: scope,
                        title: "Loombus",
                        anchor: anchor
                    )
                    call.resolve(["saved": true])
                } catch {
                    call.reject(
                        "Apple Passwords did not accept this login: \(error.localizedDescription)"
                    )
                }
            }
        }
    }

    private func savePasswordWithSharedWebCredentials(
        email: String,
        password: String,
        call: CAPPluginCall
    ) {
        SecAddSharedWebCredential(
            "loombus.com" as CFString,
            email as CFString,
            password as CFString
        ) { error in
            DispatchQueue.main.async {
                if let error {
                    call.reject(
                        "Apple Passwords did not save this login: \(error.localizedDescription)"
                    )
                    return
                }

                call.resolve(["saved": true])
            }
        }
    }

    @objc func clearCredentialState(_ call: CAPPluginCall) {
        // Saved Apple Passwords belong to the user and must survive app sign-out.
        call.resolve(["cleared": true])
    }
}

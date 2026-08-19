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

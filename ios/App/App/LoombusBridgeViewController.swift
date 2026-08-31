import Capacitor
import CapApp_SPM

@objc(LoombusBridgeViewController)
final class LoombusBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LoombusLiveUpdatesPlugin())
        bridge?.registerPluginInstance(LoombusPasswordManagerPlugin())
        bridge?.registerPluginInstance(LoombusGoogleAuthPlugin())
    }
}

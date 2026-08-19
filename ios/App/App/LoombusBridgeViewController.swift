import Capacitor

@objc(LoombusBridgeViewController)
final class LoombusBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LoombusLiveUpdatesPlugin())
        bridge?.registerPluginInstance(LoombusPasswordManagerPlugin())
    }
}

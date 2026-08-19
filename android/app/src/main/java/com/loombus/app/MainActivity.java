package com.loombus.app;

import android.content.Intent;
import android.os.Bundle;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static final String LOOMBUS_DESTINATION_EXTRA = "com.loombus.app.DESTINATION";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LoombusLiveUpdatesPlugin.class);
        registerPlugin(LoombusPasswordManagerPlugin.class);
        super.onCreate(savedInstanceState);
        enableCredentialManagerInWebView();
        openLoombusDestination(getIntent());
    }

    private void enableCredentialManagerInWebView() {
        if (
            getBridge() != null &&
            WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)
        ) {
            WebSettingsCompat.setWebAuthenticationSupport(
                getBridge().getWebView().getSettings(),
                WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
            );
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openLoombusDestination(intent);
    }

    private void openLoombusDestination(Intent intent) {
        if (intent == null || getBridge() == null) return;
        String destination = intent.getStringExtra(LOOMBUS_DESTINATION_EXTRA);
        if (destination == null || !destination.startsWith("/")) return;

        getBridge().executeOnMainThread(() ->
            getBridge().getWebView().loadUrl("https://loombus.com" + destination)
        );
        intent.removeExtra(LOOMBUS_DESTINATION_EXTRA);
    }
}

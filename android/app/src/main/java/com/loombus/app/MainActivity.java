package com.loombus.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static final String LOOMBUS_DESTINATION_EXTRA = "com.loombus.app.DESTINATION";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LoombusLiveUpdatesPlugin.class);
        super.onCreate(savedInstanceState);
        openLoombusDestination(getIntent());
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

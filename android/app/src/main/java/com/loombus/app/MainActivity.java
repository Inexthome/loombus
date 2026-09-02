package com.loombus.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.HapticFeedbackConstants;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static final String LOOMBUS_DESTINATION_EXTRA = "com.loombus.app.DESTINATION";
    private static final String LOOMBUS_HOST = "loombus.com";
    private SwipeRefreshLayout loombusRefreshLayout;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LoombusLiveUpdatesPlugin.class);
        registerPlugin(LoombusPasswordManagerPlugin.class);
        super.onCreate(savedInstanceState);
        enableCredentialManagerInWebView();
        installPullToRefresh();
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

    private void installPullToRefresh() {
        if (getBridge() == null || loombusRefreshLayout != null) return;

        WebView webView = getBridge().getWebView();
        if (!(webView.getParent() instanceof ViewGroup)) return;

        ViewGroup parent = (ViewGroup) webView.getParent();
        int childIndex = parent.indexOfChild(webView);
        ViewGroup.LayoutParams originalLayoutParams = webView.getLayoutParams();
        parent.removeView(webView);

        SwipeRefreshLayout refreshLayout = new SwipeRefreshLayout(this);
        refreshLayout.setLayoutParams(originalLayoutParams);
        refreshLayout.setOnChildScrollUpCallback((layout, child) -> webView.getScrollY() > 0);
        refreshLayout.setOnRefreshListener(() -> {
            webView.performHapticFeedback(HapticFeedbackConstants.CONFIRM);
            webView.reload();
            webView.postDelayed(() -> refreshLayout.setRefreshing(false), 700);
        });
        refreshLayout.addView(
            webView,
            new SwipeRefreshLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        parent.addView(refreshLayout, childIndex);
        loombusRefreshLayout = refreshLayout;
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
        if (destination != null && destination.startsWith("/") && !destination.startsWith("//")) {
            loadLoombusUrl("https://" + LOOMBUS_HOST + destination);
            intent.removeExtra(LOOMBUS_DESTINATION_EXTRA);
            return;
        }

        Uri data = intent.getData();
        if (
            data != null &&
            "https".equalsIgnoreCase(data.getScheme()) &&
            LOOMBUS_HOST.equalsIgnoreCase(data.getHost())
        ) {
            loadLoombusUrl(data.toString());
            intent.setData(null);
        }
    }

    private void loadLoombusUrl(String url) {
        getBridge().executeOnMainThread(() -> getBridge().getWebView().loadUrl(url));
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().goBack();
            return;
        }
        super.onBackPressed();
    }
}

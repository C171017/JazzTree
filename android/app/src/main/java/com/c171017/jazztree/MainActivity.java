package com.c171017.jazztree;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.SearchManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * Thin, offline Android host for the canonical JazzTree web experience.
 * Assets use an HTTPS-like origin so ES modules, fetch, and localStorage all
 * behave exactly as they do on the website without granting network access.
 */
public final class MainActivity extends Activity {
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + LOCAL_HOST + "/index.html";
    private static final String NETEASE_PACKAGE = "com.netease.cloudmusic";

    private WebView webView;
    private Api33BackCallback api33BackCallback;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(19, 17, 14));
        getWindow().setNavigationBarColor(Color.rgb(19, 17, 14));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(19, 17, 14));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        applySystemBarInsets(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);

        webView.setWebViewClient(new LocalContentClient(getAssets()));
        setContentView(webView);

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(START_URL);
        }

        if (Build.VERSION.SDK_INT >= 33) {
            api33BackCallback = new Api33BackCallback(this);
            api33BackCallback.setEnabled(true);
        }
    }

    private void applySystemBarInsets(View view) {
        view.setOnApplyWindowInsetsListener((target, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                );
                target.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                target.setPadding(
                    insets.getSystemWindowInsetLeft(),
                    insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(),
                    insets.getSystemWindowInsetBottom()
                );
            }
            return insets;
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (Build.VERSION.SDK_INT < 33) handleBack();
        else super.onBackPressed();
    }

    private void handleBack() {
        String script = "(function(){" +
            "if(typeof window.__jazztreeHandleBack==='function')return window.__jazztreeHandleBack();" +
            "const open=document.querySelector('.panel.is-open,.edge-pop:not([hidden])');" +
            "if(open){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));return true;}" +
            "return false;})()";
        webView.evaluateJavascript(script, result -> {
            if ("true".equals(result)) return;
            if (webView.canGoBack()) {
                webView.goBack();
            } else {
                if (api33BackCallback != null) api33BackCallback.setEnabled(false);
                super.onBackPressed();
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (api33BackCallback != null) {
            api33BackCallback.setEnabled(false);
            api33BackCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    private final class LocalContentClient extends WebViewClient {
        private final AssetManager assets;

        LocalContentClient(AssetManager assets) {
            this.assets = assets;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!"https".equals(uri.getScheme()) || !LOCAL_HOST.equals(uri.getHost())) return null;
            String path = uri.getPath();
            if (path == null || path.equals("/")) path = "/index.html";
            path = path.startsWith("/") ? path.substring(1) : path;
            if (path.contains("..") || path.contains("\\")) return response(403, "Forbidden");

            try {
                InputStream stream = assets.open(path, AssetManager.ACCESS_STREAMING);
                String extension = MimeTypeMap.getFileExtensionFromUrl(path);
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                if (mime == null) mime = fallbackMime(extension);
                return new WebResourceResponse(mime, isText(mime) ? "UTF-8" : null, stream);
            } catch (IOException missing) {
                return response(404, "Not found");
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if ("https".equals(uri.getScheme()) && LOCAL_HOST.equals(uri.getHost())) return false;
            if (!request.isForMainFrame()) return true;
            String netEaseQuery = netEaseSearchQuery(uri);
            if (netEaseQuery != null) {
                openNetEaseSearch(netEaseQuery, uri);
                return true;
            }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException unavailable) {
                Toast.makeText(MainActivity.this, uri.toString(), Toast.LENGTH_LONG).show();
            }
            return true;
        }

        private String netEaseSearchQuery(Uri uri) {
            String host = uri.getHost();
            if (host == null || !(host.equals("music.163.com") || host.equals("y.music.163.com"))) return null;
            String query = uri.getQueryParameter("s");
            if (query != null && !query.trim().isEmpty()) return query;
            String fragment = uri.getFragment();
            if (fragment == null) return null;
            int question = fragment.indexOf('?');
            if (question < 0 || question == fragment.length() - 1) return null;
            Uri parameters = Uri.parse("https://local.invalid/?" + fragment.substring(question + 1));
            query = parameters.getQueryParameter("s");
            return query == null || query.trim().isEmpty() ? null : query;
        }

        private void openNetEaseSearch(String query, Uri webFallback) {
            Uri appUri = Uri.parse("orpheus://search?keyword=" + Uri.encode(query));
            Intent deepLink = new Intent(Intent.ACTION_VIEW, appUri)
                .setPackage(NETEASE_PACKAGE)
                .addCategory(Intent.CATEGORY_BROWSABLE);
            if (launchIfAvailable(deepLink)) return;

            Intent platformSearch = new Intent(Intent.ACTION_SEARCH)
                .setPackage(NETEASE_PACKAGE)
                .putExtra(SearchManager.QUERY, query);
            if (launchIfAvailable(platformSearch)) return;

            Intent claimedWebLink = new Intent(Intent.ACTION_VIEW, webFallback)
                .setPackage(NETEASE_PACKAGE)
                .addCategory(Intent.CATEGORY_BROWSABLE);
            if (launchIfAvailable(claimedWebLink)) return;

            try {
                startActivity(new Intent(Intent.ACTION_VIEW, webFallback));
            } catch (ActivityNotFoundException unavailable) {
                Toast.makeText(MainActivity.this, webFallback.toString(), Toast.LENGTH_LONG).show();
            }
        }

        private boolean launchIfAvailable(Intent intent) {
            if (intent.resolveActivity(getPackageManager()) == null) return false;
            try {
                startActivity(intent);
                return true;
            } catch (ActivityNotFoundException unavailable) {
                return false;
            }
        }

        private WebResourceResponse response(int status, String message) {
            return new WebResourceResponse(
                "text/plain", "UTF-8", status, message, Collections.emptyMap(),
                new ByteArrayInputStream(message.getBytes(StandardCharsets.UTF_8))
            );
        }

        private String fallbackMime(String extension) {
            if ("js".equals(extension) || "mjs".equals(extension)) return "text/javascript";
            if ("json".equals(extension)) return "application/json";
            if ("md".equals(extension)) return "text/plain";
            return "application/octet-stream";
        }

        private boolean isText(String mime) {
            return mime.startsWith("text/") || mime.equals("application/json") || mime.contains("javascript");
        }

    }

    @android.annotation.TargetApi(33)
    private static final class Api33BackCallback {
        private final MainActivity activity;
        private final android.window.OnBackInvokedCallback callback;
        private boolean registered;

        Api33BackCallback(MainActivity activity) {
            this.activity = activity;
            callback = activity::handleBack;
        }

        void setEnabled(boolean enabled) {
            if (enabled == registered) return;
            if (enabled) {
                activity.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    callback
                );
            } else {
                activity.getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(callback);
            }
            registered = enabled;
        }
    }
}

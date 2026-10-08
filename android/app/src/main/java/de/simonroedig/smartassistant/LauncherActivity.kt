package de.simonroedig.smartassistant

import android.annotation.SuppressLint
import android.app.SearchManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.LauncherApps
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.UserHandle
import android.provider.Settings
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.content.edit
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import kotlin.math.max

/**
 * The home screen: the dashboard (the same web app as on the wall display and
 * in the browser) in a WebView, plus what only a launcher can do – list and
 * open the installed apps, search the web in Firefox, update itself.
 */
class LauncherActivity : ComponentActivity() {
    private lateinit var root: FrameLayout
    private lateinit var webView: WebView
    private lateinit var apps: AppRepository
    private lateinit var bridge: Bridge
    private val dashboard: Uri = Uri.parse(BuildConfig.DASHBOARD_URL)
    private val prefs by lazy { getSharedPreferences("launcher", MODE_PRIVATE) }

    private val packageCallback = object : LauncherApps.Callback() {
        override fun onPackageRemoved(packageName: String, user: UserHandle) = appsChanged()
        override fun onPackageAdded(packageName: String, user: UserHandle) = appsChanged()
        override fun onPackageChanged(packageName: String, user: UserHandle) = appsChanged()
        override fun onPackagesAvailable(packageNames: Array<out String>, user: UserHandle, replacing: Boolean) =
            appsChanged()
        override fun onPackagesUnavailable(packageNames: Array<out String>, user: UserHandle, replacing: Boolean) =
            appsChanged()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val background = prefs.getInt("background", Color.parseColor("#060913"))
        applySystemBars(prefs.getBoolean("dark", true))

        root = FrameLayout(this).apply { setBackgroundColor(background) }
        webView = WebView(this).apply { setBackgroundColor(background) }
        root.addView(webView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        setContentView(root)

        // The page stays clear of the status bar, the gesture bar and the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, max(bars.bottom, keyboard.bottom))
            WindowInsetsCompat.CONSUMED
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            setSupportZoom(false)
            builtInZoomControls = false
            textZoom = 100
            allowFileAccess = false
            allowContentAccess = false
            userAgentString = "$userAgentString SmartAssistantLauncher/${BuildConfig.VERSION_NAME}"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme == dashboard.scheme && url.host == dashboard.host) return false
                // Everything else (links, mail, phone numbers) opens in its own app.
                openExternal(Intent(Intent.ACTION_VIEW, url))
                return true
            }
        }

        apps = AppRepository(this)
        bridge = Bridge(this, apps)
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            // Only the dashboard itself gets the launcher functions – no other page.
            val origin = "${dashboard.scheme}://${dashboard.host}"
            WebViewCompat.addWebMessageListener(webView, "SmartLauncher", setOf(origin), bridge)
        }
        UpdateStatus.listener = { status -> bridge.send(JSONObject().put("type", "updateStatus").put("status", status)) }
        apps.launcherApps.registerCallback(packageCallback, Handler(Looper.getMainLooper()))

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                // Back walks back in the dashboard (closing sheets first); a home screen never "exits".
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) webView.goBack()
                }
            },
        )

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(BuildConfig.DASHBOARD_URL)
        }
    }

    /** The home button (or gesture) while the launcher is open or comes back: show the home screen. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.action == Intent.ACTION_MAIN && intent.hasCategory(Intent.CATEGORY_HOME)) {
            bridge.send(JSONObject().put("type", "home"))
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        apps.launcherApps.unregisterCallback(packageCallback)
        UpdateStatus.listener = null
        webView.destroy()
        super.onDestroy()
    }

    private fun appsChanged() {
        bridge.send(JSONObject().put("type", "appsChanged"))
    }

    /** The dashboard's background and light/dark theme, so the status bar blends in. */
    fun applyTheme(color: String, dark: Boolean) {
        val parsed = runCatching { Color.parseColor(color) }.getOrNull() ?: return
        root.setBackgroundColor(parsed)
        webView.setBackgroundColor(parsed)
        applySystemBars(dark)
        prefs.edit {
            putInt("background", parsed)
            putBoolean("dark", dark)
        }
    }

    private fun applySystemBars(dark: Boolean) {
        val style =
            if (dark) {
                SystemBarStyle.dark(Color.TRANSPARENT)
            } else {
                SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
            }
        enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    }

    /** Searches the web in Firefox (with its own search engine); without a query it just opens Firefox. */
    fun webSearch(query: String) {
        val text = query.trim()
        val firefox = "org.mozilla.firefox"
        val google = Uri.parse("https://www.google.com/search?q=${Uri.encode(text)}")
        val attempts =
            if (text.isEmpty()) {
                listOfNotNull(packageManager.getLaunchIntentForPackage(firefox))
            } else {
                listOf(
                    Intent(Intent.ACTION_WEB_SEARCH).putExtra(SearchManager.QUERY, text).setPackage(firefox),
                    Intent(Intent.ACTION_VIEW, google).setPackage(firefox),
                    Intent(Intent.ACTION_VIEW, google),
                )
            }
        for (intent in attempts) {
            if (openExternal(intent)) return
        }
    }

    /** The system's choice of home app (to make this one the default). */
    fun openHomeSettings() {
        openExternal(Intent(Settings.ACTION_HOME_SETTINGS))
    }

    private fun openExternal(intent: Intent): Boolean =
        try {
            startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (_: ActivityNotFoundException) {
            false
        }
}

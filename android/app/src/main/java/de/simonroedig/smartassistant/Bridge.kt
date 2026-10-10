package de.simonroedig.smartassistant

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Messages between the dashboard (`window.SmartLauncher`) and the launcher.
 * The page sends `{id, type, …}`; answers carry the same `id`. Events from the
 * launcher (`home`, `appsChanged`, `updateStatus`) have no id.
 */
class Bridge(
    private val activity: LauncherActivity,
    private val apps: AppRepository,
) : WebViewCompat.WebMessageListener {
    private val main = Handler(Looper.getMainLooper())
    private val background = Executors.newSingleThreadExecutor()
    private val updater = Updater(activity)
    private val recent = RecentApps(activity)
    private var page: JavaScriptReplyProxy? = null

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy,
    ) {
        if (!isMainFrame) return
        page = replyProxy
        val request = message.data?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return
        val id = request.optString("id")
        when (request.optString("type")) {
            "hello" ->
                reply(
                    id,
                    JSONObject()
                        .put("version", BuildConfig.VERSION_CODE)
                        .put("versionName", BuildConfig.VERSION_NAME)
                        // What this version can do beyond the basics (older ones don't say).
                        .put("features", JSONArray(listOf("recent"))),
                )
            "apps" -> background.execute {
                val list = runCatching { apps.list() }.getOrNull()
                main.post { reply(id, JSONObject().put("apps", list)) }
            }
            "recent" -> background.execute {
                val allowed = recent.allowed()
                val list = if (allowed) runCatching { recent.list() }.getOrNull() else null
                main.post { reply(id, JSONObject().put("allowed", allowed).put("apps", list ?: JSONArray())) }
            }
            "usageAccess" -> {
                activity.openUsageAccess()
                reply(id, JSONObject().put("ok", true))
            }
            "launch" -> reply(id, JSONObject().put("ok", apps.launch(request.optString("app"))))
            "appInfo" -> reply(id, JSONObject().put("ok", apps.showInfo(request.optString("app"))))
            "search" -> {
                activity.webSearch(request.optString("query"))
                reply(id, JSONObject().put("ok", true))
            }
            "theme" -> {
                activity.applyTheme(request.optString("color"), request.optBoolean("dark"))
                reply(id, JSONObject().put("ok", true))
            }
            "homeSettings" -> {
                activity.openHomeSettings()
                reply(id, JSONObject().put("ok", true))
            }
            "update" -> {
                updater.install()
                reply(id, JSONObject().put("ok", true))
            }
        }
    }

    /** An event for the page (ignored until the page has said hello). */
    fun send(event: JSONObject) {
        main.post { page?.postMessage(event.toString()) }
    }

    private fun reply(id: String, data: JSONObject) {
        if (id.isEmpty()) return
        page?.postMessage(data.put("id", id).toString())
    }
}

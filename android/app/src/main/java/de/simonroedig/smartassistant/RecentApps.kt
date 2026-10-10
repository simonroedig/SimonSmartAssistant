package de.simonroedig.smartassistant

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import androidx.core.content.edit
import org.json.JSONArray

/**
 * The apps you used last, newest first – from the system's usage statistics,
 * which a launcher may read once "Usage data access" is allowed for it. (The
 * system's own recents screen, with its previews and closing, is reserved for
 * the system itself.)
 */
class RecentApps(private val context: Context) {
    private val usage: UsageStatsManager = context.getSystemService(UsageStatsManager::class.java)
    private val appOps: AppOpsManager = context.getSystemService(AppOpsManager::class.java)
    private val prefs = context.getSharedPreferences("launcher", Context.MODE_PRIVATE)

    fun allowed(): Boolean =
        appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName) ==
            AppOpsManager.MODE_ALLOWED

    /** Package names, newest first: the apps that came to the front in the last days (since the last clearing). */
    fun list(limit: Int = 24): JSONArray {
        val now = System.currentTimeMillis()
        val since = maxOf(now - WINDOW_MS, prefs.getLong(CLEARED_KEY, 0L))
        val last = HashMap<String, Long>()
        val events = usage.queryEvents(since, now) ?: return JSONArray()
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) last[event.packageName] = event.timeStamp
        }
        // Not this launcher, not the system's home screen.
        last.remove(context.packageName)
        homeApps().forEach { last.remove(it) }
        return JSONArray(last.entries.sortedByDescending { it.value }.take(limit).map { it.key })
    }

    /**
     * Starts the list afresh: only apps used from now on. (Closing other apps
     * themselves is reserved for the system since Android 14.)
     */
    fun clear() {
        prefs.edit { putLong(CLEARED_KEY, System.currentTimeMillis()) }
    }

    private fun homeApps(): List<String> =
        runCatching {
            context.packageManager
                .queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)
                .map { it.activityInfo.packageName }
        }.getOrDefault(emptyList())

    private companion object {
        const val WINDOW_MS = 3L * 24 * 60 * 60 * 1000
        const val CLEARED_KEY = "recentClearedAt"
    }
}

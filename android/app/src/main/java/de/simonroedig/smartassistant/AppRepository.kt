package de.simonroedig.smartassistant

import android.content.ComponentName
import android.content.Context
import android.content.pm.LauncherActivityInfo
import android.content.pm.LauncherApps
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.UserHandle
import android.os.UserManager
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentHashMap

/** The installed apps that can be opened, with their icons (as small images for the page). */
class AppRepository(private val context: Context) {
    val launcherApps: LauncherApps = context.getSystemService(LauncherApps::class.java)
    private val users: UserManager = context.getSystemService(UserManager::class.java)
    private val icons = ConcurrentHashMap<String, String>()

    /** `[{id, label, package, icon}]` – the icon as a data URL. */
    fun list(): JSONArray {
        val result = JSONArray()
        for (user in launcherApps.profiles) {
            if (!isShown(user)) continue
            val activities = runCatching { launcherApps.getActivityList(null, user) }.getOrDefault(emptyList())
            for (info in activities) {
                val packageName = info.componentName.packageName
                if (packageName == context.packageName) continue
                val id = idOf(info.componentName, user)
                // A new APK (update) gets a new path, so its icon is drawn again.
                val iconKey = "$id@${info.applicationInfo.sourceDir}"
                val icon = icons.getOrPut(iconKey) { encode(info) }
                result.put(
                    JSONObject()
                        .put("id", id)
                        .put("label", info.label.toString())
                        .put("package", packageName)
                        .put("icon", icon),
                )
            }
        }
        return result
    }

    /** An app for the native offline screen. */
    class Entry(val id: String, val label: String, private val info: LauncherActivityInfo) {
        private var drawable: android.graphics.drawable.Drawable? = null

        fun icon() = drawable ?: info.getBadgedIcon(0).also { drawable = it }
    }

    /** The same apps as `list()`, A–Z, for native use. */
    fun entries(): List<Entry> =
        launcherApps.profiles
            .filter { isShown(it) }
            .flatMap { user ->
                runCatching { launcherApps.getActivityList(null, user) }.getOrDefault(emptyList()).map { info -> info to user }
            }.filter { (info, _) -> info.componentName.packageName != context.packageName }
            .map { (info, user) -> Entry(idOf(info.componentName, user), info.label.toString(), info) }
            .sortedBy { it.label.lowercase() }

    fun launch(id: String): Boolean {
        val (component, user) = find(id) ?: return false
        return runCatching { launcherApps.startMainActivity(component, user, null, null) }.isSuccess
    }

    fun showInfo(id: String): Boolean {
        val (component, user) = find(id) ?: return false
        return runCatching { launcherApps.startAppDetailsActivity(component, user, null, null) }.isSuccess
    }

    /** The phone's own apps and a work profile – not a locked/paused profile or the private space. */
    private fun isShown(user: UserHandle): Boolean {
        if (user == android.os.Process.myUserHandle()) return true
        if (users.isQuietModeEnabled(user)) return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            val type = runCatching { launcherApps.getLauncherUserInfo(user)?.userType }.getOrNull()
            if (type == null || type == UserManager.USER_TYPE_PROFILE_PRIVATE) return false
        }
        return true
    }

    private fun idOf(component: ComponentName, user: UserHandle) =
        "${component.flattenToShortString()}|${users.getSerialNumberForUser(user)}"

    /** Only apps that are really installed can be started this way. */
    private fun find(id: String): Pair<ComponentName, UserHandle>? {
        val parts = id.split("|")
        if (parts.size != 2) return null
        val component = ComponentName.unflattenFromString(parts[0]) ?: return null
        val user = parts[1].toLongOrNull()?.let { users.getUserForSerialNumber(it) } ?: return null
        val exists = launcherApps.getActivityList(component.packageName, user).any { it.componentName == component }
        return if (exists) component to user else null
    }

    private fun encode(info: LauncherActivityInfo): String {
        val size = 128
        val drawable = info.getBadgedIcon(0)
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        drawable.setBounds(0, 0, size, size)
        drawable.draw(Canvas(bitmap))
        val out = ByteArrayOutputStream()
        val (format, mime) =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Bitmap.CompressFormat.WEBP_LOSSY to "image/webp"
            } else {
                Bitmap.CompressFormat.PNG to "image/png"
            }
        bitmap.compress(format, 90, out)
        bitmap.recycle()
        return "data:$mime;base64,${Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)}"
    }
}

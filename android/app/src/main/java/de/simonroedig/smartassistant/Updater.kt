package de.simonroedig.smartassistant

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.IntentCompat
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/** Where the update's progress is reported (the dashboard shows it). */
object UpdateStatus {
    @Volatile var listener: ((String) -> Unit)? = null

    fun report(status: String) {
        listener?.invoke(status)
    }
}

/**
 * Self-update: downloads the newest APK from the dashboard's server and hands
 * it to the system installer. Android checks that it is signed with the same
 * key as this app and asks before installing.
 */
class Updater(private val activity: Activity) {
    fun install() {
        if (!activity.packageManager.canRequestPackageInstalls()) {
            // Once: allow this app to install its own updates.
            UpdateStatus.report("permission")
            activity.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")),
            )
            return
        }
        UpdateStatus.report("downloading")
        thread(name = "launcher-update") {
            try {
                val connection = URL("${BuildConfig.DASHBOARD_URL}/launcher/smart-assistant.apk").openConnection() as HttpURLConnection
                connection.connectTimeout = 15_000
                connection.readTimeout = 60_000
                if (connection.responseCode != HttpURLConnection.HTTP_OK) error("HTTP ${connection.responseCode}")
                val installer = activity.packageManager.packageInstaller
                val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
                params.setAppPackageName(activity.packageName)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
                }
                val sessionId = installer.createSession(params)
                installer.openSession(sessionId).use { session ->
                    session.openWrite("update.apk", 0, -1).use { out ->
                        connection.inputStream.use { it.copyTo(out) }
                        session.fsync(out)
                    }
                    val flags =
                        PendingIntent.FLAG_UPDATE_CURRENT or
                            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
                    val callback =
                        PendingIntent.getBroadcast(
                            activity,
                            sessionId,
                            Intent(activity, InstallReceiver::class.java),
                            flags,
                        )
                    session.commit(callback.intentSender)
                }
                UpdateStatus.report("installing")
            } catch (e: Exception) {
                UpdateStatus.report("failed")
            }
        }
    }
}

/** The installer's answers: ask the user to confirm, or report the outcome. */
class InstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirm = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_INTENT, Intent::class.java)
                if (confirm != null) {
                    context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }
            }
            PackageInstaller.STATUS_SUCCESS -> UpdateStatus.report("installed")
            else -> UpdateStatus.report("failed")
        }
    }
}

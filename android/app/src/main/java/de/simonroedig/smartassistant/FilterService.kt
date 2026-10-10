package de.simonroedig.smartassistant

import android.accessibilityservice.AccessibilityService
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast

/**
 * The app filter: when an app the user chose to block comes to the front, it
 * sends the phone back to the home screen. It reads only which app is in front
 * (never anything inside it), matches on the device, and sends nothing anywhere.
 *
 * It needs the accessibility permission, granted by hand (as with usage access,
 * "Restricted settings" must be allowed first on Android 13+). A launcher can't
 * uninstall or truly lock an app, so this is a self-limit, not a parental lock.
 */
class FilterService : AccessibilityService() {
    private var lastBlockedAt = 0L

    override fun onServiceConnected() {
        AppFilter.ensureLoaded(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg == packageName || pkg !in AppFilter.blocked) return
        val now = SystemClock.uptimeMillis()
        if (now - lastBlockedAt < COOLDOWN_MS) return
        lastBlockedAt = now
        performGlobalAction(GLOBAL_ACTION_HOME)
        Toast.makeText(this, "App blocked", Toast.LENGTH_SHORT).show()
    }

    override fun onInterrupt() {}

    private companion object {
        const val COOLDOWN_MS = 1200L
    }
}

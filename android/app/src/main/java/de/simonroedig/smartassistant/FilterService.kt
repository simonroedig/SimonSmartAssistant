package de.simonroedig.smartassistant

import android.accessibilityservice.AccessibilityService
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Toast
import java.util.Locale

/**
 * The NSFW filter: watches only the browsers, reads the address bar and the
 * search box (not the whole page), and sends the phone home when it lands on a
 * blocked site or search. Everything is matched on the device against the local
 * list – nothing read here is ever sent anywhere.
 *
 * It needs the accessibility permission, which the user grants by hand (as with
 * usage access, "Restricted settings" must be allowed first on Android 13+).
 */
class FilterService : AccessibilityService() {
    private var lastCheck = 0L
    private var lastBlockedAt = 0L

    override fun onServiceConnected() {
        ContentFilter.ensureReady(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        // Only the browsers (the service is already limited to them, but stay safe).
        if (event.packageName?.toString() !in BROWSERS) return
        // At most a few times a second, whatever the browser reports.
        val now = SystemClock.uptimeMillis()
        if (now - lastCheck < THROTTLE_MS) return
        lastCheck = now

        val root = rootInActiveWindow ?: return
        val hit = runCatching { scan(root) }.getOrDefault(false)
        if (hit && now - lastBlockedAt > BLOCK_COOLDOWN_MS) {
            lastBlockedAt = now
            performGlobalAction(GLOBAL_ACTION_HOME)
            Toast.makeText(this, "Blocked", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onInterrupt() {}

    /**
     * Looks at the editable fields (the address bar, a search box) and the URL
     * texts, extracts the host from each, and checks the host list and the search
     * words. Capped so it stays cheap.
     */
    private fun scan(root: AccessibilityNodeInfo): Boolean {
        val stack = ArrayDeque<AccessibilityNodeInfo>()
        stack.addLast(root)
        var seen = 0
        while (stack.isNotEmpty() && seen < MAX_NODES) {
            val node = stack.removeLast()
            seen++
            val editable = node.isEditable
            val text = node.text?.toString()
            if (!text.isNullOrBlank() && (editable || text.contains("."))) {
                val host = hostOf(text)
                if (host != null && ContentFilter.blocksHost(host)) return true
                // Only what was typed into a field (a search / the address bar), not page text.
                if (editable && ContentFilter.blocksText(text)) return true
            }
            for (i in 0 until node.childCount) node.getChild(i)?.let { stack.addLast(it) }
        }
        return false
    }

    /** The host of a URL or a bare domain in the text, else null. */
    private fun hostOf(text: String): String? {
        val token = text.trim().substringBefore(' ')
        val match = HOST.find(token) ?: return null
        return match.groupValues[1].lowercase(Locale.ROOT)
    }

    private companion object {
        const val THROTTLE_MS = 400L
        const val BLOCK_COOLDOWN_MS = 1500L
        const val MAX_NODES = 400
        val HOST = Regex("""(?:https?://)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})""", RegexOption.IGNORE_CASE)
        val BROWSERS =
            setOf(
                "org.mozilla.firefox",
                "org.mozilla.firefox_beta",
                "com.android.chrome",
                "com.chrome.beta",
                "com.sec.android.app.sbrowser",
                "com.brave.browser",
                "com.duckduckgo.mobile.android",
                "com.opera.browser",
                "com.microsoft.emmx",
            )
    }
}

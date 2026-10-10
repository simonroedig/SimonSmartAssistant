package de.simonroedig.smartassistant

import android.content.Context
import androidx.core.content.edit

/**
 * The apps the user chose to block (a self-limit), kept on the phone. The
 * accessibility service reads this set; the dashboard's settings change it.
 */
object AppFilter {
    @Volatile
    var blocked: Set<String> = emptySet()
        private set

    private var loaded = false

    fun ensureLoaded(context: Context) {
        if (loaded) return
        blocked =
            context
                .getSharedPreferences("launcher", Context.MODE_PRIVATE)
                .getStringSet("blockedApps", emptySet())
                ?.toSet()
                ?: emptySet()
        loaded = true
    }

    fun set(context: Context, packages: Set<String>) {
        blocked = packages
        loaded = true
        context.getSharedPreferences("launcher", Context.MODE_PRIVATE).edit {
            putStringSet("blockedApps", packages)
        }
    }
}

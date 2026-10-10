package de.simonroedig.smartassistant

import android.content.Context
import androidx.core.content.edit
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.concurrent.thread

/**
 * The NSFW filter's block list, kept and matched entirely on the phone. The list
 * of domains (Hagezi's public nsfw.txt) is downloaded once, cached, and refreshed
 * now and then; nothing about what is opened or searched ever leaves the device –
 * the check is a lookup in this set.
 */
object ContentFilter {
    // Hagezi "nsfw" (adult sites), the same kind of list a Pi-hole uses.
    private const val SOURCE = "https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/nsfw.txt"
    private const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000
    private const val CACHE_FILE = "nsfw-domains.txt"
    // A short, deliberate set of words – only for what is typed into a search or the address bar.
    private val SEARCH_WORDS = listOf("porn", "xxx", "hentai", "nsfw", "nude", "nudes", "sex video", "camgirl")

    @Volatile private var domains: Set<String> = emptySet()
    @Volatile private var loaded = false

    /** Loads the cached list into memory (once) and refreshes it if it's missing or old. */
    fun ensureReady(context: Context) {
        if (!loaded) {
            domains = readCache(context)
            loaded = true
        }
        val prefs = context.getSharedPreferences("launcher", Context.MODE_PRIVATE)
        val updatedAt = prefs.getLong("filterUpdatedAt", 0L)
        if (domains.isEmpty() || System.currentTimeMillis() - updatedAt > MAX_AGE_MS) refresh(context)
    }

    /** A blocked host (or one of its parent domains is on the list). */
    fun blocksHost(host: String): Boolean {
        if (domains.isEmpty()) return false
        var name = host.lowercase(Locale.ROOT).removeSuffix(".")
        if (name.startsWith("www.")) name = name.substring(4)
        while (name.isNotEmpty()) {
            if (name in domains) return true
            val dot = name.indexOf('.')
            if (dot < 0) break
            name = name.substring(dot + 1)
        }
        return false
    }

    /** A blocked word in what was typed (a search term, the address bar). */
    fun blocksText(text: String): Boolean {
        val hay = text.lowercase(Locale.ROOT)
        return SEARCH_WORDS.any { hay.contains(it) }
    }

    /** Downloads the list again in the background; keeps the old one if the fetch fails. */
    fun refresh(context: Context) {
        val prefs = context.getSharedPreferences("launcher", Context.MODE_PRIVATE)
        if (prefs.getBoolean("filterFetching", false)) return
        prefs.edit { putBoolean("filterFetching", true) }
        thread(name = "nsfw-list") {
            val result =
                runCatching {
                    val connection = URL(SOURCE).openConnection() as HttpURLConnection
                    connection.connectTimeout = 15_000
                    connection.readTimeout = 60_000
                    if (connection.responseCode != HttpURLConnection.HTTP_OK) error("HTTP ${connection.responseCode}")
                    val parsed = connection.inputStream.bufferedReader().useLines { parse(it) }
                    if (parsed.size < 100) error("Only ${parsed.size} domains") // A broken or empty list: keep the old one.
                    parsed
                }
            result
                .onSuccess { parsed ->
                    File(context.filesDir, CACHE_FILE).writeText(parsed.joinToString("\n"))
                    domains = parsed
                    prefs.edit {
                        putLong("filterUpdatedAt", System.currentTimeMillis())
                        putInt("filterCount", parsed.size)
                        remove("filterError")
                        putBoolean("filterFetching", false)
                    }
                }
                .onFailure { error ->
                    prefs.edit {
                        putString("filterError", error.message ?: "failed")
                        putLong("filterCheckedAt", System.currentTimeMillis())
                        putBoolean("filterFetching", false)
                    }
                }
        }
    }

    /** Pulls the domains out of an adblock list (`||domain^`), ignoring comments and rules with a path. */
    private fun parse(lines: Sequence<String>): Set<String> {
        val out = HashSet<String>(60_000)
        for (raw in lines) {
            val line = raw.trim()
            if (line.isEmpty() || line[0] == '!' || line[0] == '#') continue
            val match = ADBLOCK.matchEntire(line) ?: continue
            out.add(match.groupValues[1].lowercase(Locale.ROOT))
        }
        return out
    }

    private fun readCache(context: Context): Set<String> =
        runCatching {
            val file = File(context.filesDir, CACHE_FILE)
            if (!file.exists()) emptySet() else file.readLines().filter { it.isNotBlank() }.toHashSet()
        }.getOrDefault(emptySet())

    private val ADBLOCK = Regex("""\|\|([a-z0-9.-]+)\^""")
}

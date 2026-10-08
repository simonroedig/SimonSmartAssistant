package de.simonroedig.smartassistant

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.GridView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.concurrent.thread

/**
 * Shown instead of the dashboard when it can't be loaded (no connection, server
 * down): the apps still open from here, "Try again" reloads, and the home app
 * can be switched – so the phone is never stuck. Built natively, so it works
 * without the internet.
 */
class OfflineScreen(
    private val context: Context,
    private val apps: AppRepository,
    private val onRetry: () -> Unit,
    private val onHomeSettings: () -> Unit,
) {
    private val title = TextView(context)
    private val body = TextView(context)
    private val retry = TextView(context)
    private val switchHome = TextView(context)
    private val adapter = AppAdapter()
    val view: LinearLayout =
        LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            isClickable = true
            setPadding(dp(20), dp(28), dp(20), dp(12))
        }
    val isShown: Boolean get() = view.visibility == View.VISIBLE

    init {
        title.text = "You're offline"
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f)
        title.typeface = Typeface.DEFAULT_BOLD
        body.text = "The dashboard comes back by itself as soon as there's a connection. Your apps work as usual."
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        body.setPadding(0, dp(6), 0, dp(16))

        val buttons = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        styleButton(retry, "Try again") { onRetry() }
        styleButton(switchHome, "Change home app") { onHomeSettings() }
        buttons.addView(retry, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginEnd = dp(8) })
        buttons.addView(switchHome, LinearLayout.LayoutParams(0, dp(48), 1f))

        val grid =
            GridView(context).apply {
                numColumns = 4
                verticalSpacing = dp(14)
                stretchMode = GridView.STRETCH_COLUMN_WIDTH
                adapter = this@OfflineScreen.adapter
                setPadding(0, dp(20), 0, 0)
                clipToPadding = false
                setOnItemClickListener { _, _, position, _ -> apps.launch(this@OfflineScreen.adapter.getItem(position).id) }
                setOnItemLongClickListener { _, _, position, _ ->
                    apps.showInfo(this@OfflineScreen.adapter.getItem(position).id)
                    true
                }
            }

        view.addView(title)
        view.addView(body)
        view.addView(buttons)
        view.addView(grid, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
    }

    fun show(background: Int, dark: Boolean) {
        val text = if (dark) Color.parseColor("#EEF1FB") else Color.parseColor("#0E1424")
        val muted = if (dark) Color.parseColor("#A2ABC4") else Color.parseColor("#4A556D")
        view.setBackgroundColor(background)
        title.setTextColor(text)
        body.setTextColor(muted)
        adapter.textColor = text
        for (button in listOf(retry, switchHome)) {
            button.setTextColor(text)
            (button.background as GradientDrawable).setColor(if (dark) 0x1FFFFFFF else 0x140F172A)
        }
        view.visibility = View.VISIBLE
        thread(name = "offline-apps") {
            val entries = runCatching { apps.entries() }.getOrDefault(emptyList())
            view.post { adapter.update(entries) }
        }
    }

    fun hide() {
        view.visibility = View.GONE
    }

    private fun styleButton(button: TextView, label: String, onClick: () -> Unit) {
        button.text = label
        button.gravity = Gravity.CENTER
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        button.typeface = Typeface.DEFAULT_BOLD
        button.background = GradientDrawable().apply { cornerRadius = dp(16).toFloat() }
        button.setOnClickListener { onClick() }
    }

    private fun dp(value: Int) = (value * context.resources.displayMetrics.density).toInt()

    private inner class AppAdapter : BaseAdapter() {
        private var items: List<AppRepository.Entry> = emptyList()
        var textColor: Int = Color.WHITE

        fun update(entries: List<AppRepository.Entry>) {
            items = entries
            notifyDataSetChanged()
        }

        override fun getCount() = items.size

        override fun getItem(position: Int) = items[position]

        override fun getItemId(position: Int) = position.toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val item = items[position]
            val cell =
                (convertView as? LinearLayout) ?: LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER_HORIZONTAL
                    addView(ImageView(context), LinearLayout.LayoutParams(dp(52), dp(52)))
                    addView(
                        TextView(context).apply {
                            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                            gravity = Gravity.CENTER
                            maxLines = 2
                            setPadding(dp(2), dp(6), dp(2), 0)
                        },
                    )
                }
            (cell.getChildAt(0) as ImageView).setImageDrawable(item.icon())
            (cell.getChildAt(1) as TextView).apply {
                text = item.label
                setTextColor(textColor)
            }
            return cell
        }
    }
}

#!/usr/bin/env bash
# Smart Assistant – one-time setup of the Raspberry Pi wall display.
#
# Run on the Raspberry Pi (Raspberry Pi OS with desktop, Bookworm or newer):
#
#   curl -fsSL https://<your-app>.vercel.app/kiosk/setup.sh | bash -s -- https://<your-app>.vercel.app
#
# What it does:
#   1. installs Chromium (if missing) and curl
#   2. boots straight into the desktop with automatic login
#   3. disables screen blanking
#   4. starts the dashboard fullscreen after login (labwc autostart) and
#      restarts the browser automatically if it ever crashes
# Run it again at any time to change the URL.
set -euo pipefail

APP_URL="${1:-}"
if [ -z "$APP_URL" ]; then
  read -rp "Dashboard URL (e.g. https://my-dashboard.vercel.app): " APP_URL </dev/tty
fi
APP_URL="${APP_URL%/}"
DASHBOARD_URL="${APP_URL}/?kiosk=1"

echo "→ Installing packages"
sudo apt-get update -qq
if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
  sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
fi
sudo apt-get install -y curl

echo "→ Desktop auto-login and no screen blanking"
if command -v raspi-config >/dev/null 2>&1; then
  sudo raspi-config nonint do_boot_behaviour B4 || true
  sudo raspi-config nonint do_blanking 1 || true
fi

echo "→ Installing the launcher"
mkdir -p "${HOME}/.local/bin" "${HOME}/.config/smart-assistant" "${HOME}/.config/labwc"

cat > "${HOME}/.local/bin/smart-assistant-kiosk" <<'LAUNCHER'
#!/usr/bin/env bash
# Smart Assistant wall display launcher (started by ~/.config/labwc/autostart).
# Keeps Chromium running fullscreen and restarts it if it ever crashes.
set -u

CONFIG="${HOME}/.config/smart-assistant/kiosk.env"
# shellcheck source=/dev/null
[ -f "$CONFIG" ] && . "$CONFIG"

URL="${DASHBOARD_URL:?Set DASHBOARD_URL in ~/.config/smart-assistant/kiosk.env}"
PROFILE="${HOME}/.config/smart-assistant/chromium"
mkdir -p "$PROFILE"

BROWSER="$(command -v chromium || command -v chromium-browser || true)"
if [ -z "$BROWSER" ]; then
  echo "Chromium not found – install it with: sudo apt install chromium" >&2
  exit 1
fi

# Wait (up to 2 minutes) until the network and the dashboard are reachable.
BASE="${URL%%\?*}"
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null --max-time 3 "${BASE%/}/login"; then break; fi
  sleep 2
done

while true; do
  # Never show the "Chromium didn't shut down correctly" bar.
  PREFS="${PROFILE}/Default/Preferences"
  if [ -f "$PREFS" ]; then
    sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS"
  fi

  "$BROWSER" \
    --kiosk \
    --ozone-platform=wayland \
    --user-data-dir="$PROFILE" \
    --password-store=basic \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --disable-features=Translate,TranslateUI \
    --overscroll-history-navigation=0 \
    --disable-pinch \
    --check-for-update-interval=31536000 \
    "$URL"

  # Chromium exited or crashed – wait a moment and start it again.
  sleep 5
done
LAUNCHER
chmod +x "${HOME}/.local/bin/smart-assistant-kiosk"

cat > "${HOME}/.config/smart-assistant/kiosk.env" <<CONFIG
# Wall display settings – edit and reboot to apply.
DASHBOARD_URL="${DASHBOARD_URL}"
CONFIG

AUTOSTART="${HOME}/.config/labwc/autostart"
touch "$AUTOSTART"
if ! grep -q "smart-assistant-kiosk" "$AUTOSTART"; then
  echo "${HOME}/.local/bin/smart-assistant-kiosk &" >> "$AUTOSTART"
fi

echo
echo "✓ Done. Reboot with: sudo reboot"
echo "  The dashboard then opens fullscreen. Sign in once with your e-mail code"
echo "  (the built-in on-screen keyboard appears automatically) – it stays signed in."
echo "  Exit kiosk mode: plug in a keyboard and press Alt+F4, or connect via SSH."

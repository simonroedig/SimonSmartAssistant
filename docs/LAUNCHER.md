# Android-Launcher (Smart Assistant als Startbildschirm)

Die App im Ordner `android/` ist eine kleine native Hülle (Kotlin): Sie zeigt das Dashboard von
`https://simonsmartassistant.vercel.app` und macht es zum Startbildschirm des Handys. Dazu kommt, was nur
ein Launcher kann:

- **Home ↔ Apps:** Der Home-Tab unten schaltet zwischen Startbildschirm und allen Apps (A–Z) um.
- **App gedrückt halten:** öffnet die App-Info (deinstallieren, Berechtigungen …).
- **Suchen:** Auf dem Startbildschirm und in „Apps“ – Enter sucht im Web mit Firefox; in „Apps“ filtert
  das Feld beim Tippen die Apps.
- **Home-Geste / Home-Taste:** führt immer zurück zum Startbildschirm. **Zurück** schließt Fenster bzw.
  geht im Dashboard zurück – der Launcher selbst wird nie „beendet“.

Alles, was im Dashboard passiert, kommt wie bisher mit jedem Push auf `main` sofort aufs Handy. Nur wenn
sich `android/` ändert, baut GitHub eine neue App-Version; der Startbildschirm bietet sie dann zum
Installieren an.

## Einmalige Einrichtung

### 1. Passwort für den Signaturschlüssel (GitHub)

Jede App-Version muss mit demselben Schlüssel signiert sein, sonst lässt Android kein Update zu. Der
Schlüssel wird beim ersten Lauf automatisch erzeugt und **verschlüsselt** im Repo abgelegt
(`android/signing/release.jks.enc`); entschlüsselt wird er mit einem Passwort, das nur in GitHub liegt.

1. GitHub → Repo **SimonSmartAssistant** → **Settings → Secrets and variables → Actions**
2. **New repository secret**
   - Name: `ANDROID_KEYSTORE_PASSWORD`
   - Secret: ein langes, zufälliges Passwort (z. B. aus deinem Passwort-Manager, 30+ Zeichen)
3. Das Passwort zusätzlich im Passwort-Manager aufheben. Geht es verloren, braucht es einen neuen
   Schlüssel – dann die App einmal deinstallieren und neu installieren.

### 2. Erste Version bauen

GitHub → **Actions → Android launcher → Run workflow** (Branch `main`) → **Run workflow**.
Nach ca. 3 Minuten ist die App gebaut und liegt (nach dem automatischen Vercel-Deploy, ca. 1–2 Minuten
später) unter `https://simonsmartassistant.vercel.app/launcher/smart-assistant.apk`.

### 3. Auf dem Galaxy S25 installieren

1. Auf dem Handy das Dashboard im Browser öffnen → **Settings → Android launcher → Download**.
2. Die heruntergeladene Datei öffnen. Beim ersten Mal fragt Android, ob der Browser Apps installieren
   darf → **Einstellungen → Diese Quelle zulassen** → zurück → **Installieren**.
   - Falls Samsung die Installation blockiert: **Einstellungen → Sicherheit und Datenschutz →
     Auto Blocker** vorübergehend ausschalten (blockiert sonst auch die späteren Updates).
   - Warnt Play Protect („Unbekannte App“): **Weitere Details → Trotzdem installieren**.
3. **Smart Assistant** öffnen und wie gewohnt mit dem E-Mail-Code anmelden (Passkeys und Google-Login
   gehen in der App nicht; der Code bleibt der Weg).
4. Im Dashboard **Settings → Android launcher → Home app: Choose** → **Smart Assistant** wählen
   (alternativ: Einstellungen → Apps → Standard-Apps auswählen → Startbildschirm-App).

**One UI Home bleibt installiert** – dort kannst du jederzeit zurückwechseln (Einstellungen → Apps →
Standard-Apps auswählen → Startbildschirm-App).

## Updates

- **Dashboard (fast alles):** sofort nach jedem Push auf `main`, ganz ohne App-Update.
- **App selbst (`android/`):** GitHub baut die neue Version und legt sie auf Vercel ab. Auf dem
  Startbildschirm erscheint **„Launcher update 1.x – Install“**. Beim ersten Update fragt Android einmal,
  ob Smart Assistant Apps installieren darf → zulassen → nochmal **Install** → bestätigen.

## App-Filter (optional)

Eine Selbstlimitierung: Apps, die du in **Settings → Blocked apps** auswählst, werden geblockt –
**für immer**. Vor dem Blocken fragt die App einmal nach.

- **Entsperren geht nur in Supabase:** Die Liste liegt in der Tabelle `blocked_apps`. Die App darf dort
  nur hinzufügen, nicht ändern oder löschen (die Datenbank gibt ihr kein Recht dazu). Zum Entsperren im
  Supabase-Dashboard → **Table Editor → blocked_apps** die Zeile der App löschen; der Launcher übernimmt
  das sofort (Realtime).
- **Im Launcher** öffnet eine geblockte App nicht; sie steht in der App-Liste grau mit einem roten
  Verbots-Symbol, ein Tipp zeigt nur „… is blocked“.
- **Systemweit** (optional): ein Bedienungshilfen-Dienst wirft dich auf den **Home-Screen** zurück, sobald
  eine geblockte App in den Vordergrund kommt – egal, wie sie geöffnet wurde. Er liest **nur**, welche App
  gerade vorn ist, nie etwas aus der App, und sendet nichts.
- **Einschalten** des Dienstes: der Hinweis in **Blocked apps** öffnet die Bedienungshilfen. Auf Android
  13+ vorher einmal **„Eingeschränkte Einstellungen zulassen“** (⋮ auf der App-Seite), wie bei den
  Nutzungsdaten.
- **Grenzen:** Ein Launcher kann Apps nicht deinstallieren; der Dienst ist in den Android-Einstellungen
  abschaltbar. Also eine Selbstlimitierung, keine Kindersicherung.
- NSFW-Seiten regelst du über **Privates DNS** (`family.cloudflare-dns.com`, wirkt auch bei mobilen
  Daten) bzw. dein Pi-hole.
- Dateien: `supabase/migrations/…_blocked_apps.sql`, `src/data/blocked-apps.ts`, die Übergabe ans Handy in
  `src/components/launcher/launcher-sync.tsx`; im Launcher `AppFilter.kt` (die Pakete, die das Handy
  durchsetzt) und `FilterService.kt` (Bedienungshilfe: nur Fenster-Wechsel).

## Technik in Kürze

- `android/app/src/main/java/…/LauncherActivity.kt` – WebView, Home-Taste, Zurück, Tastatur/Statusleiste,
  Firefox-Suche.
- `Bridge.kt` – Nachrichten zwischen Dashboard und App. Nur die Dashboard-Adresse bekommt das Objekt
  `window.SmartLauncher` (`addWebMessageListener` mit fester Origin); fremde Seiten öffnen sich im Browser.
- `AppRepository.kt` – installierte Apps (inkl. Arbeitsprofil, ohne privaten Bereich) mit Icons; startet
  nur Apps, die wirklich installiert sind.
- `Updater.kt` – lädt `…/launcher/smart-assistant.apk` und übergibt sie dem System-Installer (Android
  prüft die Signatur und fragt nach).
- Web-Seite: `src/lib/launcher.ts`, `src/components/launcher/*`, Seite `/apps`.
- Workflow: `.github/workflows/android.yml` (baut bei Änderungen in `android/`, veröffentlicht nur von
  `main` und nur mit gesetztem Secret).

Kosten: unverändert 0 € – die App lädt dieselbe Seite, Supabase und Vercel bleiben weit unter den
Gratis-Limits.

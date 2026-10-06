# Einrichtung – Schritt für Schritt

Diese Anleitung bringt das Dashboard **kostenlos** online: Code auf GitHub → Datenbank bei Supabase →
Hosting bei Vercel → Wanddisplay am Raspberry Pi 5 → App auf dem Handy.
Zeitaufwand: ca. 30–45 Minuten. Alles, was du nur im Browser klicken kannst, steht hier exakt drin.

> **Kurz zur Sicherheit:** Deine Daten sind durch drei unabhängige Schichten geschützt –
> (1) nur deine E-Mail darf überhaupt ein Konto haben (Datenbank-Hook + Registrierung aus),
> (2) jede Zeile in der Datenbank ist per Row Level Security an deine User-ID gebunden,
> (3) die App selbst lässt nur E-Mails aus `ALLOWED_EMAILS` herein. Es wird **kein** geheimer Schlüssel
> im Code oder im Browser benötigt. Details: [Sicherheitsmodell](#8-sicherheitsmodell-und-optionale-extras).

---

## 0. Was du brauchst

| Dienst | Plan | Wofür |
| --- | --- | --- |
| GitHub | Free (hast du) | Code, automatische Deployments |
| Supabase | Free (hast du) | Datenbank, Login, Realtime-Sync |
| Vercel | Hobby (kostenlos) | Hosting der Web-App |
| Open-Meteo | kostenlos, kein Konto | Wetter (wird direkt vom Browser abgefragt) |
| Google Cloud | optional, kostenlos | „Mit Google anmelden" |
| Eigene Domain | optional, ~10 €/Jahr | nur für Cloudflare Access / Kamera später |

Aktiviere bitte **Zwei-Faktor-Authentifizierung** bei GitHub, Supabase und Vercel – wer diese Konten
übernimmt, käme sonst an alles heran.

---

## 1. Code in den `main`-Branch bringen

Der Code liegt im Branch `claude/pensive-mendel-1ktheu`. Supabase und Vercel deployen aus `main`.
Da das Repository noch leer war, gibt es noch keinen `main`-Branch:

1. GitHub → Repository **SimonSmartAssistant** → **Branches** (oder Dropdown oben links) →
   **New branch** → Name `main`, Quelle `claude/pensive-mendel-1ktheu` → **Create branch**.
2. **Settings → General → Default branch** → `main` auswählen → **Update**.

Ab jetzt gilt: Änderungen per Pull Request nach `main` mergen → Vercel und Supabase deployen automatisch.

---

## 2. Supabase einrichten

Öffne dein Projekt auf [supabase.com/dashboard](https://supabase.com/dashboard).

### 2.1 Datenbank-Schema per GitHub deployen

1. **Project Settings → Integrations → GitHub Integration**
   - Repository: `simonroedig/SimonSmartAssistant` (sollte schon verbunden sein)
   - **Working directory:** `.` (der Ordner `supabase/` liegt im Repo-Root)
   - **Deploy to production:** **an**, Production branch: `main`
   - „Automatic branching" kannst du aus lassen (Preview-Branches sind ein Pro-Feature).
2. Supabase wendet die Migration `supabase/migrations/20261006120000_init.sql` erst beim **nächsten
   Push nach `main`** an – nicht für Commits, die schon vor dem Einschalten der Integration da waren.
   Einfachster Auslöser: auf GitHub die Datei `changeToPushFile.txt` öffnen → Stift-Symbol → eine
   Zeile ändern → **Commit changes** direkt auf `main`. Im Commit erscheint dann der Check
   „Supabase Preview" bzw. die Migration unter **Database → Migrations**.
3. Kontrolle: **Table Editor** zeigt `user_settings`, `shopping_items`, `shopping_history`, `todos`,
   `plan_blocks`, `day_notes` – alle mit Schloss-Symbol (RLS aktiv).

> Falls die Integration hakt: **SQL Editor → New query**, den kompletten Inhalt der Migrationsdatei
> einfügen und **Run** klicken. Das Ergebnis ist identisch.

Die Migration vergibt Rechte explizit (`grant … to authenticated`). Es ist also egal, ob du beim Anlegen
„Automatically expose new tables" an- oder abgewählt hast – anonyme Zugriffe bekommen nie Rechte.

### 2.2 Nur deine E-Mail zulassen (Sicherheitsnetz)

1. **SQL Editor → New query**, ersetze die Adresse und klicke **Run**:
   ```sql
   insert into private.allowed_emails (email) values ('deine@mail.de');
   ```
   (Weitere Adressen einfach genauso hinzufügen. Groß-/Kleinschreibung egal, aber hier klein schreiben.)

   > Die Login-Adresse muss an **drei Stellen exakt gleich** sein: hier, beim Supabase-User (2.3) und in
   > `ALLOWED_EMAILS` bei Vercel (3). Vorsicht bei Punkten – `vorname.nachname@web.de` und
   > `vornamenachname@web.de` sind zwei verschiedene Postfächer. Kontrolle:
   > `select * from private.allowed_emails;`
2. **Authentication → Hooks → Add hook → „Before User Created"**
   - Hook type: **Postgres**
   - Schema: `public`, Function: `hook_before_user_created`
   - **Create / Enable**

Jetzt lehnt Supabase jede Registrierung ab, deren E-Mail nicht in dieser Liste steht.

### 2.3 Deinen Account anlegen und Registrierung schließen

1. **Authentication → Users → Add user → Create new user**
   - E-Mail: deine Adresse, Passwort: irgendein langes Zufallspasswort (wird nie benutzt)
   - **Auto Confirm User:** an → **Create user**
2. **Authentication → Sign In / Providers**
   - Unter „User Signups": **Allow new users to sign up → aus** → Save
   - Provider **Email** muss **aktiviert** bleiben.

### 2.4 E-Mail-Versand und Login-Code

Die App meldet dich mit einem 8-stelligen Code an (funktioniert auch auf dem Wanddisplay und in der
Handy-App). Dafür braucht es zwei Dinge: einen eigenen Mailserver (SMTP) und ein Mail-Template mit
dem Code.

**a) Eigener SMTP-Server – hier: dein web.de-Postfach**

Der eingebaute Supabase-Mailer schickt nur ~2 Mails pro Stunde und lässt das Template **nicht
bearbeiten** (Subject/Body ausgegraut), solange kein eigener SMTP-Server eingetragen ist. Dienste wie
Brevo oder Resend verlangen inzwischen eine **eigene Domain** als Absender – ohne Domain ist der
einfachste Weg, über das eigene web.de-Postfach zu senden:

1. **web.de → Einstellungen (Zahnrad) → POP3/IMAP Abruf:** „POP3 und IMAP Zugriff erlauben" an
   (schaltet auch SMTP frei; wer schon Thunderbird o. Ä. nutzt, hat das bereits).
2. **App-Passwort** (nötig bei aktivierter Zwei-Faktor-Authentifizierung, empfohlen sowieso):
   web.de → oben rechts Name → **Mein Account → Login & Sicherheit → App-Passwörter (für externe
   Apps) → App-Passwörter verwalten** → neues Passwort mit Namen `Supabase` erstellen und sofort
   kopieren (wird nur einmal angezeigt). Es lässt sich dort jederzeit einzeln widerrufen.
   *(Nicht verwechseln mit Postfach → Einstellungen → Sicherheit – das ist nur Spam-/Virenschutz.)*
3. **Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP:**

   | Feld | Wert |
   | --- | --- |
   | Sender email address | deine web.de-Adresse (muss genau das Postfach sein) |
   | Sender name | `Smart Assistant` |
   | Host | `smtp.web.de` |
   | Port number | `587` |
   | Minimum interval per user | `60` |
   | Username | deine web.de-Adresse |
   | Password | das App-Passwort aus Schritt 2 |

   → **Save changes**.

Andere Anbieter funktionieren genauso (GMX: `mail.gmx.net`, Port 587; Gmail: `smtp.gmail.com`,
Port 587, App-Passwort aus dem Google-Konto). Mit eigener Domain ginge auch Brevo/Resend.

**b) Template mit Code**

1. **Authentication → Emails → Templates → „Magic Link"** (bzw. „Magic link or OTP")
2. Subject: `Your Smart Assistant sign-in code`
3. Body (Source): den Inhalt von [`supabase/templates/magic_link.html`](../supabase/templates/magic_link.html)
   einfügen – entscheidend ist der Platzhalter `{{ .Token }}`.
4. Save. Die OTP-Länge muss **8** sein – das ist bei neuen Projekten Standard (Authentication → Sign In /
   Providers → Email → Email OTP Length). Die App erwartet genau so viele Ziffern (`src/lib/auth/otp.ts`).

Kommt beim Login kein Code an: Spam-Ordner prüfen, dann **Logs → Auth** in Supabase. „authentication
failed" heißt meist falsches App-Passwort oder POP3/IMAP nicht freigeschaltet. Nach dem ersten Login
kannst du Passkeys nutzen und brauchst kaum noch Mails.

### 2.5 URLs eintragen (nach Schritt 3, wenn du die Vercel-URL kennst)

**Authentication → URL Configuration**
- **Site URL:** `https://<dein-projekt>.vercel.app`
- **Redirect URLs → Add URL:** `https://<dein-projekt>.vercel.app/**`

### 2.6 Passkeys (Face ID / Fingerabdruck) – empfohlen

**Authentication → Passkeys → Enable Passkey authentication**
- Relying Party Display Name: `Smart Assistant`
- Relying Party ID: `<dein-projekt>.vercel.app` (ohne `https://`)
- Relying Party Origins: `https://<dein-projekt>.vercel.app`

Danach in der App unter **Settings → Sign-in & security → Add a passkey for this device**. Die
Login-Seite zeigt dann automatisch „Sign in with passkey". (Passkeys sind bei Supabase seit Mai 2026
als Beta verfügbar; der E-Mail-Code funktioniert immer als Fallback.)

### 2.7 Optional: „Mit Google anmelden"

1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt anlegen.
2. **Google Auth Platform → Branding:** App-Name, Support-Mail. **Audience:** External, dich selbst als
   Testnutzer hinzufügen.
3. **Clients → Create client → Web application**
   - Authorized JavaScript origins: `https://<dein-projekt>.vercel.app`
   - Authorized redirect URIs: `https://<projekt-ref>.supabase.co/auth/v1/callback`
     (steht in Supabase unter Authentication → Sign In / Providers → Google als „Callback URL")
4. Client-ID und Secret in Supabase unter **Authentication → Sign In / Providers → Google** eintragen
   und aktivieren. Die App blendet den Google-Button automatisch ein.

Da Registrierungen gesperrt sind, funktioniert Google nur mit der Google-Adresse, die zu deinem
Account passt (gleiche E-Mail wird automatisch verknüpft).

### 2.8 Werte für Vercel kopieren

- **Project URL:** steht nicht als eigene Zeile unter „API Keys". Entweder oben auf **Connect** klicken
  (Zeile `NEXT_PUBLIC_SUPABASE_URL=https://….supabase.co`) oder unter **Project Settings → General**
  die **Project ID** ablesen und `https://<Project ID>.supabase.co` daraus machen.
- **Publishable key:** **Project Settings → API Keys** → `sb_publishable_…` (darf öffentlich sein).

Den **Secret key** (`sb_secret_…`) brauchst du **nicht** – nirgends eintragen.

### 2.9 Gegencheck

**Advisors → Security Advisor** ausführen: Es sollten keine Warnungen zu RLS oder „exposed" Tabellen
für die App-Tabellen auftauchen.

---

## 3. Vercel einrichten

1. [vercel.com/signup](https://vercel.com/signup) → **Continue with GitHub** → Plan **Hobby**.
2. **Add New… → Project → Import** `SimonSmartAssistant` (ggf. Vercel GitHub-App für das Repo
   freigeben). Framework wird als **Next.js** erkannt – nichts ändern.
3. Projektname wählen – daraus wird die URL `https://<name>.vercel.app`.
4. **Environment Variables** (für Production, Preview und Development):

   | Name | Wert |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL aus 2.8 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key aus 2.8 |
   | `ALLOWED_EMAILS` | deine E-Mail (mehrere kommagetrennt) |
   | `CRON_SECRET` | langer Zufallswert, z. B. von `openssl rand -hex 32` |

5. **Deploy**. Danach: **Settings → Git → Production Branch** = `main` prüfen.
6. Zurück zu Supabase, Schritt **2.5** und **2.6** mit der echten URL ausfüllen.

Was automatisch passiert:
- Jeder Merge nach `main` deployt neu. Das Wanddisplay merkt das und lädt sich selbst neu.
- Ein täglicher **Vercel Cron** (`vercel.json`) ruft `/api/keepalive` auf, damit das kostenlose
  Supabase-Projekt nicht nach 7 Tagen Inaktivität pausiert wird (z. B. im Urlaub).
- Sicherheits-Header (CSP mit Nonce, HSTS, kein Einbetten in fremde Seiten, `noindex`) kommen aus der App.

Preview-Deployments (Pull Requests) sind standardmäßig per **Vercel Authentication** geschützt
(„Standard Protection") – so lassen.

---

## 4. Erster Login

1. Die **Production-URL** öffnen: Vercel → Projekt → **Overview → Domains**, z. B.
   `https://<dein-projekt>.vercel.app` (nicht die langen Deployment-URLs mit Zufallsteil – die sind
   per Vercel-Login geschützt). Dort → E-Mail eingeben → **Send me a code**.
2. Code aus der Mail eintippen → du bist drin. Die Sitzung bleibt bestehen (kein ständiges Neu-Anmelden).
3. **Settings:** Wetter-Ort suchen (z. B. „München"), Schlafenszeiten einstellen, ggf. Passkey hinzufügen.

---

## 5. Auf dem Handy als App

Die Web-App ist eine installierbare PWA (Vollbild, eigenes Icon, startet sofort mit den zuletzt
geladenen Daten):

- **Android (Chrome):** Seite öffnen → ⋮ → **App installieren** / „Zum Startbildschirm hinzufügen".
- **iPhone (Safari):** Teilen-Symbol → **Zum Home-Bildschirm**. Danach in der installierten App einmal
  per Code oder Passkey anmelden (iOS trennt die Anmeldung zwischen Safari und Home-Bildschirm-Apps).

Eine native App ist damit nicht nötig. Falls später Widgets oder Push gewünscht sind, kann man sie ergänzen.

---

## 6. Raspberry Pi 5 als Wanddisplay

### 6.1 System

1. **Raspberry Pi Imager** → *Raspberry Pi OS (64-bit)* **mit Desktop**. In den Imager-Einstellungen
   Benutzer, WLAN, Zeitzone `Europe/Berlin`, Tastatur `de` und **SSH** aktivieren.
2. Pi mit Touchmonitor starten, mit dem Netzwerk verbinden.

### 6.2 Kiosk-Modus mit einem Befehl

Im Terminal des Pi (oder per SSH):

```bash
curl -fsSL https://<dein-projekt>.vercel.app/kiosk/setup.sh | bash -s -- https://<dein-projekt>.vercel.app
sudo reboot
```

Das Skript ([`public/kiosk/setup.sh`](../public/kiosk/setup.sh)) installiert Chromium, aktiviert
Auto-Login in den Desktop, schaltet das Bildschirm-Abdunkeln des Systems aus und startet das Dashboard
nach jedem Boot im Vollbild (labwc-Autostart, Chromium wird bei einem Absturz automatisch neu gestartet).

Nach dem Neustart: einmal mit E-Mail-Code anmelden – die **eingebaute Bildschirmtastatur** (QWERTZ mit
Umlauten) erscheint automatisch, sobald ein Textfeld angetippt wird. Die URL enthält `?kiosk=1`, damit
schaltet die App auf diesem Gerät dauerhaft in den **Wandmodus**:

- kein Mauszeiger, keine versehentliche Textauswahl
- **Nachtmodus:** in deinen Schlafenszeiten wird nach 2 Minuten ohne Berührung eine ruhige, dunkle Uhr
  angezeigt; Antippen weckt das Dashboard (der Weck-Tipp löst nichts darunter aus)
- **Auto-Update:** nach einem neuen Deployment lädt die Seite sich selbst neu (wenn gerade niemand tippt),
  außerdem einmal nachts
- Bildschirm bleibt an (Wake Lock)

Feinjustieren am Pi unter **Settings → This device**: Textgröße (z. B. 110–120 % bei 20 Zoll),
Nachtmodus „At night/Always/Off", Verzögerung, „Reduce effects" falls die Animationen ruckeln.

Kiosk verlassen: Tastatur anstecken und **Alt+F4**, oder per SSH arbeiten. URL ändern: Skript erneut
ausführen oder `~/.config/smart-assistant/kiosk.env` bearbeiten und neu starten.

---

## 7. Lokale Entwicklung (optional)

Voraussetzungen: Node.js 22+, Docker.

```bash
npm install
npx supabase start          # lokale Supabase (DB, Auth, Realtime, Mail-Postfach unter :54324)
cp .env.example .env.local  # zeigt auf die lokale Supabase
node scripts/seed-demo.mjs  # Demodaten für dev@example.com
npm run dev                 # http://localhost:3000 – Login-Code steht im Postfach http://127.0.0.1:54324
```

Tests:

```bash
npm run lint && npm run typecheck && npm test      # schnell
npm run test:integration                           # RLS-/Auth-Sicherheitstests (lokale Supabase)
npm run build && npx playwright test               # End-to-End inkl. Realtime, Passkeys, Touch
```

Abhängigkeiten installieren am besten mit `npm ci` statt `npm install`. Eine `package-lock.json`, die
sich nur durch ein lokales `npm install` geändert hat, **nicht committen** – sonst bricht `npm ci` in
der GitHub-CI ab („package.json and package-lock.json … are not in sync"). Zurücksetzen mit
`git checkout -- package-lock.json`.

Schema ändern: neue Datei `supabase/migrations/<zeitstempel>_<name>.sql` anlegen (nie alte Migrationen
ändern), lokal mit `npx supabase db reset` prüfen, Typen mit `npm run db:types` aktualisieren, mergen –
Supabase wendet sie an.

---

## 8. Sicherheitsmodell und optionale Extras

**Wer kommt an deine Daten?** Niemand außer dir:

1. **Registrierung:** komplett deaktiviert; zusätzlich lehnt der Hook `hook_before_user_created` jede
   E-Mail außerhalb von `private.allowed_emails` ab (fail-closed).
2. **Daten:** jede Tabelle hat RLS mit `auth.uid() = user_id`; die Rolle `anon` hat keinerlei Rechte.
   Der Publishable Key im Browser ist dafür gedacht, öffentlich zu sein – er erlaubt ohne Login nichts.
   (Automatisch getestet: `tests/integration/security.test.ts`.)
3. **App:** der Proxy prüft das JWT bei jeder Anfrage, `ALLOWED_EMAILS` meldet fremde Konten sofort ab.
4. **Browser:** strenge Content-Security-Policy mit Nonce, keine fremden Skripte, kein Einbetten.

**Optional – zusätzliche Schranke vor der ganzen Seite:**

- **Vercel Authentication für Production** (seit 2026 kostenlos auf Hobby): Vercel → Project →
  Settings → Deployment Protection → **All Deployments**. Dann muss man zusätzlich bei Vercel
  eingeloggt sein. Achtung: Auf dem Wanddisplay und bei installierten Handy-Apps ist das umständlich
  (eigener Vercel-Login je Gerät). Für die Datensicherheit nicht nötig.
- **Cloudflare Access + eigene Domain** (~10 €/Jahr): Domain bei Cloudflare, auf Vercel zeigen lassen,
  in Cloudflare Zero Trust (Free, bis 50 Nutzer) eine Self-hosted Application mit Policy
  „Emails: deine@mail.de" anlegen. Sinnvoll vor allem später für **Kameras/Smart-Home-Geräte zu Hause**:
  die laufen dann über einen **Cloudflare Tunnel** (keine offenen Ports am Router) hinter derselben
  Access-Regel.

**Kosten:** Alles bleibt im Free-Tier (Supabase Free: 500 MB DB – für Listen/Planer reichen Jahre;
Vercel Hobby für private Nutzung; Open-Meteo für nicht-kommerzielle Nutzung).

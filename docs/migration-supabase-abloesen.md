# Migrationsplan: Supabase ablösen

Stand: 2026-09-04. Ziel: Finanzapp ohne Supabase betreiben, bei deutlich geringeren
laufenden Kosten und ohne Funktionsverlust für die zwei Nutzer.

---

## Umsetzungsstand (Stand 2026-09-04)

Die Phasen 1-5 sind im Code umgesetzt, `next build` läuft durch. Was noch offen ist,
lässt sich nicht aus dem Repository heraus erledigen:

| Phase | Stand |
|---|---|
| 0 Zielanbieter, DB anlegen | Railway-Postgres im Projekt FinanzAPP steht; `DATABASE_URL` noch nicht gesetzt |
| 1 Schema + Datenimport | Schema fertig (`db/schema.sql`, `npm run db:schema`); Import als ein Skript `npm run migrate:from-supabase` (Backup + Import + Abgleich, wiederholbar) — Anleitung in `db/README.md` |
| 2 `src/lib/db.ts` + Route Handlers | fertig, 17 Endpunkte unter `src/app/api/` |
| 3 Auth (Login, Session, Passwort, Middleware, Skript) | fertig, inkl. `npm run set-password` |
| 4 Client-Hooks und Aufrufstellen | fertig, `src/lib/supabase/` gelöscht, Pakete deinstalliert |
| 5 Avatare | fertig (`bytea` + `/api/avatar/:userId`), Übernahme per `npm run set-avatar` |
| 6 Cutover | **offen** |

Noch nicht erledigt und nicht vergessen:

- **Kein Test gegen eine echte Datenbank.** Getestet ist bisher nur, dass Typcheck und
  Build sauber durchlaufen. Sobald `DATABASE_URL` steht: `npm run db:schema`,
  `npm run migrate:from-supabase` (Backup + Import + Abgleich in einem Lauf, siehe
  `db/README.md`), Passwörter per `npm run set-password`, dann die Abnahme-Prüflisten aus
  Abschnitt 9 durchgehen.
- **Backups einrichten** (Abschnitt 8) - der Punkt, der am leichtesten liegen bleibt.
- **`/security-review` über den Branch laufen lassen**, bevor deployed wird.
- `NEXT_PUBLIC_SUPABASE_*` aus den Railway-Variablen entfernen und **neu bauen**
  (nicht nur neu starten), `DATABASE_URL` setzen.
- Erst nach der Bewährungsfrist: Supabase-Abo auf Free herunterstufen (Abschnitt 7).

Bekannte, bewusste Verhaltensänderungen gegenüber vorher:

- Kein Passwort-Reset per E-Mail mehr; der Dialog auf der Login-Seite ist entfernt.
- Passwort ändern verlangt jetzt das aktuelle Passwort und mindestens 8 Zeichen;
  danach werden alle anderen Sitzungen beendet.
- "Konto löschen" löscht jetzt wirklich den Zugang (vorher nur Abmelden). Transaktionen
  und Kategorien bleiben stehen, ihr `user_id` wird NULL.
- Schreibversuche auf fremde Zeilen liefern eine Fehlermeldung, statt wie unter RLS
  stillschweigend nichts zu tun.
- "Zeitraum löschen" löscht weiterhin nur eigene Zeilen, meldet aber die tatsächlich
  gelöschte Anzahl statt der gefundenen.

---

## 0. Vorab: die ehrliche Kostenrechnung

Bevor die Arbeit losgeht, sollte die Ausgangslage stimmen:

| Variante | Kosten/Monat | Aufwand | Anmerkung |
|---|---|---|---|
| Supabase Pro (heute) | ca. 25 $ | – | Für 2 Nutzer und 6 MB Daten deutlich überdimensioniert |
| **Supabase Free** | **0 $** | **0** | Projekt pausiert nach 7 Tagen ohne Zugriff, keine automatischen Backups |
| Neon Free + Railway (App) | ca. 5 $ (nur App) | 3–4 Tage | DB kostenlos, 0,5 GB, Scale-to-Zero |
| Railway Postgres + Railway (App) | ca. 5–12 $ gesamt | 3–4 Tage | Alles bei einem Anbieter, kein Egress, keine Cold Starts |

Preise nach aktuellem Kenntnisstand — vor der Entscheidung bitte kurz auf den Preisseiten
gegenprüfen.

**Das muss klar sein:** Ein reines Downgrade auf den Supabase-Free-Tarif löst das Kostenproblem
sofort und ohne eine Zeile Code. Die Migration lohnt sich nur, wenn es um mehr geht als um Geld —
und das tut es hier durchaus:

- Der Free-Tarif **pausiert das Projekt nach 7 Tagen ohne Zugriff** und hat **keine automatischen
  Backups**. Für die Haushaltsdaten mehrerer Jahre ist beides unschön.
- Die App redet heute **direkt aus dem Browser** mit der Datenbank. Die gesamte Absicherung hängt
  an den RLS-Regeln. Die Migration erzwingt eine Server-Schicht — das ist der eigentliche
  architektonische Gewinn, unabhängig vom Anbieter.
- Kein Lock-in mehr an PostgREST, Supabase-Auth und Supabase-Realtime.

Wenn nur die Kosten stören: Downgrade auf Free, fertig. Wenn Unabhängigkeit und Backups
dazukommen sollen, gilt der Plan unten.

---

## 1. Zielarchitektur

**Empfehlung: Postgres bei Railway, App bleibt bei Railway, eigene Auth-Schicht in Next.js.**

Begründung: ein Anbieter, eine Rechnung, ein Dashboard, private Netzwerkverbindung zwischen App
und DB (kein Egress, keine Latenz übers Internet), keine Cold Starts. Das bestehende
Postgres-Schema zieht 1:1 um.

**Gleichwertige Alternative: Neon (Free).** Der Code ist identisch — der Unterschied ist
ausschließlich die `DATABASE_URL`. Diese Entscheidung kann also bis kurz vor dem Umzug offen
bleiben und später ohne Codeänderung revidiert werden. Neon kostet 0 $, dafür zweiter Anbieter,
Cold Starts nach Inaktivität und Abhängigkeit von der Free-Tier-Politik.

**Nicht empfohlen: SQLite auf einem Railway-Volume.** Wäre am billigsten und für zwei Nutzer
technisch völlig ausreichend, erzwingt aber Anpassungen am Schema (`timestamptz`,
`gen_random_uuid()`, `numeric`), macht Backups zur Handarbeit und wirft den Vorteil weg, dass der
vorhandene Postgres-Dump ohne Umbau passt.

### Was Supabase heute liefert und was an die Stelle tritt

| Supabase-Baustein | Nutzung heute | Ersatz |
|---|---|---|
| Postgres | 4 Tabellen, ~17.300 Zeilen | Postgres bei Railway (Schema identisch) |
| PostgREST (`supabase.from(...)`) | ~20 Aufrufstellen direkt im Browser | Next.js Route Handlers unter `src/app/api/**` |
| RLS | Absicherung aller Zugriffe | Autorisierung in der Server-Schicht |
| Auth | Login, Logout, Passwort ändern, Passwort-Reset per Mail | Session-Cookie + `sessions`-Tabelle, `crypto.scrypt` für Hashes |
| Realtime | Profil + Kategorien live; für Transaktionen bereits deaktiviert | Refetch nach Mutation + Refetch bei Fensterfokus |
| Storage | Avatar-Bucket, 2 Bilder | Bild als `bytea` in `profiles`, ausgeliefert über eine Route |

---

## 2. Der wichtigste Punkt: die Server-Schicht

Heute hält der Browser den Supabase-Client und stellt die Queries selbst. Sobald Supabase weg ist,
geht das nicht mehr: Eine Postgres-Verbindung darf niemals im Browser landen. Es braucht also
Endpunkte.

**Regel dabei:** *keinen* generischen Endpunkt bauen, der Tabelle, Filter und Spalten als
Parameter entgegennimmt. Das wäre ein selbstgebautes PostgREST ohne RLS — also genau die
Konstruktion, die gerade abgelöst wird. Stattdessen explizite, fachliche Endpunkte:

```
POST   /api/auth/login              Anmelden, setzt Session-Cookie
POST   /api/auth/logout             Session löschen
GET    /api/auth/me                 Aktueller Nutzer + Profil (ersetzt loadProfile)
POST   /api/auth/password           Passwort ändern

GET    /api/transactions?year=YYYY  Jahr + alle Recurring-Vorlagen, inkl. items
POST   /api/transactions            Anlegen (Transaktion + items in einer DB-Transaktion)
PATCH  /api/transactions/:id        Ändern (items werden ersetzt, in einer DB-Transaktion)
POST   /api/transactions/:id/split  Recurring-Split: alte Vorlage beenden + neue anlegen
DELETE /api/transactions/:id        ?mode=all|from_here[&date=ISO]
POST   /api/transactions/import     Massen-Insert aus Excel

GET    /api/categories              Liste
POST   /api/categories              Anlegen
PATCH  /api/categories/:id          Umbenennen
DELETE /api/categories/:id          Löschen

PATCH  /api/profile                 Namen, Budget, Auto-Logout
POST   /api/profile/avatar          Bild hochladen
GET    /api/avatar/:userId          Bild ausliefern

DELETE /api/data?year=&month=       Zeitraum löschen (Einstellungen)
DELETE /api/account                 Konto löschen

GET    /api/health                  Für den Railway-Healthcheck
```

Zwei Verbesserungen fallen dabei nebenbei ab:

- Der **Recurring-Split** ist heute drei einzelne Requests aus `page.tsx` heraus (Update, Insert,
  Insert der Items). Bricht einer ab, bleibt inkonsistenter Zustand zurück. Als ein Endpunkt mit
  einer DB-Transaktion ist diese ganze Fehlerklasse weg.
- Gleiches gilt für das Ersetzen der `transaction_items` beim Bearbeiten (heute: löschen, dann
  einfügen — ohne Transaktion).

### Stolperstein Next.js-Runtime

`pg` läuft nur in der Node-Runtime. Die `middleware.ts` läuft bei Next 15 in der Edge-Runtime und
darf deshalb **nicht** auf die Datenbank zugreifen. Die Middleware prüft daher nur, ob das
Session-Cookie überhaupt vorhanden ist, und leitet sonst auf `/login` um. Die echte Prüfung
(Session gültig? abgelaufen?) macht jeder Route Handler.

---

## 3. Auth-Konzept

Für zwei Nutzer im selben Haushalt reicht ein bewusst kleines, überprüfbares Verfahren — ohne
zusätzliche Auth-Bibliothek:

- **Passwort-Hash:** `crypto.scrypt` aus dem Node-Kern (keine neue Abhängigkeit, kein nativer
  Build unter nixpacks). Format `scrypt$<salt>$<hash>` in `profiles.password_hash`.
- **Session:** Zufalls-Token (`crypto.randomBytes(32).toString('base64url')`), Zeile in einer
  neuen Tabelle `sessions (token, user_id, expires_at)`. Cookie `httpOnly`, `secure`,
  `sameSite=lax`, Laufzeit z. B. 30 Tage.
  Vorteil gegenüber einem JWT: Abmelden wirkt sofort und serverseitig, es gibt kein
  Schlüsselmaterial zu verwalten.
- **Autorisierung:** entspricht der heutigen RLS — angemeldet heißt "darf alles lesen"
  (gemeinsamer Haushalt), Schreiben nur auf eigene Zeilen (`user_id = session.user_id`).
- **Passwort-Reset per Mail entfällt.** Ersatz: ein kleines Skript
  `npm run set-password -- <email>`, das lokal gegen die DB läuft. Für zwei Nutzer im selben
  Haushalt ist das angemessen und spart einen Mail-Versender.
  Optional später: Resend (Free-Tarif) plus Reset-Token-Tabelle.
- **Auto-Logout** bleibt wie er ist, ruft am Ende nur `/api/auth/logout` statt
  `supabase.auth.signOut()`.

### Passwörter migrieren oder neu setzen?

Supabase legt die Hashes als bcrypt in `auth.users.encrypted_password` ab. Sie ließen sich
auslesen und mit `bcryptjs` weiter prüfen. Für zwei Nutzer ist das den Aufwand nicht wert:
einfacher beim Umzug zwei neue Passwörter setzen. Dann fällt auch `bcryptjs` als Abhängigkeit weg.

---

## 4. Datenmodell

`supabase-schema.sql` wird zu `db/schema.sql` und verliert alle Supabase-Spezifika:

- Fremdschlüssel auf `auth.users` entfallen — **`profiles` wird selbst die Nutzertabelle**
  (`id`, `email UNIQUE`, `password_hash`, dazu die bestehenden Felder).
- Neue Tabelle `sessions`.
- Neue Spalten für den Avatar: `photo_data bytea`, `photo_mime text` (ersetzt `photo_url` auf
  einen Supabase-Bucket).
- Der Trigger `handle_new_user` entfällt (es gibt kein `auth.users` mehr).
- **RLS-Policies entfallen ersatzlos.** Einziger Client der Datenbank ist die App, die sich als
  Eigentümer verbindet; die Zugriffskontrolle sitzt in den Route Handlers. RLS aktiv zu lassen,
  ohne dass es `auth.uid()` gibt, würde nur alles blockieren.
- Die Indizes bleiben unverändert und sind weiterhin sinnvoll.
- `gen_random_uuid()` ist ab Postgres 13 im Kern enthalten, funktioniert also ohne Erweiterung.

Zugriffscode: schlichtes `pg` mit `Pool` und parametrisierten Queries in `src/lib/db.ts`. Bei
einem Dutzend Endpunkten und diesem Datenvolumen braucht es kein ORM. Wenn Typsicherheit
gewünscht ist, wäre Kysely die zurückhaltendste Ergänzung.

---

## 5. Client-Anpassungen

Das ist weniger Arbeit, als es aussieht, weil die Tabs reine Präsentation sind und nichts von
Supabase wissen.

- **`src/lib/supabase/hooks.ts`** wird ersetzt durch fachliche Hooks (`useTransactions(year)`,
  `useCategories()`, ...), die per `fetch()` gegen die API gehen. Wichtig: die Rückgabeform
  (`{ data, isLoading, error, setData, refetch }`) beibehalten — dann bleiben `page.tsx` und die
  Tabs weitgehend unverändert. Die 1000er-Paginierung und der PostgREST-`or`-Filterstring fallen
  weg.
- **`src/lib/supabase/provider.tsx`** wird zum `AuthProvider`: `getUser()` → `GET /api/auth/me`,
  `onAuthStateChange` und das Realtime-Abo auf `profiles` entfallen; nach dem Speichern in den
  Einstellungen wird stattdessen neu geladen.
- **`page.tsx`**: die fünf `supabase.from(...)`-Blöcke werden zu `fetch()`-Aufrufen. Die
  optimistischen Updates und die gesamte Recurring-Erzeugung im Client bleiben unangetastet.
- **`categories-tab.tsx`, `settings/page.tsx`, `user-nav.tsx`, `login/page.tsx`**: je zwei bis
  vier Aufrufe umbiegen.
- **`middleware.ts`**: nur noch Cookie-Prüfung.
- **Verlust durch den Wegfall von Realtime:** Ändert ein Nutzer eine Kategorie oder das Budget,
  sieht der andere das nicht mehr sofort. Für Transaktionen ist Realtime ohnehin schon
  abgeschaltet. Als günstiger Ausgleich: Refetch beim Fensterfokus.
- **Aufräumen:** `@supabase/supabase-js` und `@supabase/ssr` aus `package.json` entfernen,
  `src/lib/supabase/` löschen, `NEXT_PUBLIC_SUPABASE_*` überall raus.

---

## 6. Vorgehen in Phasen

Arbeit auf einem Branch `feat/drop-supabase`, vorher `git tag pre-supabase-exit` setzen.

| Phase | Inhalt | Aufwand |
|---|---|---|
| 0 | Zielanbieter festlegen, DB anlegen, vollständigen Dump aus Supabase ziehen | 1–2 h |
| 1 | `db/schema.sql` ohne Supabase-Spezifika, Daten importieren, Zeilenzahlen abgleichen | 2–3 h |
| 2 | `src/lib/db.ts` + alle Route Handler, mit `curl` durchgetestet | 1 Tag |
| 3 | Auth: Login, Logout, Session, Passwort ändern, Middleware, `set-password`-Skript | 1 Tag |
| 4 | Client-Hooks und alle Aufrufstellen umstellen, `npm run typecheck` sauber | 0,5–1 Tag |
| 5 | Avatare übernehmen, Upload- und Ausliefer-Route | 1–2 h |
| 6 | Cutover auf Railway, Prüfliste abarbeiten, danach Supabase abbauen | 0,5 Tag |

Summe etwa **3–4 konzentrierte Arbeitstage**, über Abende verteilt realistisch zwei bis drei
Wochen.

Phasen 0–5 laufen vollständig lokal gegen die neue Datenbank, während Supabase produktiv
weiterläuft. Erst Phase 6 ist der Schnitt.

### Cutover-Fenster

Weil zwischen dem finalen Dump und dem Umschalten keine Einträge verloren gehen dürfen: einen
Abend festlegen, dem zweiten Nutzer Bescheid geben, dass in dieser Zeit nichts eingetragen wird,
dann finalen Dump ziehen, importieren, umschalten, gemeinsam prüfen.

---

## 7. Aufgaben in Supabase

**Vorher (Phase 0):**

- [ ] Verbindungsdaten holen: Dashboard → Project Settings → Database → Connection string;
      als `SUPABASE_DATABASE_URL` in `.env`
- [ ] Die zwei Avatar-Bilder aus dem Storage-Bucket `avatars` herunterladen (für
      `npm run set-avatar`)

Dump, Zeilenzählen und ID-Abgleich übernimmt `npm run migrate:from-supabase`: es zieht
selbst ein vollständiges JSON-Backup nach `backups/<zeitstempel>/`, übernimmt die
Original-IDs unverändert und bricht ab, wenn im Ziel Zeilen fehlen. Wer zusätzlich einen
klassischen `pg_dump -Fc` als Rückfall-Backup will, kann ihn ziehen — nötig ist er nicht.

**Beim Cutover (Phase 6):**

- [ ] Finalen Dump ziehen, nachdem die letzte Eingabe erfolgt ist
- [ ] Projekt zunächst **unverändert weiterlaufen lassen** — mindestens zwei bis vier Wochen als
      Rückfalloption

**Nach der Bewährungsfrist:**

- [ ] **Abo kündigen: Organization → Billing → Plan von Pro auf Free herunterstufen.** Das ist der
      Schritt, der tatsächlich Geld spart. Ein gelöschtes Projekt allein beendet das
      Organisations-Abo nicht.
- [ ] Projekt löschen (danach ist auch der Anon-Key wertlos)
- [ ] Prüfen, dass keine weiteren Projekte in der Organisation Kosten verursachen

---

## 8. Aufgaben in Railway

**Vorbereitung:**

- [ ] Postgres-Dienst im selben Projekt anlegen (`+ New` → `Database` → `PostgreSQL`)
      — entfällt, falls Neon gewählt wird
- [ ] Postgres-Version prüfen (mindestens 13 wegen `gen_random_uuid()`; aktuelle Version nehmen)
- [ ] **Interne Verbindung verwenden**: `DATABASE_URL` auf den Host `*.railway.internal` zeigen
      lassen, nicht auf die öffentliche Proxy-Adresse. Spart Egress und Latenz.
      Bei Neon dagegen die öffentliche URL mit `?sslmode=require`.

**Umgebungsvariablen im App-Dienst:**

- [ ] `DATABASE_URL` setzen (bei Railway-Postgres per Variablen-Referenz auf den DB-Dienst)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` löschen
- [ ] `ADMIN_EMAIL` bleibt, falls weiterhin gebraucht
- [ ] **Achtung:** `NEXT_PUBLIC_*`-Variablen werden beim Build eingebacken. Nach dem Entfernen ist
      ein **neuer Build** nötig, ein Neustart genügt nicht.

**Healthcheck:**

- [ ] `railway.toml` von `healthcheckPath = "/"` auf `/api/health` umstellen. Nach der
      Auth-Umstellung leitet `/` auf `/login` um; ein Endpunkt, der die DB-Verbindung wirklich
      prüft, ist aussagekräftiger.

**Backups — nicht überspringen:**

Supabase Pro hat täglich gesichert. Diese Sicherung fällt ersatzlos weg, und zwar unbemerkt.

- [ ] Geplanten `pg_dump` einrichten: entweder ein Railway-Cron-Dienst oder eine GitHub Action,
      die täglich läuft und den Dump verschlüsselt ablegt (z. B. Backblaze B2 oder ein privates
      Repo)
- [ ] **Eine Wiederherstellung einmal testen** — ein Backup, das nie zurückgespielt wurde, ist
      keins
- [ ] Aufbewahrung: z. B. 30 tägliche Stände, das sind bei dieser Datenmenge wenige hundert MB

**Nach dem Deploy:**

- [ ] Log auf Verbindungsfehler prüfen
- [ ] Pool-Größe im Blick behalten: Railway-Postgres erlaubt begrenzt viele Verbindungen, Next.js
      kann bei Hot-Reloads mehrere Pools öffnen. `max: 5` im Pool genügt hier reichlich.

---

## 9. Abnahme-Prüfliste

Nach dem Umschalten mit echten Daten durchgehen:

- [ ] Anmelden mit beiden Konten, Abmelden, Auto-Logout nach eingestellter Zeit
- [ ] Zeilenzahlen aller vier Tabellen stimmen mit den vor dem Dump notierten überein
- [ ] Jahres- und Monatsauswahl zeigen dieselben Summen wie vorher (Stichprobe: drei Monate über
      zwei Jahre gegen einen alten PDF-Bericht prüfen)
- [ ] Transaktion anlegen, bearbeiten, löschen — jeweils mit mehreren Posten
- [ ] Wiederkehrende Transaktion: anlegen, "Wirksam ab" ändern (Split), "ab hier löschen",
      "alle löschen"
- [ ] Kategorie anlegen, umbenennen, löschen
- [ ] Excel-Import und Excel-Export
- [ ] PDF-Bericht für Monat und Jahr, inklusive Diagrammbild
- [ ] Budget und Auto-Logout in den Einstellungen speichern
- [ ] Avatar hochladen und nach Neuladen sichtbar
- [ ] Zeitraum löschen in den Einstellungen
- [ ] Beträge in Euro und deutschem Format, Datumsangaben deutsch — insbesondere prüfen, dass die
      Zeitzone stimmt (`timestamptz` in UTC, Anzeige lokal; ein Off-by-one beim Datum wäre hier
      der wahrscheinlichste Fehler)
- [ ] Zweiter Nutzer sieht die Einträge des ersten

---

## 10. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Selbstgebaute Auth ist sicherheitskritisch | Bewusst kleiner Umfang, Session-Tabelle statt JWT, `crypto.scrypt`; vor dem Deploy `/security-review` über den Branch laufen lassen |
| Kein Backup mehr, unbemerkt | Backup-Cron ist Teil von Phase 6, nicht später; Wiederherstellung einmal testen |
| Datumsverschiebung beim Import | Dump und Import beide in UTC, Stichproben gegen alte PDF-Berichte |
| `user_id` ändert sich beim Umzug | IDs aus `auth.users` unverändert übernehmen |
| Migration bleibt auf halbem Weg liegen | Phasen 0–5 laufen lokal, Supabase bleibt bis zur Abnahme unangetastet; `pre-supabase-exit`-Tag als Rückweg |
| Cross-User-Live-Updates fehlen | Bewusst akzeptiert, Refetch bei Fensterfokus als Ausgleich |

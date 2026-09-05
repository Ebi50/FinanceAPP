# Blaupause: Supabase durch eigene Server-Schicht auf Railway-Postgres ablösen

Generalisiert aus der Finanzapp-Migration (siehe [migration-supabase-abloesen.md](migration-supabase-abloesen.md)
für den konkreten, abgeschlossenen Fall). Gedacht zum Kopieren in ein anderes Projekt mit
demselben Ausgangspunkt: eine App, die heute direkt aus dem Browser über `@supabase/supabase-js`
mit Supabase (Postgres + PostgREST + RLS + Supabase-Auth) redet, und weg soll — wegen Kosten,
Unabhängigkeit oder beidem.

Zielgruppe dieses Dokuments: ein kleines Projekt (wenige, bekannte Nutzer, kein Multi-Tenant-SaaS
mit fremden Endnutzern). Für öffentliche Registrierung, Passwort-Reset-Mails oder viele Nutzer
braucht es zusätzliche Bausteine, die hier bewusst nicht behandelt werden.

---

## 0. Erst rechnen, dann migrieren

Ein reines Downgrade auf den Supabase-Free-Tarif löst das Kostenproblem sofort, ohne eine Zeile
Code. Migrieren lohnt sich nur, wenn mehr dazukommt:

- Free pausiert das Projekt nach einigen Tagen ohne Zugriff und hat meist keine automatischen
  Backups mehr.
- Die App redet heute direkt aus dem Browser mit der DB — die gesamte Absicherung hängt an RLS.
  Die Migration erzwingt eine Server-Schicht; das ist der eigentliche architektonische Gewinn,
  unabhängig vom Anbieter.
- Kein Lock-in mehr an PostgREST, Supabase-Auth, Supabase-Realtime, Supabase-Storage.

Wenn nur die Kosten stören: Downgrade, fertig. Sonst gilt der Plan unten. Preise vor der
Entscheidung immer aktuell auf den Anbieter-Seiten prüfen, sie ändern sich.

**Empfehlung:** Postgres beim selben Anbieter wie die App (ein Dashboard, private Netzwerk-
verbindung, kein Egress, keine Cold Starts). Der Code ist bei jedem Postgres-Anbieter identisch —
der einzige Unterschied ist die `DATABASE_URL`. Diese Entscheidung kann bis kurz vor dem Umzug
offen bleiben.

**Nicht empfehlenswert:** SQLite oder ein anderes Nicht-Postgres-System, nur weil es billiger
wäre. Der vorhandene Postgres-Dump passt dann nicht mehr ohne Umbau (`timestamptz`,
`gen_random_uuid()`, `numeric`), und Backups werden zur Handarbeit.

---

## 1. Der wichtigste Architekturpunkt: die Server-Schicht

Sobald Supabase weg ist, darf keine Postgres-Verbindung mehr im Browser landen. Es braucht eigene
Endpunkte.

**Regel:** *keinen* generischen Endpunkt bauen, der Tabelle, Filter und Spalten als Parameter
entgegennimmt. Das wäre ein selbstgebautes PostgREST ohne RLS — also genau die Konstruktion, die
abgelöst wird. Stattdessen fachlich geschnittene Endpunkte, exakt einer pro Aktion, die die
bisherigen `supabase.from(...)`-Aufrufstellen ersetzen (Login, Logout, aktueller Nutzer, je eine
Ressource pro fachlichem Objekt, keine Tabellennamen in der URL, die nicht ohnehin fachlich
naheliegen).

Nebenbei abfallende Verbesserung: alles, was bisher mehrere Einzel-Requests aus dem Client heraus
war (z. B. Update + zwei Inserts für eine abhängige Struktur), wird als ein Endpunkt mit einer
DB-Transaktion umgesetzt. Bricht dabei etwas ab, bleibt kein inkonsistenter Zwischenstand zurück.

**Next.js-Stolperstein:** `pg` läuft nur in der Node-Runtime. `middleware.ts` läuft in der
Edge-Runtime und darf deshalb nicht auf die Datenbank zugreifen — sie prüft nur, ob das
Session-Cookie vorhanden ist, und leitet sonst um. Die eigentliche Prüfung (Session gültig?
abgelaufen?) macht jeder Route Handler selbst.

---

## 2. Auth-Konzept für wenige, bekannte Nutzer

Ohne zusätzliche Auth-Bibliothek:

- **Passwort-Hash:** `crypto.scrypt` aus dem Node-Kern. Format `scrypt$<salt-hex>$<hash-hex>` in
  einer eigenen Nutzertabelle (die frühere `profiles`-Tabelle wird selbst zur Nutzertabelle,
  Fremdschlüssel auf `auth.users` entfallen).
- **Session:** Zufalls-Token (`crypto.randomBytes(32).toString('base64url')`) im Cookie
  (`httpOnly`, `secure` in Produktion, `sameSite=lax`). In der DB liegt nur der **SHA-256-Hash**
  des Tokens in einer eigenen `sessions`-Tabelle, damit ein DB-Dump keine gültigen Sitzungen
  enthält. Vorteil gegenüber einem JWT: Abmelden wirkt sofort serverseitig, kein Schlüsselmaterial
  zu verwalten.
- **Autorisierung entspricht der bisherigen RLS:** angemeldet heißt "darf die gemeinsamen Daten
  lesen" (falls das dem bisherigen Modell entspricht), geschrieben wird nur auf eigene Zeilen
  (`user_id = session.user_id`), serverseitig geprüft, nicht im Client.
- **Passwort-Reset per Mail entfällt ersatzlos.** Ersatz: ein Skript, das lokal gegen die DB läuft
  und ein neues Passwort setzt (siehe Vorlage in der Finanzapp: `scripts/set-password.mjs`). Für
  wenige bekannte Nutzer angemessen, spart einen Mail-Versender. Ein Passwortwechsel sollte alle
  anderen Sitzungen dieses Nutzers beenden.
- Login sollte gedrosselt werden (z. B. 10 Fehlversuche je E-Mail und 15 Minuten, in-memory reicht
  für eine Einzelinstanz).
- **Passwörter migrieren oder neu setzen?** Supabase legt Passwort-Hashes bcrypt-verschlüsselt in
  `auth.users.encrypted_password` ab. Für wenige Nutzer ist das Auslesen und Weiterprüfen selten
  den Aufwand wert — einfacher beim Umzug neue Passwörter setzen und den Nutzern mitteilen.

---

## 3. Datenmodell-Umbau

- Fremdschlüssel auf `auth.users` entfallen — die bisherige `profiles`/Nutzer-Tabelle wird selbst
  die Nutzertabelle (`id`, `email UNIQUE`, `password_hash`, plus bestehende Felder). `email`
  bleibt NULL-bar, falls beim Import Zeilen ohne Nacharbeit übernommen werden sollen.
- Neue Tabelle `sessions (token_hash, user_id, expires_at)`.
- Storage-Buckets (z. B. Avatare) werden zu einer `bytea`-Spalte plus einer Ausliefer-Route, falls
  es sich um wenige, kleine Dateien handelt. Bei vielen/großen Dateien besser ein Objektspeicher
  beim neuen Anbieter.
- **RLS-Policies entfallen ersatzlos.** Einziger Client der Datenbank ist die App, die sich als
  Eigentümer verbindet; die Zugriffskontrolle sitzt vollständig in den Route Handlers. RLS aktiv
  zu lassen, ohne dass es `auth.uid()` gibt, würde nur alles blockieren.
- Indizes bleiben unverändert sinnvoll. `gen_random_uuid()` ist ab Postgres 13 im Kern enthalten.
- Schlichtes `pg` mit `Pool` und parametrisierten Queries reicht bei überschaubarer Endpunktzahl;
  kein ORM nötig. Typparser für `numeric` explizit setzen (`types.setTypeParser(1700, parseFloat)`),
  sonst kommen Beträge als String zurück.

---

## 4. Migrations-Skript-Muster (statt `pg_dump`/`psql`)

`pg_dump`/`psql`-Handarbeit ist fehleranfällig und braucht lokal installierte Tools. Stattdessen
ein einziges Node-Skript (nur `pg`, läuft überall inkl. Windows), das:

1. **lesend** aus Supabase verbindet (`SUPABASE_DATABASE_URL`, nie schreibend — Supabase bleibt
   bis zur Bewährungsfrist unangetastet als Rückfall),
2. jede Tabelle in Fremdschlüssel-Reihenfolge ausliest und zusätzlich als JSON-Backup lokal
   ablegt (das ist zugleich das erste Rückfall-Backup),
3. **Original-IDs erhält** (sie stecken in jedem Fremdschlüssel — nie neu generieren),
4. Spalten weglässt, die es im neuen Schema nicht mehr gibt (z. B. `photo_url`),
5. mit `INSERT ... ON CONFLICT DO NOTHING` in die Zieldatenbank schreibt — dadurch **beliebig oft
   wiederholbar**, wichtig für den finalen Lauf am Cutover-Abend,
6. Verweise ins Leere (Fremdschlüssel, der im Ziel nicht existiert) **nicht die Zeile verwerfen
   lässt**, sondern auf `NULL` setzt und protokolliert,
7. am Ende die Zeilenzahlen Quelle vs. Ziel gegenüberstellt und bei jeder Abweichung **mit
   Fehler abbricht**, statt still weiterzulaufen.

Konkrete, kopierbare Vorlage: `scripts/migrate-from-supabase.mjs` in der Finanzapp. Tabellen- und
Spaltenlisten anpassen, Kernlogik (Lesen → Sanitize → Batch-Insert mit `ON CONFLICT DO NOTHING` →
Zeilenabgleich) übernehmen.

---

## 5. Backup/Restore-Muster

Mit Supabase fällt die anbietereigene tägliche Sicherung weg — **das wird am leichtesten
vergessen, weil der Ausfall unbemerkt bleibt.**

Gleiches Prinzip wie beim Migrationsskript, nur andere Richtung: ein Backup-Skript (nur `pg`,
kein `pg_dump` nötig) liest die fachlichen Tabellen aus `DATABASE_URL` und schreibt sie als JSON
in einen Zeitstempel-Ordner; ein Restore-Skript liest so einen Ordner und spielt ihn mit
`ON CONFLICT DO NOTHING` zurück. `sessions` (oder vergleichbare rein-technische, flüchtige
Tabellen) bewusst **nicht** sichern.

**Automatisiert als Cron-Dienst beim selben Anbieter** (privates Netzwerk, kein öffentlicher
DB-Zugriff nötig) — konkrete Schritte für Railway siehe Abschnitt 7. Vorlage:
`scripts/backup-db.mjs` / `scripts/restore-db.mjs` in der Finanzapp.

**Eine Wiederherstellung einmal testen, bevor es drauf ankommt** — ein Backup, das nie
zurückgespielt wurde, ist keins. Ohne eine zweite (bezahlte) Datenbank testen: in einem
**isolierten Postgres-Schema** derselben Datenbank.

```sql
-- Test-Schema anlegen, Schema-DDL hineinspielen (search_path setzen, dann das normale
-- Schema-Skript ausführen — CREATE TABLE landet dann im Test-Schema)
CREATE SCHEMA restore_test;
SET search_path TO restore_test;
-- db/schema.sql (o.ä.) ausführen

-- Restore-Skript mit einer DATABASE_URL laufen lassen, die den search_path erzwingt:
-- postgresql://...?options=-c%20search_path%3Drestore_test

-- Danach vergleichen (Zeilenzahlen + eine Quersumme, z.B. sum(amount)) und aufräumen:
DROP SCHEMA restore_test CASCADE;
```

So ist die Wiederherstellung bewiesen, ohne die Produktivdaten anzufassen und ohne eine
zusätzliche Datenbank zu bezahlen.

---

## 6. Phasenplan

Arbeit auf einem eigenen Branch, vorher einen Tag markieren (`git tag pre-supabase-exit`) als
Rückweg.

| Phase | Inhalt |
|---|---|
| 0 | Zielanbieter festlegen, Postgres-Dienst anlegen |
| 1 | Schema ohne Supabase-Spezifika, Migrationsskript schreiben |
| 2 | `db.ts` + alle Route Handler |
| 3 | Auth: Login, Logout, Session, Passwort ändern, Middleware, Passwort-Setz-Skript |
| 4 | Client-Hooks und alle Aufrufstellen umstellen, Typcheck sauber |
| 5 | Backup/Restore-Skripte, einmal getestet |
| 6 | Cutover: Daten übernehmen, Testdeploy, Prüfliste, Merge, danach Supabase abbauen |

Phasen 0–5 laufen vollständig lokal gegen die neue Datenbank, während Supabase produktiv
weiterläuft. Erst Phase 6 ist der Schnitt. Weil zwischen dem finalen Datenabgleich und dem
Umschalten keine Einträge verloren gehen dürfen: ein Zeitfenster festlegen, in dem alle Nutzer
Bescheid wissen, dass nichts eingetragen wird, dann den finalen Migrationslauf machen und
umschalten.

---

## 7. Praktischer Cutover-Ablauf mit Railway (Operatives, aus der Praxis)

Das hier sind die Punkte, die beim ersten Mal Zeit kosten, weil sie nirgends offensichtlich
dokumentiert sind.

### 7.1 Lokaler Zugriff auf eine Railway-Postgres-DB (für Migrations-/Backup-Skripte)

Die interne Adresse (`*.railway.internal`) ist nur **innerhalb** des Railway-Netzwerks erreichbar.
Für Skripte vom eigenen Rechner aus, **ohne** die Datenbank dauerhaft öffentlich zu machen:

```bash
npm install -g @railway/cli
railway login                      # öffnet den Browser
railway link -p <projektname>       # Projekt verknüpfen
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""   # falls noch kein Key vorhanden
railway ssh keys add                # Key bei Railway registrieren (sonst: "No registered SSH keys")
railway connect <db-dienst-name> --tunnel-only   # im Hintergrund laufen lassen
```

Der Tunnel gibt eine `postgresql://...@127.0.0.1:<PORT>/...`-URL aus — **der Port ist nicht
stabil** und ändert sich bei jedem Neustart des Tunnels. Als `DATABASE_URL` in `.env` eintragen,
bei jedem Neustart aktualisieren.

### 7.2 Vor dem Merge: Testdeploy ohne den Hauptbranch anzufassen

```bash
railway up --detach     # deployt den aktuellen lokalen Checkout direkt auf den verlinkten Dienst
```

Das baut den Branch-Stand testweise, ohne vorher nach `main`/den Hauptbranch zu pushen. Schlägt
es fehl, läuft die zuvor erfolgreich deployte Version unverändert weiter — kein Ausfall. Healthcheck-
Endpunkt danach direkt prüfen (`curl .../api/health`).

**Achtung:** Wenn der Zieldienst schon länger existiert und noch die *alte* Codebasis deployt,
kann ein reines Ändern von Umgebungsvariablen (z. B. alte `NEXT_PUBLIC_*`-Werte entfernen) den
nächsten automatischen Deploy des *alten main-Branches* zum Absturz bringen, weil der alte Code
diese Variablen noch braucht. Reihenfolge: **erst** den neuen Branch testweise deployen (`railway
up`) und verifizieren, **dann erst** nach `main` mergen und pushen.

### 7.3 Variablen sauber verdrahten

Zwischen Diensten **immer per Variablen-Referenz** verbinden, nie den Wert von Hand kopieren:

```
DATABASE_URL = ${{<postgres-dienst-name>.DATABASE_URL}}
```

Das bleibt korrekt, falls sich der zugrundeliegende Wert je ändert. Alte `NEXT_PUBLIC_SUPABASE_*`-
Variablen löschen und **neu bauen lassen** (nicht nur neu starten) — sie werden beim Build ins
Bundle einkompiliert.

### 7.4 Automatisierter Backup-Cron-Dienst

Ein zusätzlicher Dienst im selben Projekt, der aus demselben Repo baut, aber nur das
Backup-Skript ausführt:

```bash
railway add --service <name> --repo <owner/repo> --branch main \
  --variables "DATABASE_URL=\${{<postgres-dienst>.DATABASE_URL}}" \
  --variables "BACKUP_DIR=/data/backups"
```

**Windows/Git-Bash-Falle:** Ein Wert wie `/data/backups` wird von Git-Bashs Pfad-Mangling in
einen Windows-Pfad verwandelt (`C:/Program Files/Git/data/backups`). Abhilfe: `MSYS_NO_PATHCONV=1`
voranstellen oder den Wert nachträglich korrigieren:

```bash
MSYS_NO_PATHCONV=1 railway variable set "BACKUP_DIR=/data/backups" --service <name> --skip-deploys
```

**Volume anlegen und mounten:**

```bash
MSYS_NO_PATHCONV=1 railway volume --service <service-id> --environment <env-id> add --mount-path /data --json
```

(`--service`/`--environment` müssen bei manchen `railway volume`-Unterbefehlen **vor** dem
Unterbefehl stehen, sonst interne Fehler/Panics der CLI — Service-/Environment-IDs notfalls über
`railway status` oder `railway service list --json` holen.)

**Start-Befehl und Cron-Zeitplan setzen** — das geht (Stand heute) nicht vollständig über die
normalen `railway`-Unterbefehle, sondern über die GraphQL-API der CLI:

```bash
railway api 'mutation($serviceId: String!, $envId: String, $input: ServiceInstanceUpdateInput!) {
  serviceInstanceUpdate(serviceId: $serviceId, environmentId: $envId, input: $input)
}' \
  --var serviceId="<service-id>" --var envId="<environment-id>" \
  --variables '{"input":{"startCommand":"node scripts/backup-db.mjs","cronSchedule":"0 3 * * *","restartPolicyType":"NEVER"}}'
```

**Wichtig: `restartPolicyType: "NEVER"` setzen.** Ein Skript, das normal durchläuft und sich
beendet, wird von Railways Standard-Neustart-Richtlinie sonst als abgestürzt interpretiert und
in einer Neustart-Schleife immer wieder gestartet.

Zum Prüfen, ob die Konfiguration angekommen ist:

```bash
railway api 'query($id: String!) { serviceInstance(serviceId: $id, environmentId: "<env-id>") {
  startCommand cronSchedule nextCronRunAt restartPolicyType } }' --var id="<service-id>"
```

**Live-Logs eines Cron-Laufs sind unzuverlässig über die normale `railway logs`-CLI abrufbar** —
die Container sind zu kurzlebig, damit sich ein Log-Stream sauber anhängt. Verlässlicher: den
Skript-Erfolg vorher schon lokal gegen die echte Ziel-DB beweisen (Abschnitt 5), und danach im
Railway-Dashboard unter dem Cron-Dienst → Deployments den ersten echten nächtlichen Lauf grün
sehen.

---

## 8. Vor dem Deploy: Sicherheitsreview

Selbstgebaute Auth verdient eine eigene Prüfrunde, unabhängig vom normalen Code-Review:
`/security-review` (oder gleichwertig) über den ganzen Branch laufen lassen, mit Fokus auf:

- Geht jeder mutierende Endpunkt durch die zentrale Auth-/Autorisierungs-Prüfung?
- Ist jede Schreiboperation auf `user_id = session.user_id` beschränkt, wo das Modell das verlangt?
- Ausschließlich parametrisiertes SQL, nirgends String-Konkatenation mit Nutzereingabe?
- Session-Tokens ausreichend zufällig, nur der Hash in der DB?
- Passwortvergleich `timingSafeEqual`, keine anderen Timing-Seitenkanäle mit echtem Angriffswert
  für die tatsächliche Nutzerzahl?

---

## 9. Abnahme-Prüfliste (Vorlage)

Nach dem Umschalten mit echten Daten durchgehen, projektspezifisch ergänzen:

- [ ] Anmelden mit allen Konten, Abmelden, Auto-Logout falls vorhanden
- [ ] Zeilenzahlen aller migrierten Tabellen stimmen mit den vor dem Umzug notierten überein
- [ ] Stichproben der wichtigsten Berichte/Summen gegen einen alten Export/PDF prüfen
- [ ] Jede CRUD-Aktion einmal durchspielen (anlegen, ändern, löschen)
- [ ] Alle projektspezifischen Sonderfälle (z. B. wiederkehrende Buchungen, Splits)
- [ ] Import/Export-Funktionen, falls vorhanden
- [ ] Datei-Uploads (Avatare o. ä.), falls vorhanden
- [ ] Zeitzonen-/Datumsdarstellung stichprobenartig prüfen — der wahrscheinlichste stille Fehler
      bei einem Datenbank-Umzug
- [ ] Jeder Nutzer sieht die für ihn vorgesehenen Daten der anderen (falls geteiltes Modell)

---

## 10. Nach dem Cutover

- Zielanbieter-Dienst **mindestens 2–4 Wochen unangetastet weiterlaufen lassen** — der günstigste
  Rückfall, den es gibt.
- Erst danach das alte Abo herunterstufen (reversibel!) und erst nach einer weiteren Weile das
  alte Projekt **löschen** (irreversibel — das ist der Punkt ohne Rückweg, entsprechend zuletzt).
- Downgrade und Löschen sind zwei getrennte Entscheidungen: das Downgrade spart schon das Geld,
  das Löschen ist nur noch Aufräumen und sollte separat und bewusst entschieden werden.

---

## 11. Risiken (generisch)

| Risiko | Gegenmaßnahme |
|---|---|
| Selbstgebaute Auth ist sicherheitskritisch | Bewusst kleiner Umfang, Session-Tabelle statt JWT, `crypto.scrypt`; vor dem Deploy Security-Review |
| Kein Backup mehr, unbemerkt | Backup-Cron ist Teil des Cutovers, nicht "später"; Wiederherstellung einmal beweisen |
| Datumsverschiebung beim Import | Migration und Zieldatenbank beide in UTC, Stichproben gegen alte Berichte |
| IDs ändern sich beim Umzug | Original-IDs unverändert übernehmen, nie neu generieren |
| Migration bleibt auf halbem Weg liegen | Alte Quelle bleibt bis zur Abnahme unangetastet, ein Tag/Branch als Rückweg |
| Fehlender Cron-Dienst läuft unbemerkt nicht | Nach dem ersten planmäßigen Lauf einmal im Dashboard nachsehen, ob er grün war |

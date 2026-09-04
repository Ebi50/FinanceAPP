# TODO

## Sicherheit

### [ ] Unverschlüsselter Firebase-Service-Account-Key im Projektordner

**Datei:** `studio-6151698579-c04b2-firebase-adminsdk-fbsvc-68f806c2cc.json`

Die Datei enthält den privaten Schlüssel (`"type": "service_account"`, `private_key`) des
Firebase-Admin-SDK-Kontos `firebase-adminsdk-fbsvc@studio-6151698579-c04b2.iam.gserviceaccount.com`.
Ein Admin-SDK-Key umgeht sämtliche Security Rules und hat vollen Lese-/Schreibzugriff auf das
Firebase-Projekt.

Aktueller Stand:
- Die Datei ist **nicht** in Git eingecheckt (`.gitignore` enthält `studio-*.json`) — sie liegt aber
  unverschlüsselt im Projektordner und wandert damit in jedes Backup, jede Ordner-Synchronisierung
  und jeden Datei-Upload dieses Verzeichnisses.
- `scripts/clean-reimport.mjs` und `scripts/export-firestore.js` (die einzigen Nutzer des Keys)
  sind mit der Supabase-Migration gelöscht — die Datei wird von nichts im Repository mehr gebraucht.
- `.env` liegt ebenfalls im Klartext im Projektordner. Die alten `NEXT_PUBLIC_SUPABASE_*`-Werte
  sind unkritisch (öffentlicher Anon-Key), der Firebase-Service-Account-Key ist es nicht.

Zu tun (in dieser Reihenfolge):
1. **Key in der Google Cloud Console widerrufen** — IAM & Verwaltung → Dienstkonten →
   `firebase-adminsdk-fbsvc@…` → Schlüssel → den Schlüssel mit der ID `68f806c2cc…` löschen.
   Das ist der eigentlich wirksame Schritt; solange der Key gültig ist, hilft Verschieben nichts.
2. Prüfen, ob das Firebase-Projekt `studio-6151698579-c04b2` überhaupt noch benötigt wird.
   Nach Abschluss der Supabase-Migration (siehe unten): Projekt löschen oder stilllegen.
3. Die JSON-Datei (und `studio.json`) aus dem Projektordner entfernen.
4. Git-History: bereits geprüft (`git log --all --diff-filter=A --name-only -- '*studio*' '*adminsdk*'`)
   — die Datei war nie eingecheckt. Ein History-Rewrite ist also nicht nötig.

## Migration weg von Supabase

Code-Seite ist fertig (Phasen 1-5), siehe
[docs/migration-supabase-abloesen.md](docs/migration-supabase-abloesen.md#umsetzungsstand-stand-2026-09-04).
Stand 2026-09-04, Abend: Cutover abgeschlossen. Datenübernahme (17.558 Transaktionen,
Zeilenzahlen geprüft), Passwörter, Merge nach `main`, Deploy auf Railway, Security-Review
und Backup-Cron sind durch.

- [x] ~~`DATABASE_URL`/`SUPABASE_DATABASE_URL` in `.env`, Schema, Datenübernahme~~
- [x] ~~Passwörter neu setzen~~ (keine Avatare zu übernehmen)
- [x] ~~Railway: `NEXT_PUBLIC_SUPABASE_*` entfernen, neu bauen~~ (`/api/health` → 200 auf `main`)
- [x] ~~`feat/drop-supabase` nach `main` mergen~~
- [x] ~~`/security-review` über den Branch~~ (keine Findings über der Meldeschwelle)
- [x] ~~Backups einrichten~~ — Dienst `finanzapp-backup` im FinanzAPP-Projekt: taeglich 03:00 UTC,
      `node scripts/backup-db.mjs`, eigenes Volume `/data`, privates Netzwerk. Skript-Logik
      (Backup + Restore) gegen die echte Datenbank in einem isolierten Postgres-Schema
      verifiziert (Zeilenzahlen und `sum(amount)` stimmen exakt). Den ersten tatsächlichen
      naechtlichen Lauf (heute Nacht 03:00 UTC / 05:00 MESZ) noch einmal im Railway-Dashboard
      unter dem Dienst `finanzapp-backup` gegenpruefen.
- [ ] Vollständige Abnahme-Prüfliste mit beiden Nutzern (Abschnitt 9 im Migrationsplan) —
      Grundfunktionen schon gegengeprüft, wiederkehrende Transaktionen und Excel-Import noch offen
- [ ] Nach der Bewährungsfrist (ein paar Wochen): Supabase-Abo von Pro auf Free herunterstufen
      (das ist der Schritt, der Geld spart), danach Projekt löschen

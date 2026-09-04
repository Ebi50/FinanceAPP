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
- Benutzt wird sie nur von `scripts/clean-reimport.mjs` (Zeile 7), einem einmaligen Skript aus der
  Firebase→Supabase-Migration. Die laufende App braucht sie nicht.
- `.env` liegt ebenfalls im Klartext im Projektordner (Supabase-URL + Anon-Key). Der Anon-Key ist
  ohnehin öffentlich, das ist unkritisch — der Service-Account-Key ist es nicht.

Zu tun (in dieser Reihenfolge):
1. **Key in der Google Cloud Console widerrufen** — IAM & Verwaltung → Dienstkonten →
   `firebase-adminsdk-fbsvc@…` → Schlüssel → den Schlüssel mit der ID `68f806c2cc…` löschen.
   Das ist der eigentlich wirksame Schritt; solange der Key gültig ist, hilft Verschieben nichts.
2. Prüfen, ob das Firebase-Projekt `studio-6151698579-c04b2` überhaupt noch benötigt wird.
   Wenn die Migration zu Supabase abgeschlossen ist: Projekt löschen oder stilllegen.
3. Die JSON-Datei aus dem Projektordner entfernen.
4. `scripts/clean-reimport.mjs` und `scripts/export-firestore.js` anpassen: Pfad zum Key nicht mehr
   hart auf den Projektordner zeigen lassen, sondern aus einer Umgebungsvariablen lesen
   (z. B. `GOOGLE_APPLICATION_CREDENTIALS`). Alternativ die Migrationsskripte ganz löschen, falls
   sie nicht mehr gebraucht werden.
5. Git-History: bereits geprüft (`git log --all --diff-filter=A --name-only -- '*studio*' '*adminsdk*'`)
   — die Datei war nie eingecheckt. Ein History-Rewrite ist also nicht nötig.

## Migration weg von Supabase

Code-Seite ist fertig (Phasen 1-5), siehe
[docs/migration-supabase-abloesen.md](docs/migration-supabase-abloesen.md#umsetzungsstand-stand-2026-09-04).
Offen und nicht vergessen:

- [ ] `DATABASE_URL` (Railway-Postgres steht schon) und `SUPABASE_DATABASE_URL` in `.env`
- [ ] `npm run db:schema`, dann `npm run migrate:from-supabase` (Backup + Import + Abgleich
      in einem Lauf, wiederholbar — `db/README.md`)
- [ ] Einmal komplett gegen eine echte Datenbank testen — bisher nur Typcheck und Build
- [ ] Passwörter neu setzen (`npm run set-password`) und die zwei Avatare übernehmen
- [ ] `/security-review` über den Branch laufen lassen (selbstgebaute Auth)
- [ ] **Backups einrichten und eine Wiederherstellung testen** — die tägliche Sicherung von
      Supabase Pro fällt ersatzlos weg, und zwar unbemerkt
- [ ] Railway: `NEXT_PUBLIC_SUPABASE_*` entfernen und **neu bauen**, Healthcheck steht bereits
      auf `/api/health`
- [ ] Nach der Bewährungsfrist: Supabase-Abo von Pro auf Free herunterstufen (das ist der
      Schritt, der Geld spart), danach Projekt löschen

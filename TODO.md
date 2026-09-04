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

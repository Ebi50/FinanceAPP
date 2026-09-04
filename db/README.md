# Datenbank

`schema.sql` ist die einzige Quelle der Wahrheit für das Datenmodell. Es gibt keine
Migrationen — Änderungen werden dort eingepflegt und von Hand eingespielt.

```bash
npm run db:schema     # spielt db/schema.sql gegen DATABASE_URL ein (idempotent)
```

## Umzug von Supabase

Kein `pg_dump`, kein `psql`, kein Editieren von SQL-Dateien. Ein Skript erledigt
Backup, Import und Abgleich in einem Lauf — und ist beliebig oft wiederholbar.

**1. `.env` setzen:**

```bash
DATABASE_URL=...            # neue Datenbank (Railway: oeffentliche Proxy-URL, lokal)
SUPABASE_DATABASE_URL=...   # Supabase: Project Settings → Database → Connection string
                           # moeglichst die direkte Verbindung (Port 5432), nicht den Pooler
```

**2. Schema in der neuen Datenbank anlegen:**

```bash
npm run db:schema
```

**3. Daten übernehmen:**

```bash
npm run migrate:from-supabase
```

Das Skript

- liest alle vier Tabellen aus Supabase (**nur SELECT**, Supabase bleibt unverändert)
  und legt sie zusätzlich als JSON unter `backups/<zeitstempel>/` ab (Rückfall-Backup),
- schreibt sie in `DATABASE_URL` — **Original-IDs bleiben erhalten** (`profiles.id`
  und `transactions.user_id` müssen zusammenpassen), `photo_url` fällt weg,
- läuft mit `ON CONFLICT DO NOTHING` → ein zweiter Lauf ergänzt nur neue Zeilen
  (so wird am Umzugsabend der finale Stand nachgezogen),
- vergleicht am Ende die Zeilenzahlen und bricht bei jeder Abweichung mit Fehler ab.

Zeigt ein `user_id`/`category_id` ins Leere, wird die Zeile **nicht verworfen**,
sondern mit `NULL` an dieser Stelle übernommen und am Ende aufgelistet.

**4. Passwörter und Profilbilder setzen** (Supabase-Passwörter werden nicht übernommen):

```bash
npm run set-password -- eberhard.janzen@freenet.de
npm run set-avatar   -- eberhard.janzen@freenet.de ./avatar-1.png
```

`--create` legt einen neuen Nutzer an, falls die E-Mail noch nicht in `profiles` steht.

## Backups

Supabase Pro hat täglich gesichert; diese Sicherung fällt mit dem Umzug weg. Vor dem
Cutover einen geplanten Dump einrichten (Railway-Cron oder GitHub Action) und **eine
Wiederherstellung einmal testen**:

```bash
pg_dump --no-owner --no-privileges -Fc "$DATABASE_URL" -f finanzapp-$(date +%F).dump
```

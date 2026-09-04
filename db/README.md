# Datenbank

`schema.sql` ist die einzige Quelle der Wahrheit für das Datenmodell. Es gibt keine
Migrationen — Änderungen werden dort eingepflegt und von Hand eingespielt.

```bash
npm run db:schema     # spielt db/schema.sql gegen DATABASE_URL ein (idempotent)
```

## Umzug von Supabase (Phase 0 und 1 des Migrationsplans)

Vorbereitung: `DATABASE_URL` in `.env` auf die neue Datenbank zeigen lassen.

**1. Zeilenzahlen bei Supabase notieren** — Vergleichsgrundlage nach dem Import:

```sql
select 'profiles', count(*) from profiles
union all select 'expense_categories', count(*) from expense_categories
union all select 'transactions', count(*) from transactions
union all select 'transaction_items', count(*) from transaction_items;
```

**2. Dumps ziehen** (der erste ist zugleich das Rückfall-Backup):

```bash
pg_dump --no-owner --no-privileges -Fc "<supabase-connection-string>" -f finanzapp-supabase.dump

pg_dump --no-owner --no-privileges --data-only --column-inserts \
  -t public.profiles -t public.expense_categories \
  -t public.transactions -t public.transaction_items \
  "<supabase-connection-string>" -f finanzapp-daten.sql
```

Die IDs aus `auth.users` müssen erhalten bleiben — sie stecken in `profiles.id` und in
jedem `transactions.user_id`. Deshalb wird ausschließlich `--data-only` importiert,
nie mit neu erzeugten UUIDs.

**3. Schema anlegen und Daten einspielen:**

```bash
npm run db:schema
psql "$DATABASE_URL" -f finanzapp-daten.sql
```

Der Dump enthält die Spalte `photo_url`, die es hier nicht mehr gibt. Falls der Import
deswegen scheitert, die `photo_url`-Werte aus den `INSERT`-Zeilen der Tabelle `profiles`
entfernen (die Bilder kommen in Schritt 5 zurück). Reihenfolge beachten: `profiles`,
dann `expense_categories`, dann `transactions`, dann `transaction_items` — der Dump
liefert sie bereits in dieser Reihenfolge.

**4. Zeilenzahlen gegenprüfen** — dieselbe Abfrage wie in Schritt 1 gegen die neue
Datenbank laufen lassen.

**5. Passwörter und Profilbilder setzen** (Supabase-Passwörter werden nicht übernommen):

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

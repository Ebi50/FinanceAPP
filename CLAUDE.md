# CLAUDE.md

Kontext für Claude Code in diesem Repository. Antworten und Commit-Messages auf Deutsch.

## Was das ist

Finanzapp — ein Haushalts-Ausgabentracker für einen gemeinsamen Haushalt. UI komplett deutsch,
Währung Euro mit deutscher Lokalisierung (`formatCurrency` in [src/lib/utils.ts](src/lib/utils.ts),
`date-fns` immer mit `locale: de`).

## Befehle

```bash
npm run dev         # Dev-Server auf Port 9002
npm run build       # Produktions-Build
npm run typecheck   # tsc --noEmit — der einzige echte Typcheck (siehe unten)
npm run lint

npm run db:schema             # db/schema.sql einspielen (idempotent)
npm run set-password -- <email> [--create]   # Passwort setzen / Nutzer anlegen
npm run set-avatar   -- <email> <bilddatei>  # Profilbild in die DB legen
```

`npm run build` setzt `NODE_ENV=production` in POSIX-Syntax und läuft deshalb unter
Windows-cmd nicht; lokal `NODE_ENV=production npx next build` in der Bash benutzen.

Es gibt keine Tests. `next.config.ts` setzt `typescript.ignoreBuildErrors` und
`eslint.ignoreDuringBuilds` — der Build schlägt bei Typfehlern **nicht** fehl.
Deshalb nach Änderungen immer `npm run typecheck` laufen lassen.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind + shadcn/ui (Radix),
Postgres über `pg` (kein ORM). Deploy auf Railway (`railway.toml`, nixpacks),
Healthcheck auf `/api/health`.

Historie: Firebase Studio → Supabase → eigene Server-Schicht auf Postgres
(siehe [docs/migration-supabase-abloesen.md](docs/migration-supabase-abloesen.md)).
Die einmaligen Migrationsskripte in [scripts/](scripts/) werden vom laufenden Code
nicht benutzt.

## Architektur

**UI ist komplett Client-Komponente, Datenzugriff läuft über eigene API-Routen.**
Es gibt keine Server-Actions ([src/lib/actions.ts](src/lib/actions.ts) ist leer) und kein
Data-Fetching in Server-Komponenten. Die Route Handlers unter [src/app/api/](src/app/api/)
sind die einzige Stelle, die die Datenbank sieht — eine Postgres-Verbindung darf niemals
im Browser landen.

Die Endpunkte sind bewusst **fachlich** geschnitten (`/api/transactions`,
`/api/categories`, …) und nehmen keine Tabellen-, Spalten- oder Filterparameter entgegen.
Ein generischer Endpunkt wäre ein selbstgebautes PostgREST ohne RLS — genau das, was
abgelöst wurde.

- [src/lib/db.ts](src/lib/db.ts): `Pool` (max 5), `query`/`queryOne`/`withTransaction`.
  Setzt den Typparser für `numeric`, sonst kämen Beträge als String zurück.
- [src/lib/server/auth.ts](src/lib/server/auth.ts): scrypt-Hashes, Session-Tabelle, Cookie.
- [src/lib/server/http.ts](src/lib/server/http.ts): `route()` / `authed()` umschließen jeden
  Handler; `authed()` ist die Autorisierung — **jeder** Handler muss darüber laufen.
- [src/lib/server/validation.ts](src/lib/server/validation.ts): zod-Schemata für die Bodies.

[middleware.ts](middleware.ts) läuft in der Edge-Runtime und darf deshalb **nicht** an die
Datenbank. Sie prüft nur, ob das Session-Cookie vorhanden ist, und leitet sonst auf `/login`
um. Ob die Session gültig ist, entscheidet jeder Route Handler selbst.

**[src/app/page.tsx](src/app/page.tsx) ist die Zentrale.** Sie hält den globalen Zeitraum-State
(`currentMonth` / `currentYear`), lädt die Daten und enthält alle Mutations-Handler
(`handleAddOrUpdateTransaction`, `handleDeleteTransaction`, `handleImportTransactions`).
Die Tabs (`dashboard-tab`, `transactions-tab`, `reports-tab`, `import-tab`) sind reine
Präsentation und bekommen Daten plus Callbacks als Props. Neue Datenlogik gehört in `page.tsx`,
nicht in einen Tab.

**Laden:** [src/lib/api-hooks.ts](src/lib/api-hooks.ts) enthält `useCollection` und darauf
aufbauend `useTransactions` / `useCategoryList` / `useTransactionYears` (kein React Query).
Rückgabeform ist überall `{ data, isLoading, error, setData, refetch }`. Daten werden in
`startTransition` gesetzt, damit große Listen die UI nicht blockieren.
[src/lib/api.ts](src/lib/api.ts) bündelt alle `fetch()`-Aufrufe; Fehler kommen als
`ApiError` mit deutscher Meldung aus dem Server.

Es gibt **kein Realtime mehr**. Ersatz ist ein Refetch beim Fensterfokus (höchstens alle
30 s) plus optimistische Updates und `refetch()` im Fehlerfall. Ändert der eine Nutzer etwas,
sieht der andere es also erst beim nächsten Fokuswechsel — bewusst akzeptiert.
Geladen wird weiterhin nur das gewählte Jahr plus alle Recurring-Vorlagen
(`GET /api/transactions?year=`).

**Anmeldung** kommt aus [src/lib/auth-provider.tsx](src/lib/auth-provider.tsx):
`useUser()` liefert `{ user, isUserLoading, userError }`, `useAuth()` zusätzlich
`refreshUser()` und `signOut()`. Nach jeder Änderung an Profildaten (Name, Budget,
Auto-Logout, Avatar) muss `refreshUser()` aufgerufen werden — ohne Realtime aktualisiert
sich der Provider sonst nicht.

**Kategorien** kommen global aus [src/lib/categories-context.tsx](src/lib/categories-context.tsx).
Die Einnahmen-Kategorie wird überall über den Namen erkannt:
`categories.find(c => c.name.toLowerCase() === 'einnahmen')`. Alles andere gilt als Ausgabe.
Wenn diese Kategorie umbenannt wird, brechen Dashboard, Berichte und Tabelle.

## Wiederkehrende Transaktionen

Das ist der komplizierteste Teil und die Quelle der meisten Bugs.

- In der DB existiert nur die **Vorlage**: eine Zeile mit `is_recurring = true`.
- Die Monatsinstanzen werden im Client erzeugt (`transactionsWithRecurrences` in `page.tsx`,
  bis zu 120 Monate, gefiltert auf das angezeigte Jahr). Sie haben `is_virtual = true` und die
  ID `<uuid>-recurring-<n>`.
- **Vor jedem DB-Schreibzugriff muss die Template-ID zurückgewonnen werden:**
  `id.split('-recurring-')[0]`. Nie `is_virtual` als Erkennungsmerkmal nehmen — der Flag geht
  über Props verloren, das ID-Format nicht (siehe Commit 54b7239).
- **Bearbeiten ab Datum** (`effectiveFrom`) ist ein Split: die alte Vorlage bekommt
  `recurring_end_date`, eine neue Vorlage mit `original_recurring_id` wird angelegt.
- **Löschen** kennt zwei Modi: `from_here` setzt nur `recurring_end_date`, `all` löscht die
  Vorlage und alle über `original_recurring_id` verketteten Folgevorlagen.

## Auth

Selbstgebaut und bewusst klein (zwei Nutzer, ein Haushalt):

- **Passwort-Hash:** `crypto.scrypt`, Format `scrypt$<salt-hex>$<hash-hex>` in
  `profiles.password_hash`. Keine Auth-Bibliothek, keine native Abhängigkeit.
- **Session:** Zufallstoken im Cookie `finanzapp_session` (`httpOnly`, `sameSite=lax`,
  `secure` in Produktion, 30 Tage). In der Tabelle `sessions` liegt nur der **SHA-256-Hash**
  des Tokens, damit ein DB-Dump keine gültigen Sitzungen enthält.
- **Autorisierung** entspricht der früheren RLS: angemeldet heißt "darf alles lesen"
  (gemeinsamer Haushalt), geschrieben wird nur auf eigene Zeilen (`user_id = session.user_id`).
- **Kein Passwort-Reset per Mail.** Ersatz: `npm run set-password -- <email>` lokal gegen die DB.
- Login ist gedrosselt (10 Fehlversuche je E-Mail und 15 Minuten, in-memory).
- Ein Passwortwechsel beendet alle anderen Sitzungen.

## Datenbank

Schema in [db/schema.sql](db/schema.sql): `profiles` (zugleich die Nutzertabelle),
`sessions`, `expense_categories`, `transactions`, `transaction_items` (mehrere Posten pro
Transaktion; `transactions.amount` ist die Summe und wird redundant mitgeführt).
Schema-Änderungen dort mitpflegen, die Datei ist die einzige Quelle der Wahrheit — es gibt
keine Migrationen. Einspielen mit `npm run db:schema`, Umzugsanleitung in
[db/README.md](db/README.md).

**Kein RLS.** Einziger Client der Datenbank ist die App, die sich als Eigentümer verbindet;
die Zugriffskontrolle sitzt vollständig in den Route Handlers.

`user_id` ist auf `ON DELETE SET NULL` gesetzt: Das Löschen eines Kontos darf die
Haushaltsdaten nicht mitnehmen. Solche Zeilen sind danach von niemandem mehr bearbeitbar.

Der Avatar liegt als `bytea` in `profiles.photo_data` und wird über `/api/avatar/<userId>`
ausgeliefert; die URL trägt `?v=<photo_updated_at>` als Cache-Buster.

## Radix / Pointer-Events-Falle

Ein wiederkehrendes Problem: Radix setzt beim Öffnen von Sheet/Dialog `body { pointer-events: none }`
und stellt es beim Schließen manchmal nicht wieder her — die UI friert ein. Etablierte Gegenmittel,
die beim Anfassen von Overlays beibehalten werden müssen:

- `document.activeElement.blur()` **bevor** ein Overlay aus einem anderen Overlay heraus geöffnet
  oder geschlossen wird (z. B. Bearbeiten aus dem DropdownMenu in `transactions-table.tsx`).
- Timeout-Reset beim Schließen des Sheets in [src/components/add-transaction-sheet.tsx](src/components/add-transaction-sheet.tsx).
- Globaler Watchdog (`usePointerEventsFix`, 300 ms Intervall) in [src/hooks/use-auto-logout.tsx](src/hooks/use-auto-logout.tsx).
- Popover innerhalb eines Sheets braucht `modal`, sonst ist das Kalender-Dropdown nicht bedienbar.
- AlertDialogs werden über State gesteuert und liegen **außerhalb** des DropdownMenus.

## Konventionen

- `timestamptz` kommt aus `pg` als `Date` und geht per `JSON.stringify` als ISO-UTC-String
  an den Client — dasselbe Format wie früher von PostgREST.
- Datumsangaben in der DB sind ISO-Strings (`timestamptz`). Im Client mit `parseISO` parsen,
  nie `new Date(string)`. Filtern nach Zeitraum passiert per String-Präfix (`date.startsWith('2026-03')`),
  bewusst — das vermeidet Zehntausende `parseISO`-Aufrufe (Commit 5311efc).
- Beträge auf 2 Nachkommastellen runden: `Math.round(x * 100) / 100`.
- UI-Komponenten in `src/components/ui/` sind generierte shadcn-Komponenten — nur anfassen,
  wenn es wirklich nötig ist.
- Berichte: PDF über jsPDF + jspdf-autotable, Chart-Bild über html2canvas.
  Import/Export: xlsx. Der Excel-Import erwartet ein festes Blattlayout (Monatsnamen als
  Sheet-Namen, Kategorien in Spaltenblöcken) und bietet zusätzlich ein Header-Mapping an.

## Offene Punkte

Siehe [TODO.md](TODO.md) — enthält u. a. einen offenen Sicherheitspunkt zum Firebase-Service-Account-Key.

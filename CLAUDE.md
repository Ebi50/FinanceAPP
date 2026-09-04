# CLAUDE.md

Kontext für Claude Code in diesem Repository. Antworten und Commit-Messages auf Deutsch.

## Was das ist

Finanzapp — ein Haushalts-Ausgabentracker für einen gemeinsamen Haushalt. UI komplett deutsch,
Währung Euro mit deutscher Lokalisierung (`formatCurrency` in [src/lib/utils.ts](src/lib/utils.ts),
`date-fns` immer mit `locale: de`).

## Befehle

```bash
npm run dev        # Dev-Server auf Port 9002
npm run build      # Produktions-Build
npm run typecheck  # tsc --noEmit — der einzige echte Typcheck (siehe unten)
npm run lint
```

Es gibt keine Tests. `next.config.ts` setzt `typescript.ignoreBuildErrors` und
`eslint.ignoreDuringBuilds` — der Build schlägt bei Typfehlern **nicht** fehl.
Deshalb nach Änderungen immer `npm run typecheck` laufen lassen.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind + shadcn/ui (Radix),
Supabase (Auth, Postgres, Realtime, Storage). Deploy auf Railway (`railway.toml`, nixpacks).
Ursprünglich Firebase Studio, migriert zu Supabase; die einmaligen Migrationsskripte liegen
noch in [scripts/](scripts/) und werden vom laufenden Code nicht benutzt.

## Architektur

**Alles ist Client-Komponente.** Es gibt keine Server-Actions und kein Data-Fetching auf dem
Server ([src/lib/actions.ts](src/lib/actions.ts) ist leer). Der Server macht nur
Session-Refresh in [middleware.ts](middleware.ts) → [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts).

**[src/app/page.tsx](src/app/page.tsx) ist die Zentrale.** Sie hält den globalen Zeitraum-State
(`currentMonth` / `currentYear`), lädt die Daten und enthält alle Mutations-Handler
(`handleAddOrUpdateTransaction`, `handleDeleteTransaction`, `handleImportTransactions`).
Die Tabs (`dashboard-tab`, `transactions-tab`, `reports-tab`, `import-tab`) sind reine
Präsentation und bekommen Daten plus Callbacks als Props. Neue Datenlogik gehört in `page.tsx`,
nicht in einen Tab.

**Laden:** [src/lib/supabase/hooks.ts](src/lib/supabase/hooks.ts) enthält eigene
`useTable` / `useRow`-Hooks (kein React Query). `useTable` paginiert selbst in 1000er-Chunks
(Supabase `max_rows`), macht debounced Realtime-Refetches und schreibt Daten in
`startTransition`. Für die Transaktionstabelle ist Realtime **bewusst deaktiviert**
(`realtime: false`) — stattdessen optimistische Updates plus `refetch()` im Fehlerfall.
Geladen wird nur das gewählte Jahr plus alle Recurring-Templates, über einen PostgREST-`or`-Filter.

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

## Datenbank

Schema in [supabase-schema.sql](supabase-schema.sql): `profiles`, `expense_categories`,
`transactions`, `transaction_items` (mehrere Posten pro Transaktion; `transactions.amount` ist
die Summe und wird redundant mitgeführt). Schema-Änderungen dort mitpflegen, die Datei ist die
einzige Quelle der Wahrheit — es gibt keine Migrationen.

RLS: Schreiben nur auf eigene Zeilen (`auth.uid()`), **Lesen für alle authentifizierten Nutzer**.
Das ist Absicht ("shared household"), kein Bug.

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

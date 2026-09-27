import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Speicherformat für Buchungsdaten: der Kalendertag des Nutzers, 12:00 UTC.
 * `date.toISOString()` auf lokaler Mitternacht ergibt in Deutschland den
 * Vortag (1. Oktober 00:00 MESZ = 2026-09-30T22:00Z), und die Monatsfilter
 * per String-Präfix ordnen die Buchung dann dem falschen Monat zu. Mittag UTC
 * liegt in jeder Zeitzone zwischen UTC-11 und UTC+11 auf demselben Kalendertag.
 */
export function toStorageDate(date: Date): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)).toISOString();
}

/**
 * Bringt ein gespeichertes Datum (auch Altdaten auf lokaler Mitternacht) ins
 * Speicherformat, bezogen auf den lokalen Kalendertag. `new Date()` ist hier
 * unbedenklich: der Server liefert immer vollständige ISO-Strings mit `Z`.
 */
export function normalizeStoredDate(iso: string): string {
  if (iso.endsWith('T12:00:00.000Z')) return iso;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : toStorageDate(date);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

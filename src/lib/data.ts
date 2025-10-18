// This file is no longer used for dynamic categories, but we can keep it for initial data seeding or as a reference.
import type { Category } from './types';

export const initialCategories: Omit<Category, 'id'>[] = [
  { name: 'Lebensmittel' },
  { name: 'Wohnen' },
  { name: 'Transport' },
  { name: 'Essen gehen' },
  { name: 'Gesundheit' },
  { name: 'Unterhaltung' },
  { name: 'Reisen' },
  { name: 'Geschenke' },
  { name: 'Bildung' },
  { name: 'Arbeit' },
  { name: 'Sparen' },
  { name: 'Kleidung' },
  { name: 'Haushalt' },
  { name: 'Einnahmen' },
];

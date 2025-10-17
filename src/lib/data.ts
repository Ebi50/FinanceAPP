import type { Transaction, Category } from './types';
import {
  Car,
  Home,
  Utensils,
  ShoppingBasket,
  Heartbeat,
  Film,
  Plane,
  Gift,
  GraduationCap,
  Briefcase,
  PiggyBank,
  Pizza,
  Bus,
  Train,
  Shirt,
  BookOpen,
} from 'lucide-react';

export const categories: Category[] = [
  { id: 'cat-1', name: 'Lebensmittel', icon: ShoppingBasket },
  { id: 'cat-2', name: 'Wohnen', icon: Home },
  { id: 'cat-3', name: 'Transport', icon: Car },
  { id: 'cat-4', name: 'Essen gehen', icon: Utensils },
  { id: 'cat-5', name: 'Gesundheit', icon: Heartbeat },
  { id: 'cat-6', name: 'Unterhaltung', icon: Film },
  { id: 'cat-7', name: 'Reisen', icon: Plane },
  { id: 'cat-8', name: 'Geschenke', icon: Gift },
  { id: 'cat-9', name: 'Bildung', icon: GraduationCap },
  { id: 'cat-10', name: 'Arbeit', icon: Briefcase },
  { id: 'cat-11', name: 'Sparen', icon: PiggyBank },
  { id: 'cat-12', name: 'Kleidung', icon: Shirt },
];

export const transactions: Transaction[] = [
  { id: 'txn-1', description: 'Wocheneinkauf Aldi', amount: 75.50, date: new Date('2024-07-28'), categoryId: 'cat-1' },
  { id: 'txn-2', description: 'Miete Juli', amount: 850.00, date: new Date('2024-07-01'), categoryId: 'cat-2' },
  { id: 'txn-3', description: 'Tanken Shell', amount: 60.20, date: new Date('2024-07-25'), categoryId: 'cat-3' },
  { id: 'txn-4', description: 'Pizza mit Freunden', amount: 25.00, date: new Date('2024-07-22'), categoryId: 'cat-4' },
  { id: 'txn-5', description: 'Apotheke', amount: 15.75, date: new Date('2024-07-20'), categoryId: 'cat-5' },
  { id: 'txn-6', description: 'Kino: Neuer Superheldenfilm', amount: 12.50, date: new Date('2024-07-18'), categoryId: 'cat-6' },
  { id: 'txn-7', description: 'Monatsticket Bahn', amount: 89.90, date: new Date('2024-07-01'), categoryId: 'cat-3' },
  { id: 'txn-8', description: 'Sommerjacke', amount: 120.00, date: new Date('2024-07-15'), categoryId: 'cat-12' },
  { id: 'txn-9', description: 'Geburtstagsgeschenk für Anna', amount: 45.00, date: new Date('2024-07-12'), categoryId: 'cat-8' },
  { id: 'txn-10', description: 'Fachbuch Programmierung', amount: 55.30, date: new Date('2024-07-10'), categoryId: 'cat-9' },
];

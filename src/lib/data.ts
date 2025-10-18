import type { Transaction, Category } from './types';
import {
  Car,
  Home,
  Utensils,
  ShoppingBasket,
  Heart,
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
  DollarSign,
} from 'lucide-react';

export const categories: Category[] = [
  { id: 'cat-1', name: 'Lebensmittel', icon: ShoppingBasket },
  { id: 'cat-2', name: 'Wohnen', icon: Home },
  { id: 'cat-3', name: 'Transport', icon: Car },
  { id: 'cat-4', name: 'Essen gehen', icon: Utensils },
  { id: 'cat-5', name: 'Gesundheit', icon: Heart },
  { id: 'cat-6', name: 'Unterhaltung', icon: Film },
  { id: 'cat-7', name: 'Reisen', icon: Plane },
  { id: 'cat-8', name: 'Geschenke', icon: Gift },
  { id: 'cat-9', name: 'Bildung', icon: GraduationCap },
  { id: 'cat-10', name: 'Arbeit', icon: Briefcase },
  { id: 'cat-11', name: 'Sparen', icon: PiggyBank },
  { id: 'cat-12', name: 'Kleidung', icon: Shirt },
  { id: 'cat-13', name: 'Haushalt', icon: Home },
  { id: 'cat-14', name: 'Einnahmen', icon: DollarSign },
];

export const transactions: Transaction[] = [];

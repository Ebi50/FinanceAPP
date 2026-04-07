-- ============================================
-- Performance & Security Fix for Finanzapp
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================

-- =====================
-- 1. ADD MISSING INDEXES
-- =====================

-- Critical: Used in JOIN for transaction items
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id
  ON public.transaction_items (transaction_id);

-- Filter transactions by user
CREATE INDEX IF NOT EXISTS idx_transactions_user_id
  ON public.transactions (user_id);

-- Filter categories by user
CREATE INDEX IF NOT EXISTS idx_categories_user_id
  ON public.expense_categories (user_id);

-- Filter transactions by category
CREATE INDEX IF NOT EXISTS idx_transactions_category_id
  ON public.transactions (category_id);

-- Sort/filter transactions by date
CREATE INDEX IF NOT EXISTS idx_transactions_date
  ON public.transactions (date DESC);

-- Composite index: user + date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON public.transactions (user_id, date DESC);


-- =====================
-- 2. FIX RLS POLICIES
-- Users should only see their own data
-- =====================

-- Fix expense_categories: Only own categories
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.expense_categories;
CREATE POLICY "Users can view own categories" ON public.expense_categories
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create categories" ON public.expense_categories;
CREATE POLICY "Users can create own categories" ON public.expense_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.expense_categories;
CREATE POLICY "Users can update own categories" ON public.expense_categories
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.expense_categories;
CREATE POLICY "Users can delete own categories" ON public.expense_categories
  FOR DELETE USING (auth.uid() = user_id);

-- Fix transactions: Only own transactions
DROP POLICY IF EXISTS "Authenticated users can view transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create transactions" ON public.transactions;
CREATE POLICY "Users can create own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can update transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can delete transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Fix transaction_items: Only items belonging to own transactions
DROP POLICY IF EXISTS "Authenticated users can view transaction items" ON public.transaction_items;
CREATE POLICY "Users can view own transaction items" ON public.transaction_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE transactions.id = transaction_items.transaction_id
        AND transactions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create transaction items" ON public.transaction_items;
CREATE POLICY "Users can create own transaction items" ON public.transaction_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE transactions.id = transaction_items.transaction_id
        AND transactions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update transaction items" ON public.transaction_items;
CREATE POLICY "Users can update own transaction items" ON public.transaction_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE transactions.id = transaction_items.transaction_id
        AND transactions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can delete transaction items" ON public.transaction_items;
CREATE POLICY "Users can delete own transaction items" ON public.transaction_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.transactions
      WHERE transactions.id = transaction_items.transaction_id
        AND transactions.user_id = auth.uid()
    )
  );

-- ============================================
-- Supabase Schema for Finanzapp
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  budget NUMERIC DEFAULT 2000,
  auto_logout_timeout INTEGER DEFAULT 0,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Expense Categories
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_recurring BOOLEAN DEFAULT false,
  original_recurring_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Transaction Items (line items)
CREATE TABLE public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  description TEXT
);

-- ============================================
-- Indexes (critical for query performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON public.transaction_items (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.expense_categories (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions (user_id, date DESC);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Expense Categories: Users can only access their own categories
CREATE POLICY "Users can view own categories" ON public.expense_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories" ON public.expense_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.expense_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.expense_categories
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions: Users can only access their own transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Transaction Items: Users can only access items of their own transactions
CREATE POLICY "Users can view own transaction items" ON public.transaction_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid())
  );

CREATE POLICY "Users can create own transaction items" ON public.transaction_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid())
  );

CREATE POLICY "Users can update own transaction items" ON public.transaction_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own transaction items" ON public.transaction_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid())
  );

-- ============================================
-- Realtime (enable for all tables)
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_items;

-- ============================================
-- Auto-create profile on user signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Storage Bucket for Avatars
-- ============================================
-- Run this via the Supabase Dashboard > Storage > Create bucket "avatars" (public)
-- Or use the SQL below:

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatars" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

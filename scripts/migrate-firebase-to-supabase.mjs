/**
 * Migration Script: Firebase → Supabase
 *
 * Prerequisites:
 * 1. npm install firebase-admin @supabase/supabase-js
 * 2. Place your Firebase service account JSON at ./service-account.json
 * 3. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 * 4. Create users in Supabase Auth first (same emails as Firebase)
 * 5. Run the supabase-schema.sql in your Supabase project
 *
 * Usage:
 * node scripts/migrate-firebase-to-supabase.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// --- Configuration ---
const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const firestore = getFirestore();
const firebaseAuth = getAuth();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin operations
);

// --- Step 1: Migrate Users ---
async function migrateUsers() {
  console.log('\n--- Migrating Users ---');
  const listResult = await firebaseAuth.listUsers();
  const userIdMap = new Map(); // Firebase UID → Supabase UUID

  for (const firebaseUser of listResult.users) {
    console.log(`  Processing user: ${firebaseUser.email}`);

    // Check if user already exists in Supabase
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === firebaseUser.email);

    let supabaseUserId;
    if (existing) {
      supabaseUserId = existing.id;
      console.log(`    Already exists in Supabase: ${supabaseUserId}`);
    } else {
      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: firebaseUser.email,
        email_confirm: true,
        password: 'CHANGE_ME_' + Math.random().toString(36).slice(2), // Temporary password
      });
      if (error) {
        console.error(`    Error creating user: ${error.message}`);
        continue;
      }
      supabaseUserId = data.user.id;
      console.log(`    Created in Supabase: ${supabaseUserId}`);
    }

    userIdMap.set(firebaseUser.uid, supabaseUserId);

    // Migrate profile from Firestore
    const profileDoc = await firestore.doc(`users/${firebaseUser.uid}`).get();
    if (profileDoc.exists) {
      const profile = profileDoc.data();
      const { error } = await supabase.from('profiles').upsert({
        id: supabaseUserId,
        first_name: profile.firstName || '',
        last_name: profile.lastName || '',
        email: firebaseUser.email,
        budget: profile.budget || 2000,
        auto_logout_timeout: profile.autoLogoutTimeout || 0,
        photo_url: profile.photoURL || '',
      });
      if (error) console.error(`    Profile error: ${error.message}`);
      else console.log(`    Profile migrated`);
    }
  }

  return userIdMap;
}

// --- Step 2: Migrate Categories ---
async function migrateCategories(userIdMap) {
  console.log('\n--- Migrating Categories ---');
  const categoryIdMap = new Map(); // Firebase doc ID → Supabase UUID

  const snapshot = await firestore.collection('expenseCategories').get();
  console.log(`  Found ${snapshot.size} categories`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const supabaseUserId = userIdMap.get(data.userId) || null;

    const { data: inserted, error } = await supabase
      .from('expense_categories')
      .insert({
        name: data.name,
        user_id: supabaseUserId,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  Error: ${data.name}: ${error.message}`);
    } else {
      categoryIdMap.set(doc.id, inserted.id);
      console.log(`  Migrated: ${data.name} (${doc.id} → ${inserted.id})`);
    }
  }

  return categoryIdMap;
}

// --- Step 3: Migrate Transactions ---
async function migrateTransactions(userIdMap, categoryIdMap) {
  console.log('\n--- Migrating Transactions ---');

  const snapshot = await firestore.collection('transactions').get();
  console.log(`  Found ${snapshot.size} transactions`);

  let successCount = 0;
  let errorCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const supabaseUserId = userIdMap.get(data.userId) || null;
    const supabaseCategoryId = categoryIdMap.get(data.categoryId) || null;

    const date = data.date?.toDate?.() || new Date();

    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert({
        description: data.description || '',
        amount: data.amount || 0,
        date: date.toISOString(),
        category_id: supabaseCategoryId,
        user_id: supabaseUserId,
        is_recurring: data.isRecurring || false,
        created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updated_at: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  Error: ${data.description}: ${error.message}`);
      errorCount++;
      continue;
    }

    // Migrate items if present
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      const items = data.items.map(item => ({
        transaction_id: inserted.id,
        value: item.value || 0,
        description: item.description || '',
      }));

      const { error: itemError } = await supabase
        .from('transaction_items')
        .insert(items);

      if (itemError) {
        console.error(`  Items error for ${data.description}: ${itemError.message}`);
      }
    }

    successCount++;
  }

  console.log(`\n  Migrated: ${successCount}, Errors: ${errorCount}`);
}

// --- Main ---
async function main() {
  console.log('=== Firebase → Supabase Migration ===');
  console.log('Start:', new Date().toISOString());

  const userIdMap = await migrateUsers();
  const categoryIdMap = await migrateCategories(userIdMap);
  await migrateTransactions(userIdMap, categoryIdMap);

  console.log('\n=== Migration Complete ===');
  console.log('End:', new Date().toISOString());
  console.log('\nIMPORTANT: Reset user passwords in Supabase Auth!');
}

main().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const sa = JSON.parse(readFileSync('./studio-6151698579-c04b2-firebase-adminsdk-fbsvc-68f806c2cc.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Step 1: Delete everything
  console.log('Cleaning Supabase...');
  await supabase.from('transaction_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { count: check } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
  console.log('Transactions after delete:', check);

  // Step 2: Category mapping (Firebase ID -> Supabase ID)
  const { data: sbCats } = await supabase.from('expense_categories').select('id, name');
  const cats = JSON.parse(readFileSync('./export/categories.json', 'utf8'));
  const catMap = new Map();
  for (const fbCat of cats) {
    const sbCat = sbCats.find(c => c.name === fbCat.name);
    if (sbCat) catMap.set(fbCat.firebaseId, sbCat.id);
    else console.log('  No match for category:', fbCat.name);
  }
  console.log('Category mappings:', catMap.size, '/', cats.length);

  // Step 3: User mapping (Firebase UID -> Supabase UUID)
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  const fbUsers = await getAuth().listUsers();
  const userMap = new Map();
  for (const fbUser of fbUsers.users) {
    const sbUser = allUsers.users.find(u => u.email === fbUser.email);
    if (sbUser) {
      userMap.set(fbUser.uid, sbUser.id);
      console.log('  User:', fbUser.email, '->', sbUser.id);
    }
  }

  // Step 4: Import global transactions
  const transactions = JSON.parse(readFileSync('./export/transactions.json', 'utf8'));
  console.log('\nImporting', transactions.length, 'transactions...');

  let success = 0;
  let errors = 0;
  const unmappedCats = new Set();

  for (let i = 0; i < transactions.length; i += 500) {
    const chunk = transactions.slice(i, i + 500);
    const rows = chunk.map(t => {
      const catId = catMap.get(t.categoryId);
      if (!catId && t.categoryId) unmappedCats.add(t.categoryId);
      return {
        description: t.description || '',
        amount: t.amount || 0,
        date: t.date || new Date().toISOString(),
        category_id: catId || null,
        user_id: userMap.get(t.userId) || null,
        is_recurring: t.isRecurring || false,
        created_at: t.createdAt || new Date().toISOString(),
        updated_at: t.updatedAt || new Date().toISOString(),
      };
    });

    const { data: inserted, error } = await supabase.from('transactions').insert(rows).select('id');
    if (error) {
      console.error('  Batch error at', i, ':', error.message);
      errors += chunk.length;
    } else {
      success += inserted.length;

      // Insert items
      const items = [];
      for (let j = 0; j < chunk.length; j++) {
        if (chunk[j].items?.length > 0 && inserted[j]) {
          for (const item of chunk[j].items) {
            items.push({
              transaction_id: inserted[j].id,
              value: item.value || 0,
              description: item.description || '',
            });
          }
        }
      }
      if (items.length > 0) {
        await supabase.from('transaction_items').insert(items);
      }
    }
    process.stdout.write('  ' + Math.min(i + 500, transactions.length) + '/' + transactions.length + '\r');
  }

  console.log('\nGlobal import:', success, 'OK,', errors, 'errors');
  if (unmappedCats.size > 0) console.log('Unmapped categories:', [...unmappedCats]);

  // Step 5: Import unique subcollection transactions
  const subTx = JSON.parse(readFileSync('./export/subcollection-tx-TahfdhcrDcXlIAFW01K9uQzLT5v1.json', 'utf8'));
  const globalKeys = new Set(transactions.map(t => t.description + '|' + t.amount + '|' + t.date));
  const uniqueSub = subTx.filter(t => !globalKeys.has(t.description + '|' + t.amount + '|' + t.date));
  console.log('\nUnique subcollection transactions:', uniqueSub.length);

  if (uniqueSub.length > 0) {
    const subCatsSnap = await db.collection('users/TahfdhcrDcXlIAFW01K9uQzLT5v1/expenseCategories').get();
    const subCatNameMap = new Map();
    subCatsSnap.forEach(doc => subCatNameMap.set(doc.id, doc.data().name));

    const nameMapping = {
      'garten': 'Garten 6', 'körperpflege': 'Körperpflege 2', 'haushalt': 'Haushalt 4',
      'telefon / büro': 'Telefon/Büro 10', 'kinder': 'Kinder 11',
      'freizeit / geschenke': 'Freize./Geschenke 8', 'krankenversicherung': 'KV 12',
      'lebensmittel': 'Lebensmittel 1', 'kleidung': 'Kleidung 3',
      'lesen': 'Zeitschr./Bücher 7', 'auto': 'Auto 5',
      'einnahmen': 'Einnahmen', 'radsport': 'Radsport',
    };
    const nameToSbId = new Map();
    for (const [oldName, newName] of Object.entries(nameMapping)) {
      const sbCat = sbCats.find(c => c.name === newName);
      if (sbCat) nameToSbId.set(oldName, sbCat.id);
    }

    const subRows = uniqueSub.map(t => {
      const oldCatName = subCatNameMap.get(t.categoryId)?.toLowerCase();
      return {
        description: t.description || '',
        amount: t.amount || 0,
        date: t.date || new Date().toISOString(),
        category_id: nameToSbId.get(oldCatName) || null,
        user_id: userMap.get('TahfdhcrDcXlIAFW01K9uQzLT5v1') || null,
        is_recurring: t.isRecurring || false,
      };
    });

    const { error } = await supabase.from('transactions').insert(subRows);
    if (error) console.error('Sub import error:', error.message);
    else console.log('Subcollection import done:', subRows.length);
  }

  // Final count
  let total = 0;
  let from = 0;
  while (true) {
    const { data } = await supabase.from('transactions').select('id').range(from, from + 999);
    if (!data || data.length === 0) break;
    total += data.length;
    if (data.length < 1000) break;
    from += 1000;
  }
  const { count: nullCat } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).is('category_id', null);

  console.log('\n=== Final Result ===');
  console.log('Total transactions:', total);
  console.log('Without category:', nullCat);
}

run().catch(console.error);

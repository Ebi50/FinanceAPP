/**
 * Firebase Firestore Export Script
 * 
 * Exportiert alle Daten aus den 3 Firestore Collections als JSON-Dateien:
 * - transactions.json
 * - expenseCategories.json  
 * - users.json
 * 
 * ANLEITUNG:
 * 1. Stelle sicher dass du in C:\Users\eberh\Finanzapp bist
 * 2. Lege die Firebase Service Account JSON-Datei ab als:
 *    scripts/firebase-service-account.json
 *    (Download: Firebase Console → Projekteinstellungen → Dienstkonten → Neuen privaten Schlüssel generieren)
 * 3. Führe aus: node scripts/export-firestore.js
 * 4. Die JSON-Dateien werden in scripts/export/ gespeichert
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- Konfiguration ---
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');
const EXPORT_DIR = path.join(__dirname, 'export');
const COLLECTIONS = ['transactions', 'expenseCategories', 'users'];

// --- Prüfungen ---
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('\n❌ FEHLER: firebase-service-account.json nicht gefunden!');
  console.error('');
  console.error('So bekommst du die Datei:');
  console.error('1. Öffne https://console.firebase.google.com');
  console.error('2. Wähle dein Projekt "studio-6151698579-c04b2"');
  console.error('3. Projekteinstellungen (Zahnrad) → Dienstkonten');
  console.error('4. Klicke "Neuen privaten Schlüssel generieren"');
  console.error('5. Speichere die Datei als:');
  console.error('   C:\\Users\\eberh\\Finanzapp\\scripts\\firebase-service-account.json');
  console.error('');
  process.exit(1);
}

// --- Firebase initialisieren ---
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- Export-Verzeichnis erstellen ---
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// --- Hilfsfunktion: Firestore-Datentypen in JSON-kompatible Werte umwandeln ---
function convertFirestoreValue(value) {
  if (value === null || value === undefined) return value;
  
  // Firestore Timestamp → ISO String
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  
  // Firestore GeoPoint
  if (value && value.latitude !== undefined && value.longitude !== undefined) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  
  // Array
  if (Array.isArray(value)) {
    return value.map(convertFirestoreValue);
  }
  
  // Verschachteltes Objekt
  if (typeof value === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = convertFirestoreValue(val);
    }
    return result;
  }
  
  return value;
}

// --- Hauptfunktion ---
async function exportCollections() {
  console.log('🔄 Firebase Firestore Export gestartet...');
  console.log(`📁 Export-Verzeichnis: ${EXPORT_DIR}`);
  console.log('');

  let totalDocs = 0;

  for (const collectionName of COLLECTIONS) {
    try {
      console.log(`📦 Exportiere "${collectionName}"...`);
      
      const snapshot = await db.collection(collectionName).get();
      const documents = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        const converted = convertFirestoreValue(data);
        documents.push({
          _firestoreId: doc.id,
          ...converted
        });
      });

      const outputPath = path.join(EXPORT_DIR, `${collectionName}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(documents, null, 2), 'utf8');

      console.log(`   ✅ ${documents.length} Dokumente exportiert → ${collectionName}.json`);
      totalDocs += documents.length;

    } catch (error) {
      console.error(`   ❌ Fehler bei "${collectionName}": ${error.message}`);
    }
  }

  console.log('');
  console.log(`🎉 Export abgeschlossen! ${totalDocs} Dokumente insgesamt.`);
  console.log(`📂 Dateien in: ${EXPORT_DIR}`);
  console.log('');
  console.log('NÄCHSTE SCHRITTE:');
  console.log('1. Prüfe die JSON-Dateien im export/ Ordner');
  console.log('2. Sichere die Dateien (z.B. auf eine externe Festplatte)');
  console.log('3. Lösche firebase-service-account.json (Sicherheit!)');

  // Firebase sauber beenden
  await admin.app().delete();
}

exportCollections().catch(err => {
  console.error('❌ Unerwarteter Fehler:', err.message);
  process.exit(1);
});

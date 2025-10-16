import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'data', 'expenses.db');

// Create database instance
export const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export async function initializeDatabase() {
  console.log('🗄️  Initializing database...');
  
  try {
    // Create categories table
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#6B7280',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create subcategories table
    db.exec(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
        UNIQUE(category_id, name)
      )
    `);

    // Create category_examples table (key feature from specification)
    db.exec(`
      CREATE TABLE IF NOT EXISTS category_examples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        subcategory_id INTEGER,
        default_notes TEXT,
        keywords TEXT, -- JSON array stored as text
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
        FOREIGN KEY (subcategory_id) REFERENCES subcategories (id) ON DELETE SET NULL
      )
    `);

    // Create transactions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        category_id INTEGER NOT NULL,
        subcategory_id INTEGER,
        date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id),
        FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
      )
    `);

    // Create indexes for better performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_category_examples_keywords ON category_examples(keywords);
    `);

    // Insert default categories if they don't exist
    const existingCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    
    if (existingCategories.count === 0) {
      console.log('📝 Inserting default categories...');
      
      const insertCategory = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
      const insertSubcategory = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)');
      const insertExample = db.prepare(`
        INSERT INTO category_examples (category_id, description, subcategory_id, default_notes, keywords) 
        VALUES (?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction(() => {
        // Food category
        const foodId = insertCategory.run('Food', '#10B981').lastInsertRowid;
        const groceriesId = insertSubcategory.run(foodId, 'Groceries').lastInsertRowid;
        const restaurantsId = insertSubcategory.run(foodId, 'Restaurants').lastInsertRowid;
        const coffeeId = insertSubcategory.run(foodId, 'Coffee').lastInsertRowid;
        insertSubcategory.run(foodId, 'Takeout');
        
        // Food examples
        insertExample.run(foodId, 'REWE', groceriesId, 'Weekly shopping', JSON.stringify(['rewe', 'supermarket', 'grocery']));
        insertExample.run(foodId, 'EDEKA', groceriesId, 'Grocery shopping', JSON.stringify(['edeka', 'supermarket', 'grocery']));
        insertExample.run(foodId, 'McDonald\'s', restaurantsId, null, JSON.stringify(['mcdonalds', 'mcdonald', 'fast food']));
        insertExample.run(foodId, 'Starbucks', coffeeId, null, JSON.stringify(['starbucks', 'coffee', 'cafe']));

        // Transportation category
        const transportId = insertCategory.run('Transportation', '#3B82F6').lastInsertRowid;
        const fuelId = insertSubcategory.run(transportId, 'Fuel').lastInsertRowid;
        const publicTransportId = insertSubcategory.run(transportId, 'Public Transport').lastInsertRowid;
        insertSubcategory.run(transportId, 'Parking');
        insertSubcategory.run(transportId, 'Maintenance');
        
        // Transportation examples
        insertExample.run(transportId, 'Shell', fuelId, null, JSON.stringify(['shell', 'tankstelle', 'gas', 'fuel']));
        insertExample.run(transportId, 'Aral', fuelId, null, JSON.stringify(['aral', 'tankstelle', 'gas', 'fuel']));
        insertExample.run(transportId, 'Deutsche Bahn', publicTransportId, null, JSON.stringify(['db', 'deutsche bahn', 'train', 'bahn']));

        // Shopping category
        const shoppingId = insertCategory.run('Shopping', '#8B5CF6').lastInsertRowid;
        insertSubcategory.run(shoppingId, 'Clothing');
        insertSubcategory.run(shoppingId, 'Electronics');
        insertSubcategory.run(shoppingId, 'Home');
        insertSubcategory.run(shoppingId, 'Books');

        // Utilities category
        const utilitiesId = insertCategory.run('Utilities', '#F59E0B').lastInsertRowid;
        insertSubcategory.run(utilitiesId, 'Electricity');
        insertSubcategory.run(utilitiesId, 'Water');
        insertSubcategory.run(utilitiesId, 'Internet');
        insertSubcategory.run(utilitiesId, 'Phone');

        // Income category
        const incomeId = insertCategory.run('Income', '#10B981').lastInsertRowid;
        insertSubcategory.run(incomeId, 'Salary');
        insertSubcategory.run(incomeId, 'Freelance');
        insertSubcategory.run(incomeId, 'Investment');
      });

      transaction();
      console.log('✅ Default categories and examples created');
    }

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Helper function to get category suggestions based on description
export function getCategorySuggestions(description: string): Array<{
  categoryId: number;
  categoryName: string;
  subcategoryId?: number;
  subcategoryName?: string;
  defaultNotes?: string;
  confidence: number;
}> {
  const query = `
    SELECT 
      ce.category_id,
      c.name as category_name,
      ce.subcategory_id,
      s.name as subcategory_name,
      ce.default_notes,
      ce.keywords
    FROM category_examples ce
    JOIN categories c ON ce.category_id = c.id
    LEFT JOIN subcategories s ON ce.subcategory_id = s.id
  `;
  
  const examples = db.prepare(query).all();
  const suggestions = [];
  
  for (const example of examples) {
    const keywords = JSON.parse(example.keywords || '[]');
    let confidence = 0;
    
    // Check if description contains any keywords
    const descLower = description.toLowerCase();
    for (const keyword of keywords) {
      if (descLower.includes(keyword.toLowerCase())) {
        confidence += 1;
      }
    }
    
    if (confidence > 0) {
      suggestions.push({
        categoryId: example.category_id,
        categoryName: example.category_name,
        subcategoryId: example.subcategory_id,
        subcategoryName: example.subcategory_name,
        defaultNotes: example.default_notes,
        confidence
      });
    }
  }
  
  // Sort by confidence and return top matches
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

export default db;
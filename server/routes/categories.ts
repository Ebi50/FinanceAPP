import express from 'express';
import { db } from '../database';

const router = express.Router();

// Get all categories with subcategories
router.get('/', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.color,
        c.created_at,
        GROUP_CONCAT(s.name) as subcategories,
        GROUP_CONCAT(s.id) as subcategory_ids
      FROM categories c
      LEFT JOIN subcategories s ON c.id = s.category_id
      GROUP BY c.id, c.name, c.color, c.created_at
      ORDER BY c.name
    `).all();
    
    // Parse subcategories into arrays
    const parsedCategories = categories.map(category => ({
      ...category,
      subcategories: category.subcategories 
        ? category.subcategories.split(',').map((name, index) => ({
            id: parseInt(category.subcategory_ids.split(',')[index]),
            name: name
          }))
        : []
    }));
    
    // Remove the comma-separated strings
    parsedCategories.forEach(category => {
      delete category.subcategory_ids;
    });
    
    res.json(parsedCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get category by ID with subcategories and examples
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Get category
    const category = db.prepare(`
      SELECT id, name, color, created_at
      FROM categories 
      WHERE id = ?
    `).get(id);
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Get subcategories
    const subcategories = db.prepare(`
      SELECT id, name
      FROM subcategories 
      WHERE category_id = ?
      ORDER BY name
    `).all(id);
    
    // Get examples
    const examples = db.prepare(`
      SELECT 
        ce.id,
        ce.description,
        ce.subcategory_id,
        ce.default_notes,
        ce.keywords,
        s.name as subcategory_name
      FROM category_examples ce
      LEFT JOIN subcategories s ON ce.subcategory_id = s.id
      WHERE ce.category_id = ?
      ORDER BY ce.description
    `).all(id);
    
    // Parse keywords
    const parsedExamples = examples.map(example => ({
      ...example,
      keywords: JSON.parse(example.keywords || '[]')
    }));
    
    res.json({
      ...category,
      subcategories,
      examples: parsedExamples
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Create new category
router.post('/', (req, res) => {
  try {
    const { name, color = '#6B7280', subcategories = [] } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const transaction = db.transaction(() => {
      // Insert category
      const categoryStmt = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
      const categoryResult = categoryStmt.run(name, color);
      const categoryId = categoryResult.lastInsertRowid;
      
      // Insert subcategories
      if (subcategories.length > 0) {
        const subcategoryStmt = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)');
        for (const subcategoryName of subcategories) {
          subcategoryStmt.run(categoryId, subcategoryName);
        }
      }
      
      return categoryId;
    });
    
    const categoryId = transaction();
    
    // Return the created category with subcategories
    const newCategory = db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.color,
        c.created_at
      FROM categories c
      WHERE c.id = ?
    `).get(categoryId);
    
    const subcategoriesData = db.prepare(`
      SELECT id, name
      FROM subcategories 
      WHERE category_id = ?
      ORDER BY name
    `).all(categoryId);
    
    res.status(201).json({
      ...newCategory,
      subcategories: subcategoriesData
    });
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Category name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
});

// Update category
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    
    // Check if category exists
    const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const stmt = db.prepare(`
      UPDATE categories 
      SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(name, color, id);
    
    // Return updated category
    const updatedCategory = db.prepare(`
      SELECT id, name, color, created_at
      FROM categories 
      WHERE id = ?
    `).get(id);
    
    const subcategories = db.prepare(`
      SELECT id, name
      FROM subcategories 
      WHERE category_id = ?
      ORDER BY name
    `).all(id);
    
    res.json({
      ...updatedCategory,
      subcategories
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category has transactions
    const transactionCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE category_id = ?').get(id);
    
    if (transactionCount.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category with existing transactions',
        transactionCount: transactionCount.count
      });
    }
    
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Get category examples
router.get('/:id/examples', (req, res) => {
  try {
    const { id } = req.params;
    
    const examples = db.prepare(`
      SELECT 
        ce.id,
        ce.description,
        ce.subcategory_id,
        ce.default_notes,
        ce.keywords,
        s.name as subcategory_name
      FROM category_examples ce
      LEFT JOIN subcategories s ON ce.subcategory_id = s.id
      WHERE ce.category_id = ?
      ORDER BY ce.description
    `).all(id);
    
    // Parse keywords
    const parsedExamples = examples.map(example => ({
      ...example,
      keywords: JSON.parse(example.keywords || '[]')
    }));
    
    res.json(parsedExamples);
  } catch (error) {
    console.error('Error fetching category examples:', error);
    res.status(500).json({ error: 'Failed to fetch category examples' });
  }
});

// Add category example
router.post('/:id/examples', (req, res) => {
  try {
    const { id } = req.params;
    const { description, subcategoryId, defaultNotes, keywords = [] } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }
    
    // Check if category exists
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO category_examples (category_id, description, subcategory_id, default_notes, keywords)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(id, description, subcategoryId || null, defaultNotes || null, JSON.stringify(keywords));
    
    // Return the created example
    const newExample = db.prepare(`
      SELECT 
        ce.id,
        ce.description,
        ce.subcategory_id,
        ce.default_notes,
        ce.keywords,
        s.name as subcategory_name
      FROM category_examples ce
      LEFT JOIN subcategories s ON ce.subcategory_id = s.id
      WHERE ce.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      ...newExample,
      keywords: JSON.parse(newExample.keywords || '[]')
    });
  } catch (error) {
    console.error('Error creating category example:', error);
    res.status(500).json({ error: 'Failed to create category example' });
  }
});

// Delete category example
router.delete('/:categoryId/examples/:exampleId', (req, res) => {
  try {
    const { categoryId, exampleId } = req.params;
    
    const stmt = db.prepare('DELETE FROM category_examples WHERE id = ? AND category_id = ?');
    const result = stmt.run(exampleId, categoryId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category example not found' });
    }
    
    res.json({ message: 'Category example deleted successfully' });
  } catch (error) {
    console.error('Error deleting category example:', error);
    res.status(500).json({ error: 'Failed to delete category example' });
  }
});

export default router;
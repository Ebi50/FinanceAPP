import express from 'express';
import { db, getCategorySuggestions } from '../database';

const router = express.Router();

// Get all transactions
router.get('/', (req, res) => {
  try {
    const { category, search, month, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        t.id,
        t.description,
        t.amount,
        t.date,
        t.notes,
        c.name as category,
        c.color as category_color,
        s.name as subcategory
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN subcategories s ON t.subcategory_id = s.id
    `;
    
    const conditions = [];
    const params = [];
    
    if (category && category !== 'All') {
      conditions.push('c.name = ?');
      params.push(category);
    }
    
    if (search) {
      conditions.push('(t.description LIKE ? OR c.name LIKE ? OR s.name LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (month) {
      conditions.push('strftime("%Y-%m", t.date) = ?');
      params.push(month);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY t.date DESC, t.id DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const transactions = db.prepare(query).all(...params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM transactions t JOIN categories c ON t.category_id = c.id LEFT JOIN subcategories s ON t.subcategory_id = s.id';
    const countParams = [];
    
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
      countParams.push(...params.slice(0, -2)); // Remove limit and offset
    }
    
    const { total } = db.prepare(countQuery).get(...countParams);
    
    res.json({
      transactions,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < total
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get transaction by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = db.prepare(`
      SELECT 
        t.id,
        t.description,
        t.amount,
        t.date,
        t.notes,
        t.category_id,
        t.subcategory_id,
        c.name as category,
        c.color as category_color,
        s.name as subcategory
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN subcategories s ON t.subcategory_id = s.id
      WHERE t.id = ?
    `).get(id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Create new transaction
router.post('/', (req, res) => {
  try {
    const { description, amount, categoryId, subcategoryId, date, notes } = req.body;
    
    // Validate required fields
    if (!description || !amount || !categoryId || !date) {
      return res.status(400).json({ 
        error: 'Missing required fields: description, amount, categoryId, date' 
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO transactions (description, amount, category_id, subcategory_id, date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(description, amount, categoryId, subcategoryId || null, date, notes || null);
    
    // Return the created transaction
    const newTransaction = db.prepare(`
      SELECT 
        t.id,
        t.description,
        t.amount,
        t.date,
        t.notes,
        c.name as category,
        c.color as category_color,
        s.name as subcategory
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN subcategories s ON t.subcategory_id = s.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(newTransaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Update transaction
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { description, amount, categoryId, subcategoryId, date, notes } = req.body;
    
    // Check if transaction exists
    const existing = db.prepare('SELECT id FROM transactions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const stmt = db.prepare(`
      UPDATE transactions 
      SET description = ?, amount = ?, category_id = ?, subcategory_id = ?, date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(description, amount, categoryId, subcategoryId || null, date, notes || null, id);
    
    // Return updated transaction
    const updatedTransaction = db.prepare(`
      SELECT 
        t.id,
        t.description,
        t.amount,
        t.date,
        t.notes,
        c.name as category,
        c.color as category_color,
        s.name as subcategory
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN subcategories s ON t.subcategory_id = s.id
      WHERE t.id = ?
    `).get(id);
    
    res.json(updatedTransaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete transaction
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Get category suggestions for a description
router.post('/suggest-category', (req, res) => {
  try {
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }
    
    const suggestions = getCategorySuggestions(description);
    res.json({ suggestions });
  } catch (error) {
    console.error('Error getting category suggestions:', error);
    res.status(500).json({ error: 'Failed to get category suggestions' });
  }
});

export default router;
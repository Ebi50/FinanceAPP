import express from 'express';
import { db } from '../database';

const router = express.Router();

// Get monthly summary
router.get('/monthly', (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (month) {
      dateFilter = 'WHERE strftime("%Y", date) = ? AND strftime("%m", date) = ?';
      params.push(year.toString(), month.toString().padStart(2, '0'));
    } else {
      dateFilter = 'WHERE strftime("%Y", date) = ?';
      params.push(year.toString());
    }
    
    // Get monthly totals
    const monthlyTotals = db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses,
        COUNT(*) as transaction_count
      FROM transactions
      ${dateFilter}
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month
    `).all(...params);
    
    res.json(monthlyTotals);
  } catch (error) {
    console.error('Error fetching monthly report:', error);
    res.status(500).json({ error: 'Failed to fetch monthly report' });
  }
});

// Get category breakdown
router.get('/categories', (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (month) {
      dateFilter = 'WHERE strftime("%Y", t.date) = ? AND strftime("%m", t.date) = ?';
      params.push(year.toString(), month.toString().padStart(2, '0'));
    } else {
      dateFilter = 'WHERE strftime("%Y", t.date) = ?';
      params.push(year.toString());
    }
    
    const categoryBreakdown = db.prepare(`
      SELECT 
        c.name as category,
        c.color,
        SUM(ABS(t.amount)) as total_amount,
        COUNT(t.id) as transaction_count,
        AVG(ABS(t.amount)) as avg_amount
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      ${dateFilter}
      GROUP BY c.id, c.name, c.color
      ORDER BY total_amount DESC
    `).all(...params);
    
    // Calculate percentages
    const totalSpent = categoryBreakdown.reduce((sum, cat) => sum + cat.total_amount, 0);
    
    const categoryData = categoryBreakdown.map(cat => ({
      ...cat,
      percentage: totalSpent > 0 ? (cat.total_amount / totalSpent) * 100 : 0
    }));
    
    res.json({
      categories: categoryData,
      totalSpent,
      period: month ? `${year}-${month.toString().padStart(2, '0')}` : year
    });
  } catch (error) {
    console.error('Error fetching category breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch category breakdown' });
  }
});

// Get spending trends
router.get('/trends', (req, res) => {
  try {
    const { period = 'month', limit = 12 } = req.query;
    
    let groupBy = '';
    let orderBy = '';
    
    switch (period) {
      case 'day':
        groupBy = 'strftime("%Y-%m-%d", date)';
        orderBy = 'date_group DESC';
        break;
      case 'week':
        groupBy = 'strftime("%Y-%W", date)';
        orderBy = 'date_group DESC';
        break;
      case 'month':
        groupBy = 'strftime("%Y-%m", date)';
        orderBy = 'date_group DESC';
        break;
      case 'year':
        groupBy = 'strftime("%Y", date)';
        orderBy = 'date_group DESC';
        break;
      default:
        groupBy = 'strftime("%Y-%m", date)';
        orderBy = 'date_group DESC';
    }
    
    const trends = db.prepare(`
      SELECT 
        ${groupBy} as date_group,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses,
        COUNT(*) as transaction_count
      FROM transactions
      GROUP BY ${groupBy}
      ORDER BY ${orderBy}
      LIMIT ?
    `).all(Number(limit));
    
    // Reverse to get chronological order
    const chronologicalTrends = trends.reverse();
    
    res.json({
      trends: chronologicalTrends,
      period,
      limit: Number(limit)
    });
  } catch (error) {
    console.error('Error fetching spending trends:', error);
    res.status(500).json({ error: 'Failed to fetch spending trends' });
  }
});

// Get dashboard summary
router.get('/dashboard', (req, res) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear().toString();
    const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    // Current month totals
    const monthlyTotals = db.prepare(`
      SELECT 
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
    `).get(currentYear, currentMonth);
    
    // Category count
    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    
    // Recent transactions
    const recentTransactions = db.prepare(`
      SELECT 
        t.id,
        t.description,
        t.amount,
        t.date,
        c.name as category,
        s.name as subcategory
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN subcategories s ON t.subcategory_id = s.id
      ORDER BY t.date DESC, t.id DESC
      LIMIT 5
    `).all();
    
    // Top spending categories this month
    const topCategories = db.prepare(`
      SELECT 
        c.name as category,
        c.color,
        SUM(ABS(t.amount)) as total_amount
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE strftime('%Y', t.date) = ? AND strftime('%m', t.date) = ? AND t.amount < 0
      GROUP BY c.id, c.name, c.color
      ORDER BY total_amount DESC
      LIMIT 5
    `).all(currentYear, currentMonth);
    
    const netSavings = (monthlyTotals.income || 0) - (monthlyTotals.expenses || 0);
    const savingsRate = monthlyTotals.income > 0 
      ? (netSavings / monthlyTotals.income) * 100 
      : 0;
    
    res.json({
      monthly: {
        income: monthlyTotals.income || 0,
        expenses: monthlyTotals.expenses || 0,
        netSavings,
        savingsRate,
        transactionCount: monthlyTotals.transaction_count || 0
      },
      categoryCount: categoryCount.count,
      recentTransactions,
      topCategories,
      period: `${currentYear}-${currentMonth}`
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// Export data as CSV
router.get('/export/csv', (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    
    let query = `
      SELECT 
        t.date,
        t.description,
        t.amount,
        c.name as category,
        s.name as subcategory,
        t.notes
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN subcategories s ON t.subcategory_id = s.id
    `;
    
    const conditions = [];
    const params = [];
    
    if (startDate) {
      conditions.push('t.date >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      conditions.push('t.date <= ?');
      params.push(endDate);
    }
    
    if (category && category !== 'All') {
      conditions.push('c.name = ?');
      params.push(category);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY t.date DESC, t.id DESC';
    
    const transactions = db.prepare(query).all(...params);
    
    // Convert to CSV
    const headers = ['Date', 'Description', 'Amount', 'Category', 'Subcategory', 'Notes'];
    const csvRows = [headers.join(',')];
    
    for (const transaction of transactions) {
      const row = [
        transaction.date,
        `"${transaction.description.replace(/"/g, '""')}"`,
        transaction.amount,
        `"${transaction.category}"`,
        transaction.subcategory ? `"${transaction.subcategory}"` : '',
        transaction.notes ? `"${transaction.notes.replace(/"/g, '""')}"` : ''
      ];
      csvRows.push(row.join(','));
    }
    
    const csvContent = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

export default router;
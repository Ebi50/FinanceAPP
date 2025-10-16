import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Plus, 
  Lightbulb, 
  Calendar,
  DollarSign,
  FileText,
  Tag
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
  color: string;
  subcategories: Array<{ id: number; name: string }>;
}

interface CategorySuggestion {
  categoryId: number;
  categoryName: string;
  subcategoryId?: number;
  subcategoryName?: string;
  defaultNotes?: string;
  confidence: number;
}

interface Transaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  subcategory?: string;
  date: string;
  notes?: string;
}

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: any) => void;
  editingTransaction?: Transaction | null;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editingTransaction 
}) => {
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    description: editingTransaction?.description || '',
    amount: editingTransaction?.amount?.toString() || '',
    categoryId: '',
    subcategoryId: '',
    date: editingTransaction?.date || new Date().toISOString().split('T')[0],
    notes: editingTransaction?.notes || ''
  });
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  // Update form when editing transaction changes
  useEffect(() => {
    if (editingTransaction) {
      setFormData({
        description: editingTransaction.description,
        amount: editingTransaction.amount.toString(),
        categoryId: '',
        subcategoryId: '',
        date: editingTransaction.date,
        notes: editingTransaction.notes || ''
      });
    } else {
      setFormData({
        description: '',
        amount: '',
        categoryId: '',
        subcategoryId: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
  }, [editingTransaction]);

  // Get category suggestions when description changes
  useEffect(() => {
    const getSuggestions = async () => {
      if (formData.description.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        const response = await fetch('/api/transactions/suggest-category', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ description: formData.description })
        });

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions);
          setShowSuggestions(data.suggestions.length > 0);
        }
      } catch (error) {
        console.error('Error getting suggestions:', error);
      }
    };

    const debounceTimer = setTimeout(getSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [formData.description]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear subcategory when category changes
    if (field === 'categoryId') {
      setFormData(prev => ({ ...prev, subcategoryId: '' }));
    }
  };

  const applySuggestion = (suggestion: CategorySuggestion) => {
    setFormData(prev => ({
      ...prev,
      categoryId: suggestion.categoryId.toString(),
      subcategoryId: suggestion.subcategoryId?.toString() || '',
      notes: suggestion.defaultNotes || prev.notes
    }));
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const transactionData = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        categoryId: parseInt(formData.categoryId),
        subcategoryId: formData.subcategoryId ? parseInt(formData.subcategoryId) : null,
        date: formData.date,
        notes: formData.notes || null
      };

      const url = editingTransaction 
        ? `/api/transactions/${editingTransaction.id}`
        : '/api/transactions';
      
      const method = editingTransaction ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData)
      });

      if (response.ok) {
        const newTransaction = await response.json();
        onSubmit(newTransaction);
        
        // Reset form
        setFormData({
          description: '',
          amount: '',
          categoryId: '',
          subcategoryId: '',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        
        onClose();
      } else {
        const error = await response.json();
        console.error('Error creating transaction:', error);
      }
    } catch (error) {
      console.error('Error submitting transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find(c => c.id.toString() === formData.categoryId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingTransaction ? 'Transaktion bearbeiten' : t('transactions.add')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Description */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              {t('transactions.description')}
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('transactions.descriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
            />
            
            {/* Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 mt-1">
                <div className="p-2 bg-gray-50 border-b flex items-center text-xs text-gray-600">
                  <Lightbulb className="w-3 h-3 mr-1" />
                  {t('categories.suggestions')}
                </div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => applySuggestion(suggestion)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b last:border-b-0 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm text-gray-900">
                        {suggestion.categoryName}
                        {suggestion.subcategoryName && (
                          <span className="text-blue-600 ml-1">
                            → {suggestion.subcategoryName}
                          </span>
                        )}
                      </div>
                      {suggestion.defaultNotes && (
                        <div className="text-xs text-gray-500">
                          "{suggestion.defaultNotes}"
                        </div>
                      )}
                    </div>
                    <div className="flex items-center text-xs text-gray-400">
                      {Array.from({ length: suggestion.confidence }).map((_, i) => (
                        <div key={i} className="w-1 h-1 bg-blue-400 rounded-full mr-1"></div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-2" />
              {t('transactions.amount')}
            </label>
            <input
              type="number"
              step="0.01"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0,00"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('transactions.amountHint')}
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="w-4 h-4 inline mr-2" />
              {t('transactions.category')}
            </label>
            <select
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.categoryId}
              onChange={(e) => handleInputChange('categoryId', e.target.value)}
            >
              <option value="">{t('transactions.selectCategory')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          {selectedCategory && selectedCategory.subcategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('transactions.subcategory')}
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.subcategoryId}
                onChange={(e) => handleInputChange('subcategoryId', e.target.value)}
              >
                <option value="">{t('transactions.selectSubcategory')}</option>
                {selectedCategory.subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              {t('transactions.date')}
            </label>
            <input
              type="date"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('transactions.notes')}
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder={t('transactions.notesPlaceholder')}
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {editingTransaction ? 'Speichern' : t('transactions.create')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
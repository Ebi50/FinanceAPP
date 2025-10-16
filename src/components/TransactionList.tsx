import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2,
  Calendar,
  Tag,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import TransactionForm from './TransactionForm';
import { formatEuro, formatDate } from '../utils/formatters';

interface Transaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  subcategory?: string;
  date: string;
  notes?: string;
}

const TransactionList: React.FC = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  
  const queryClient = useQueryClient();

  // Month navigation functions
  const goToPreviousMonth = () => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() - 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const goToNextMonth = () => {
    const date = new Date(selectedMonth + '-01');
    date.setMonth(date.getMonth() + 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const getMonthDisplayName = (monthString: string) => {
    const date = new Date(monthString + '-01');
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
  };

  // Fetch transactions from API
  const { data: transactionsData, isLoading, error, refetch } = useQuery(
    ['transactions', { search: searchTerm, category: selectedCategory, month: selectedMonth }],
    async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory && selectedCategory !== 'All') params.append('category', selectedCategory);
      if (selectedMonth) params.append('month', selectedMonth);
      
      const response = await fetch(`/api/transactions?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      return response.json();
    },
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Fetch categories for filter
  const { data: categories } = useQuery('categories', async () => {
    const response = await fetch('/api/categories');
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    return response.json();
  });

  const handleTransactionAdded = () => {
    refetch(); // Refresh transactions when new transaction is added
    setShowAddForm(false);
  };

  // Delete transaction mutation
  const deleteTransactionMutation = useMutation(
    async (transactionId: number) => {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('transactions');
        refetch();
      },
    }
  );

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowAddForm(true);
  };

  const handleDeleteTransaction = async (transactionId: number) => {
    if (window.confirm('Transaktion wirklich löschen?')) {
      try {
        await deleteTransactionMutation.mutateAsync(transactionId);
      } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Fehler beim Löschen der Transaktion');
      }
    }
  };

  const transactions = transactionsData?.transactions || [];
  const totalBalance = transactions.reduce((sum: number, transaction: any) => sum + transaction.amount, 0);
  const categoryOptions = ['All', ...(categories?.map((c: any) => c.name) || [])];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">Error loading transactions. Please check your connection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('transactions.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('transactions.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('transactions.add')}
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {t('transactions.totalBalance')}
            </h3>
            <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatEuro(totalBalance)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              {transactions.length} {t('transactions.count')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('transactions.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categoryOptions.map((category: string) => (
                <option key={category} value={category === 'All' ? '' : category}>
                  {category === 'All' ? t('categories.all') : category}
                </option>
              ))}
            </select>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Vorheriger Monat"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            
            <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-md min-w-[180px] justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {getMonthDisplayName(selectedMonth)}
              </span>
            </div>
            
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Nächster Monat"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {t('transactions.list')}
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {transactions.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-500">{t('transactions.noResults')}</p>
            </div>
          ) : (
            transactions.map((transaction: any) => (
              <div key={transaction.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {transaction.description}
                        </h4>
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(transaction.date)}
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Tag className="w-3 h-3 mr-1" />
                            {transaction.category}
                            {transaction.subcategory && ` • ${transaction.subcategory}`}
                          </div>
                        </div>
                        {transaction.notes && (
                          <p className="text-xs text-gray-400 mt-1">
                            {transaction.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`text-sm font-medium ${
                      transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.amount >= 0 ? '+' : ''}{formatEuro(transaction.amount)}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleEditTransaction(transaction)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Bearbeiten"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTransaction(transaction.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="Löschen"
                        disabled={deleteTransactionMutation.isLoading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          setEditingTransaction(null);
        }}
        onSubmit={handleTransactionAdded}
        editingTransaction={editingTransaction}
      />
    </div>
  );
};

export default TransactionList;
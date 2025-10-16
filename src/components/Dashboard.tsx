import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  CreditCard,
  PlusCircle
} from 'lucide-react';
import TransactionForm from './TransactionForm';
import { formatEuro, formatDate } from '../utils/formatters';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch dashboard data from API
  const { data: dashboardData, isLoading, error, refetch } = useQuery(
    'dashboard',
    async () => {
      const response = await fetch('/api/reports/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return response.json();
    },
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  const handleTransactionAdded = () => {
    refetch(); // Refresh dashboard data when new transaction is added
    setShowAddForm(false);
  };

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
        <p className="text-red-800">Error loading dashboard data. Please check your connection.</p>
      </div>
    );
  }

  const stats = dashboardData?.monthly || {
    income: 0,
    expenses: 0,
    netSavings: 0,
    transactionCount: 0
  };

  const budgetTarget = 3000; // This could be configurable later
  const budgetUsage = budgetTarget > 0 ? (stats.expenses / budgetTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('dashboard.title')}
        </h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          {t('transactions.add')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 bg-red-50 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-red-500" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {t('dashboard.monthlySpending')}
                  </dt>
                  <dd className="text-xl font-semibold text-gray-900">
                    {formatEuro(stats.expenses)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-500" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {t('dashboard.budget')}
                  </dt>
                  <dd className="text-xl font-semibold text-gray-900">
                    {formatEuro(budgetTarget)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <CreditCard className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {t('dashboard.transactions')}
                  </dt>
                  <dd className="text-xl font-semibold text-gray-900">
                    {stats.transactionCount}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-500" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {t('dashboard.categories')}
                  </dt>
                  <dd className="text-xl font-semibold text-gray-900">
                    {dashboardData?.categoryCount || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Progress */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-100">
        <div className="px-6 py-6">
          <h3 className="text-lg leading-6 font-semibold text-gray-900">
            {t('dashboard.budgetProgress')}
          </h3>
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
              <span>{t('dashboard.spent')}: {formatEuro(stats.expenses)}</span>
              <span>{t('dashboard.budget')}: {formatEuro(budgetTarget)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  budgetUsage > 90 
                    ? 'bg-gradient-to-r from-red-500 to-red-600' 
                    : budgetUsage > 75 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                    : 'bg-gradient-to-r from-emerald-500 to-green-600'
                }`}
                style={{ width: `${Math.min(budgetUsage, 100)}%` }}
              ></div>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              {budgetUsage.toFixed(1)}% {t('dashboard.used')}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-100">
        <div className="px-6 py-6">
          <h3 className="text-lg leading-6 font-semibold text-gray-900 mb-4">
            {t('dashboard.recentTransactions')}
          </h3>
          <div className="space-y-4">
            {dashboardData?.recentTransactions?.map((transaction: any) => (
              <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-b-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {transaction.category} • {formatDate(transaction.date)}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${transaction.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatEuro(Math.abs(transaction.amount))}
                </span>
              </div>
            )) || (
              <p className="text-gray-500 text-center py-6">No recent transactions</p>
            )}
          </div>
          <div className="mt-6">
            <button className="text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors">
              {t('dashboard.viewAll')} →
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSubmit={handleTransactionAdded}
      />
    </div>
  );
};

export default Dashboard;
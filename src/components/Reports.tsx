import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Download,
  Filter
} from 'lucide-react';

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedYear, setSelectedYear] = useState('2024');

  // Mock data - will be replaced with actual API calls later
  const monthlyData = [
    { month: 'Jan', income: 3500, expenses: 2850 },
    { month: 'Feb', income: 3500, expenses: 3100 },
    { month: 'Mar', income: 3500, expenses: 2650 },
    { month: 'Apr', income: 3500, expenses: 2950 },
    { month: 'May', income: 3500, expenses: 2800 },
    { month: 'Jun', income: 3500, expenses: 3200 },
  ];

  const categoryBreakdown = [
    { category: 'Food', amount: 1250, percentage: 35, color: '#10B981' },
    { category: 'Transportation', amount: 680, percentage: 19, color: '#3B82F6' },
    { category: 'Shopping', amount: 450, percentage: 13, color: '#8B5CF6' },
    { category: 'Utilities', amount: 320, percentage: 9, color: '#F59E0B' },
    { category: 'Entertainment', amount: 280, percentage: 8, color: '#EF4444' },
    { category: 'Other', amount: 570, percentage: 16, color: '#6B7280' },
  ];

  const totalExpenses = categoryBreakdown.reduce((sum, cat) => sum + cat.amount, 0);
  const currentMonthIncome = 3500;
  const currentMonthSavings = currentMonthIncome - totalExpenses;
  const savingsRate = (currentMonthSavings / currentMonthIncome) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('reports.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('reports.subtitle')}
          </p>
        </div>
        <div className="flex space-x-3">
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="month">{t('reports.thisMonth')}</option>
            <option value="quarter">{t('reports.thisQuarter')}</option>
            <option value="year">{t('reports.thisYear')}</option>
          </select>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <Download className="w-4 h-4 mr-2" />
            {t('reports.export')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {t('reports.totalIncome')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    €{currentMonthIncome.toFixed(2)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingDown className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {t('reports.totalExpenses')}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    €{totalExpenses.toFixed(2)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {t('reports.netSavings')}
                  </dt>
                  <dd className={`text-lg font-medium ${currentMonthSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{currentMonthSavings.toFixed(2)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PieChart className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {t('reports.savingsRate')}
                  </dt>
                  <dd className={`text-lg font-medium ${savingsRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {savingsRate.toFixed(1)}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {t('reports.monthlyTrend')}
            </h3>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-gray-600">{t('reports.income')}</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span className="text-gray-600">{t('reports.expenses')}</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {monthlyData.map((month, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="w-12 text-sm text-gray-600">{month.month}</div>
                <div className="flex-1 mx-4">
                  <div className="relative h-6 bg-gray-100 rounded">
                    <div 
                      className="absolute top-0 left-0 h-full bg-green-500 rounded"
                      style={{ width: `${(month.income / 4000) * 100}%` }}
                    ></div>
                    <div 
                      className="absolute top-0 left-0 h-full bg-red-500 rounded opacity-70"
                      style={{ width: `${(month.expenses / 4000) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-right text-sm space-y-1">
                  <div className="text-green-600">+€{month.income}</div>
                  <div className="text-red-600">-€{month.expenses}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {t('reports.categoryBreakdown')}
            </h3>
            <button className="text-sm text-blue-600 hover:text-blue-500">
              {t('reports.viewDetails')}
            </button>
          </div>
          <div className="space-y-4">
            {categoryBreakdown.map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: category.color }}
                  ></div>
                  <span className="text-sm font-medium text-gray-900">
                    {category.category}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{ 
                        width: `${category.percentage}%`,
                        backgroundColor: category.color 
                      }}
                    ></div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      €{category.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {category.percentage}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-gray-900">{t('reports.total')}</span>
              <span className="text-gray-900">€{totalExpenses.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('reports.exportOptions')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2" />
            {t('reports.exportCSV')}
          </button>
          <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2" />
            {t('reports.exportPDF')}
          </button>
          <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Calendar className="w-4 h-4 mr-2" />
            {t('reports.schedule')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reports;
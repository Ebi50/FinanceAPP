import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from './components/AuthContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import CategoryManager from './components/CategoryManager';
import Reports from './components/Reports';

const queryClient = new QueryClient();

function App() {
  const { i18n } = useTranslation();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<TransactionList />} />
                <Route path="/categories" element={<CategoryManager />} />
                <Route path="/reports" element={<Reports />} />
              </Routes>
            </Layout>
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  FolderOpen, 
  Tag,
  Lightbulb,
  Settings,
  X,
  Check
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
  color: string;
  created_at: string;
  subcategories: Array<{
    id: number;
    name: string;
  }>;
}

interface CategoryExample {
  id: number;
  categoryId: number;
  description: string;
  subcategory?: string;
  defaultNotes?: string;
  keywords: string[];
}

const CategoryManager: React.FC = () => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const queryClient = useQueryClient();

  // Fetch categories from API
  const { data: categories, isLoading, error } = useQuery('categories', async () => {
    const response = await fetch('/api/categories');
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    return response.json();
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation(
    async (categoryId: number) => {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete category');
      }
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('categories');
        if (selectedCategory === editingCategory) {
          setSelectedCategory(null);
        }
      },
      onError: (error: Error) => {
        alert(`Error: ${error.message}`);
      },
    }
  );

  // Update category mutation
  const updateCategoryMutation = useMutation(
    async ({ categoryId, name }: { categoryId: number; name: string }) => {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, color: '#6B7280' }), // Keep existing color for now
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update category');
      }
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('categories');
        setEditingCategory(null);
        setEditingName('');
      },
      onError: (error: Error) => {
        alert(`Error: ${error.message}`);
      },
    }
  );

  const handleEditCategory = (category: any) => {
    setEditingCategory(category.id);
    setEditingName(category.name);
  };

  const handleSaveEdit = () => {
    if (editingCategory && editingName.trim()) {
      updateCategoryMutation.mutate({
        categoryId: editingCategory,
        name: editingName.trim(),
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditingName('');
  };

  const handleDeleteCategory = (categoryId: number) => {
    if (confirm(t('categories.confirmDelete'))) {
      deleteCategoryMutation.mutate(categoryId);
    }
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
        <p className="text-red-800">Error loading categories. Please check your connection.</p>
      </div>
    );
  }

  const categoriesData = categories || [];
  const selectedCategoryData = selectedCategory ? categoriesData.find((c: any) => c.id === selectedCategory) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('categories.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('categories.subtitle')}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            {t('categories.examples')}
          </button>
          <button
            onClick={() => console.log('Add category feature coming soon')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('categories.add')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories List */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {t('categories.list')}
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {categoriesData.map((category: any) => (
                <div 
                  key={category.id} 
                  className={`px-6 py-4 hover:bg-gray-50 cursor-pointer ${
                    selectedCategory === category.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      ></div>
                      <div>
                        {editingCategory === category.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="text-sm font-medium border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              autoFocus
                            />
                            <button 
                              onClick={handleSaveEdit}
                              className="text-green-600 hover:text-green-700"
                              disabled={updateCategoryMutation.isLoading}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={handleCancelEdit}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h4 className="text-sm font-medium text-gray-900">
                              {category.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {category.subcategories?.length || 0} {t('categories.subcategories')}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {editingCategory !== category.id && (
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCategory(category);
                          }}
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(category.id);
                          }}
                          className="text-gray-400 hover:text-red-600"
                          disabled={deleteCategoryMutation.isLoading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedCategory === category.id && (
                    <div className="mt-3 pl-7">
                      <div className="flex flex-wrap gap-2">
                        {category.subcategories?.map((sub: any, index: number) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            <Tag className="w-3 h-3 mr-1" />
                            {sub.name}
                          </span>
                        )) || null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Details */}
        <div className="space-y-6">
          {selectedCategoryData ? (
            <>
              {/* Category Info */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: selectedCategoryData.color }}
                  ></div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedCategoryData.name}
                  </h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {t('categories.subcategories')}
                    </label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {selectedCategoryData.subcategories?.map((sub: any, index: number) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {sub.name}
                        </span>
                      )) || (
                        <span className="text-sm text-gray-500">No subcategories</span>
                      )}
                    </div>
                  </div>
                  <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                    <Settings className="w-4 h-4 mr-2" />
                    {t('categories.manage')}
                  </button>
                </div>
              </div>

              {/* Examples */}
              {showExamples && (
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-900">
                      {t('categories.examples')} (0)
                    </h4>
                    <button className="text-xs text-blue-600 hover:text-blue-500">
                      {t('categories.addExample')}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 text-center py-4">
                      {t('categories.noExamples')}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                {t('categories.selectCategory')}
              </h3>
              <p className="text-sm text-gray-500">
                {t('categories.selectCategoryDesc')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
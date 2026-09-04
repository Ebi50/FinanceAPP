import type { AppUser, Category, Transaction, TransactionItem } from '@/lib/types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError(0, 'Keine Verbindung zum Server.');
  }

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? 'Unerwarteter Serverfehler.');
  }
  return payload as T;
}

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export type TransactionPayload = {
  description: string;
  amount: number;
  date: string;
  category_id?: string | null;
  is_recurring?: boolean;
  recurring_end_date?: string | null;
  items?: TransactionItem[];
};

export const api = {
  // ---- auth
  me: () => request<{ user: AppUser | null }>('/api/auth/me'),
  login: (email: string, password: string) =>
    send<{ user: AppUser }>('/api/auth/login', 'POST', { email, password }),
  logout: () => send<{ ok: true }>('/api/auth/logout', 'POST'),
  changePassword: (currentPassword: string, newPassword: string) =>
    send<{ ok: true }>('/api/auth/password', 'POST', { currentPassword, newPassword }),

  // ---- transactions
  transactions: (year: number) =>
    request<{ data: Transaction[] }>(`/api/transactions?year=${year}`).then((r) => r.data),
  transactionYears: () =>
    request<{ data: number[] }>('/api/transactions/years').then((r) => r.data),
  createTransaction: (payload: TransactionPayload) =>
    send<{ transaction: Transaction }>('/api/transactions', 'POST', payload).then((r) => r.transaction),
  updateTransaction: (id: string, payload: Partial<TransactionPayload>) =>
    send<{ transaction: Transaction }>(`/api/transactions/${id}`, 'PATCH', payload).then((r) => r.transaction),
  splitTransaction: (id: string, payload: TransactionPayload & { effective_from: string }) =>
    send<{ transaction: Transaction }>(`/api/transactions/${id}/split`, 'POST', payload).then((r) => r.transaction),
  deleteTransaction: (id: string, mode: 'all' | 'from_here' = 'all', date?: string) => {
    const params = new URLSearchParams({ mode });
    if (date) params.set('date', date);
    return send<{ ok: true }>(`/api/transactions/${id}?${params}`, 'DELETE');
  },
  importTransactions: (transactions: TransactionPayload[]) =>
    send<{ inserted: number }>('/api/transactions/import', 'POST', { transactions }),

  // ---- categories
  categories: () => request<{ data: Category[] }>('/api/categories').then((r) => r.data),
  createCategory: (name: string) =>
    send<{ category: Category }>('/api/categories', 'POST', { name }).then((r) => r.category),
  updateCategory: (id: string, name: string) =>
    send<{ category: Category }>(`/api/categories/${id}`, 'PATCH', { name }).then((r) => r.category),
  deleteCategory: (id: string) => send<{ ok: true }>(`/api/categories/${id}`, 'DELETE'),

  // ---- profile
  updateProfile: (payload: {
    first_name?: string;
    last_name?: string;
    budget?: number;
    auto_logout_timeout?: number;
  }) => send<{ user: AppUser }>('/api/profile', 'PATCH', payload).then((r) => r.user),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ user: AppUser }>('/api/profile/avatar', { method: 'POST', body: form }).then(
      (r) => r.user
    );
  },

  // ---- danger zone
  deletePeriod: (year: number, month: number | 'all') =>
    send<{ deleted: number }>(`/api/data?year=${year}&month=${month}`, 'DELETE'),
  deleteAccount: () => send<{ ok: true }>('/api/account', 'DELETE'),
};

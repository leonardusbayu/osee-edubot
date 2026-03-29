import { useAuthStore } from '../stores/auth';

const API_BASE = '/api';

function getTelegramUserId(): string | null {
  try {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user as any;
    return user?.id ? String(user.id) : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Fallback: send Telegram user ID for identification
  const tgUserId = getTelegramUserId();
  if (tgUserId) {
    headers['X-Telegram-User-Id'] = tgUserId;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!response.ok) {
    throw new Error(`${response.status} ${path}`);
  }

  return await response.json();
}

export const api = {
  login: async (initData: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: initData }),
    });
    if (!response.ok) return null;
    return await response.json();
  },

  getAvailableTests: () => request<any[]>('/tests/available'),

  startTest: (testType: string) =>
    request<any>('/tests/start', {
      method: 'POST',
      body: JSON.stringify({ test_type: testType }),
    }),

  getAttempt: (attemptId: number) => request<any>(`/tests/attempt/${attemptId}`),

  submitAnswer: (attemptId: number, data: any) =>
    request<any>(`/tests/attempt/${attemptId}/answer`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  advanceSection: (attemptId: number, nextSection: string) =>
    request<any>(`/tests/attempt/${attemptId}/section/${nextSection}`, { method: 'POST' }),

  finishAttempt: (attemptId: number) =>
    request<any>(`/tests/attempt/${attemptId}/finish`, { method: 'POST' }),

  getResults: (attemptId: number) => request<any>(`/tests/results/${attemptId}`),

  getProgress: () => request<any>('/progress/overview'),
  getSkills: () => request<any>('/progress/skills'),

  getQuestions: (section: string, questionType?: string, limit?: number) => {
    let url = `/tests/questions/${section}?limit=${limit || 20}`;
    if (questionType) url += `&question_type=${questionType}`;
    return request<any>(url);
  },

  uploadRecording: async (file: Blob) => {
    const { accessToken } = useAuthStore.getState();
    const formData = new FormData();
    formData.append('file', file, 'recording.webm');
    const response = await fetch(`${API_BASE}/media/recording`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: formData,
    });
    if (!response.ok) return null;
    return response.json();
  },
};

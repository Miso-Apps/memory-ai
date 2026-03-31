const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://localhost:8000';

const ACCESS_TOKEN_KEY = 'memory_ai_web_access_token';
const REFRESH_TOKEN_KEY = 'memory_ai_web_refresh_token';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface ApiMemory {
  id: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  content: string;
  transcription?: string | null;
  audio_url?: string | null;
  audio_duration?: number | null;
  ai_summary?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  withAuth?: boolean;
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function readAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function readRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function writeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = readRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(buildUrl('/auth/refresh', { refresh_token: refreshToken }), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const accessToken = payload?.access_token as string | undefined;
  if (!accessToken) {
    return null;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  return accessToken;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, withAuth = true } = options;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (withAuth) {
    const token = readAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const doFetch = async () =>
    fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await doFetch();

  if (response.status === 401 && withAuth) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      headers.Authorization = `Bearer ${newAccessToken}`;
      response = await doFetch();
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string') {
        message = payload.detail;
      }
    } catch {
      // Ignore non-JSON errors.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function mapAuthSession(payload: any): AuthSession {
  return {
    user: payload.user,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
  };
}

export const authApi = {
  getStoredSession(): AuthSession | null {
    const accessToken = readAccessToken();
    const refreshToken = readRefreshToken();
    const rawUser = localStorage.getItem('memory_ai_web_user');
    if (!accessToken || !refreshToken || !rawUser) {
      return null;
    }

    try {
      const user = JSON.parse(rawUser) as AuthUser;
      return { user, accessToken, refreshToken };
    } catch {
      return null;
    }
  },

  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('memory_ai_web_user');
  },

  async login(email: string, password: string): Promise<AuthSession> {
    const payload = await request<any>('/auth/login', {
      method: 'POST',
      body: { email, password },
      withAuth: false,
    });
    const session = mapAuthSession(payload);
    writeTokens(session.accessToken, session.refreshToken);
    localStorage.setItem('memory_ai_web_user', JSON.stringify(session.user));
    return session;
  },

  async register(name: string, email: string, password: string): Promise<AuthSession> {
    const payload = await request<any>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
      withAuth: false,
    });
    const session = mapAuthSession(payload);
    writeTokens(session.accessToken, session.refreshToken);
    localStorage.setItem('memory_ai_web_user', JSON.stringify(session.user));
    return session;
  },
};

export const memoriesApi = {
  async list(params?: { type?: 'text' | 'link' | 'voice' | 'photo'; search?: string; limit?: number; offset?: number }) {
    return request<{ memories: ApiMemory[]; total: number }>('/memories/', {
      query: {
        type: params?.type,
        search: params?.search,
        limit: params?.limit ?? 100,
        offset: params?.offset ?? 0,
      },
    });
  },

  async create(payload: {
    type: 'text' | 'link' | 'voice' | 'photo';
    content: string;
    transcription?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ApiMemory> {
    return request<ApiMemory>('/memories/', {
      method: 'POST',
      body: payload,
    });
  },

  async getReminders() {
    return request<{ unreviewed: ApiMemory[]; revisit: ApiMemory[]; on_this_day: ApiMemory[] }>('/memories/reminders');
  },
};

export const aiApi = {
  async semanticSearch(query: string, limit = 8, withSummary = true) {
    return request<{ query: string; results: ApiMemory[]; total: number; ai_summary?: string | null }>('/ai/search', {
      query: {
        q: query,
        limit,
        with_summary: withSummary,
      },
    });
  },
};

export function formatMemoryDate(value?: string | null): string {
  if (!value) {
    return 'Khong ro';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function mapApiMemoryType(type: string): 'text' | 'link' | 'voice' {
  if (type === 'link' || type === 'voice' || type === 'text') {
    return type;
  }
  return 'text';
}

export { ApiError };

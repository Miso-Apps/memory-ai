// @ts-ignore — use browser build to avoid Node 'crypto' import in React Native
import axios from 'axios/dist/browser/axios.cjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';

// Needed to properly close the auth session on iOS after redirect
WebBrowser.maybeCompleteAuthSession();

// Configure API base URL based on environment
const API_BASE_URL = __DEV__
  ? 'http://localhost:8000'  // Local development
  : 'https://api.dukiai.com';  // Production

let cachedAccessToken: string | null = null;
let accessTokenHydrated = false;
let cachedLanguage: string | null = null;
let languageHydrated = false;

export function setApiAccessToken(token: string | null) {
  cachedAccessToken = token;
  accessTokenHydrated = true;
}

export function setApiLanguage(language: string | null) {
  cachedLanguage = language;
  languageHydrated = true;
}

async function getAccessTokenCached() {
  if (!accessTokenHydrated) {
    cachedAccessToken = await AsyncStorage.getItem('accessToken');
    accessTokenHydrated = true;
  }
  return cachedAccessToken;
}

async function getLanguageCached() {
  if (!languageHydrated) {
    cachedLanguage = await AsyncStorage.getItem('app_language');
    languageHydrated = true;
  }
  return cachedLanguage;
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token and language header
api.interceptors.request.use(
  async (config: any) => {
    const token = await getAccessTokenCached();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Always send the user's current language so the backend can
    // generate AI content in the correct language, even if the
    // preference DB update hasn't been saved yet.
    const lang = await getLanguageCached();
    if (lang) {
      config.headers['Accept-Language'] = lang;
    }
    return config;
  },
  (error: any) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response: any) => response,
  async (error: any) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // 401 = invalid/expired token, 403 = missing/malformed credentials
    if ((status === 401 || status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;

      // No refresh token means there was never a valid session — reject
      // silently without touching auth state (avoids spurious logout on startup).
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (!refreshToken) return Promise.reject(error);

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token } = response.data;
        await AsyncStorage.setItem('accessToken', access_token);
        setApiAccessToken(access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token existed but is invalid/expired — force logout.
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        setApiAccessToken(null);
        const { useAuthStore } = require('../store/authStore');
        useAuthStore.getState().logout().catch(() => { });
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Types
export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  theme_mode: 'light' | 'dark' | 'auto';
  accent_color: string;
  default_capture_type: 'text' | 'voice' | 'photo' | 'link';
  auto_summarize: boolean;
  auto_categorize: boolean;
  ai_recall_enabled: boolean;
  ai_suggestions_enabled: boolean;
  recall_sensitivity: 'low' | 'medium' | 'high';
  proactive_recall_opt_in: boolean;
  streaming_responses: boolean;
  save_location: boolean;
  analytics_enabled: boolean;
  daily_digest: boolean;
  reminder_notifications: boolean;
  weekly_recap: boolean;
  home_sections: {
    unreviewed: boolean;
    revisit: boolean;
    on_this_day: boolean;
    recent: boolean;
  };
  pinned_categories: string[];
  hidden_categories: string[];
  language: string;
  created_at: string;
  updated_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  content: string;
  transcription?: string;
  audio_url?: string;
  audio_duration?: number;
  image_url?: string;
  ai_summary?: string;
  metadata?: Record<string, any>;
  category_id?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  category_confidence?: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryLink {
  id: string;
  source_memory_id: string;
  target_memory_id: string;
  link_type: string;
  score?: number;
  explanation?: string;
  created_at: string;
}

export interface Decision {
  id: string;
  user_id: string;
  memory_id?: string | null;
  title: string;
  rationale?: string | null;
  expected_outcome?: string | null;
  revisit_at?: string | null;
  status: 'open' | 'reviewed' | 'archived';
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PaginatedMemoriesResponse {
  memories: Memory[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
}

function normalizePaginatedMemories(
  payload: Memory[] | PaginatedMemoriesResponse,
  params?: { limit?: number; offset?: number }
): PaginatedMemoriesResponse {
  if (!Array.isArray(payload)) {
    return payload;
  }

  const limit = params?.limit ?? payload.length;
  const offset = params?.offset ?? 0;
  const nextOffset = offset + payload.length;
  const hasMore = params?.limit ? payload.length === params.limit : false;

  return {
    memories: payload,
    total: nextOffset,
    limit,
    offset,
    has_more: hasMore,
    next_offset: hasMore ? nextOffset : null,
  };
}

export interface RadarItem {
  memory: Memory;
  reason: string;
  reason_code: string;
  confidence: number;
  action_hint: string;
}

export interface RadarResponse {
  items: RadarItem[];
  generated_at: string;
}

export interface CreateMemoryDto {
  type: 'text' | 'link' | 'voice' | 'photo';
  content: string;
  metadata?: Record<string, any>;
  // Voice-specific (optional)
  transcription?: string;
  audio_url?: string;
  audio_duration?: number;
  // Photo-specific (optional)
  image_url?: string;
}

// API Methods
export const memoriesApi = {
  // Create a new memory
  create: async (data: CreateMemoryDto) => {
    const response = await api.post<Memory>('/memories/', data);
    return response.data;
  },

  // List memories with optional category filter
  list: async (params?: { type?: string; category_id?: string; search?: string; limit?: number; offset?: number }) => {
    const response = await api.get<Memory[] | PaginatedMemoriesResponse>('/memories/', { params });
    return normalizePaginatedMemories(response.data, params);
  },

  // Get single memory by ID
  get: async (id: string) => {
    const response = await api.get<Memory>(`/memories/${id}`);
    return response.data;
  },

  // Update memory
  update: async (id: string, data: Partial<CreateMemoryDto>) => {
    const response = await api.put<Memory>(`/memories/${id}`, data);
    return response.data;
  },

  // Delete memory (soft-delete → dismissed)
  delete: async (id: string) => {
    await api.delete(`/memories/${id}`);
  },

  // Aggregate stats for the current user
  stats: async () => {
    const response = await api.get<{
      total: number;
      by_type: Record<string, number>;
      this_week: number;
      today: number;
    }>('/memories/stats');
    return response.data;
  },

  // Mark memory as viewed
  markViewed: async (id: string) => {
    const response = await api.post<Memory>(`/memories/${id}/view`);
    return response.data;
  },

  // Pin memory to recall queue
  pinForRecall: async (id: string) => {
    const response = await api.post<{
      status: string;
      memory_id: string;
      event_id: string;
      reason_code: string;
    }>(`/memories/${id}/pin`);
    return response.data;
  },

  // List dismissed (soft-deleted) memories
  listDismissed: async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get<Memory[] | PaginatedMemoriesResponse>('/memories/dismissed', { params });
    return normalizePaginatedMemories(response.data, params);
  },

  // Restore a dismissed memory
  restore: async (id: string) => {
    const response = await api.post<Memory>(`/memories/${id}/restore`);
    return response.data;
  },

  // Permanently delete a memory
  permanentDelete: async (id: string) => {
    await api.delete(`/memories/${id}/permanent`);
  },

  // List explicit links from a source memory
  listLinks: async (id: string) => {
    const response = await api.get<MemoryLink[]>(`/memories/${id}/links`);
    return response.data;
  },

  // Create explicit memory link
  createLink: async (
    id: string,
    payload: { target_memory_id: string; link_type?: string; score?: number; explanation?: string }
  ) => {
    const response = await api.post<MemoryLink>(`/memories/${id}/links`, payload);
    return response.data;
  },

  // Delete explicit memory link
  deleteLink: async (id: string, targetMemoryId: string, linkType: string = 'explicit') => {
    const response = await api.delete<{ status: string; message?: string }>(
      `/memories/${id}/links/${targetMemoryId}`,
      { params: { link_type: linkType } }
    );
    return response.data;
  },

  // Get smart reminders for home screen
  reminders: async () => {
    const response = await api.get<{
      unreviewed: Memory[];
      revisit: Memory[];
      on_this_day: Memory[];
    }>('/memories/reminders');
    return response.data;
  },

  // Search memories (uses AI semantic search endpoint)
  search: async (query: string, options?: { category_id?: string; with_summary?: boolean }) => {
    const response = await api.get<{
      results: Memory[];
      query: string;
      total: number;
      ai_summary?: string;
    }>(
      '/ai/search',
      {
        params: {
          q: query,
          ...(options?.category_id ? { category_id: options.category_id } : {}),
          with_summary: options?.with_summary ?? false,
        },
      }
    );
    return response.data;
  },

  // Stream search results + AI summary via SSE
  searchStream: async (
    query: string,
    options: { category_id?: string; limit?: number } | undefined,
    onResults: (results: Memory[], total: number) => void,
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (err: string) => void,
  ): Promise<void> => {
    const token = await getAccessTokenCached();
    const lang = await getLanguageCached();

    const params = new URLSearchParams({ q: query, stream: 'true' });
    if (options?.category_id) params.set('category_id', options.category_id);
    if (options?.limit) params.set('limit', String(options.limit));

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `${API_BASE_URL}/ai/search?${params.toString()}`, true);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (lang) xhr.setRequestHeader('Accept-Language', lang);
      xhr.timeout = 60000;

      let cursor = 0;
      let buf = '';

      const processText = (text: string) => {
        buf += text;
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw) as
              | { type: 'results'; results: Memory[]; total: number }
              | { type: 'token'; content: string }
              | { type: 'done' }
              | { type: 'error'; message: string };
            if (evt.type === 'results') onResults(evt.results, evt.total);
            else if (evt.type === 'token') onToken(evt.content);
            else if (evt.type === 'done') onDone();
            else if (evt.type === 'error') onError(evt.message);
          } catch { /* ignore malformed lines */ }
        }
      };

      xhr.onprogress = () => {
        const newText = xhr.responseText.slice(cursor);
        if (newText.length > 0) {
          cursor = xhr.responseText.length;
          processText(newText);
        }
      };

      xhr.onload = () => {
        const remaining = xhr.responseText.slice(cursor);
        if (remaining.length > 0) processText(remaining);
        resolve();
      };

      xhr.onerror = () => { onError(`Network error (status ${xhr.status})`); resolve(); };
      xhr.ontimeout = () => { onError('Request timed out'); resolve(); };
      xhr.send();
    });
  },
};

// Categories API
export const categoriesApi = {
  // List all categories
  list: async (includeSystem: boolean = true) => {
    const response = await api.get<Category[]>('/categories/', {
      params: { include_system: includeSystem },
    });
    return response.data;
  },

  // Get a single category
  get: async (id: string) => {
    const response = await api.get<Category>(`/categories/${id}`);
    return response.data;
  },

  // Create a custom category
  create: async (data: { name: string; icon?: string; color?: string; description?: string }) => {
    const response = await api.post<Category>('/categories/', data);
    return response.data;
  },

  // Update a category
  update: async (id: string, data: Partial<{ name: string; icon: string; color: string; description: string; is_active: boolean; sort_order: number }>) => {
    const response = await api.put<Category>(`/categories/${id}`, data);
    return response.data;
  },

  // Delete (hide) a category
  delete: async (id: string) => {
    await api.delete(`/categories/${id}`);
  },

  // Get memory counts per category
  getCounts: async () => {
    const response = await api.get<{
      categories: Array<{ id: string; name: string; icon: string; color: string; count: number }>;
    }>('/categories/stats/counts');
    return response.data;
  },
};

// User Preferences API
export const preferencesApi = {
  // Get current user preferences
  get: async () => {
    const response = await api.get<UserPreferences>('/preferences/');
    return response.data;
  },

  // Update preferences
  update: async (data: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    const response = await api.put<UserPreferences>('/preferences/', data);
    return response.data;
  },

  // Reset to defaults
  reset: async () => {
    const response = await api.post<UserPreferences>('/preferences/reset');
    return response.data;
  },
};

export const aiApi = {
  // Get AI-powered recall suggestions
  getRecall: async () => {
    const response = await api.get<{ items: Array<{ memory: Memory; reason: string }> }>(
      '/ai/recall'
    );
    return response.data;
  },

  // Get proactive Memory Radar cards
  getRadar: async (limit: number = 6) => {
    const response = await api.get<RadarResponse>('/ai/radar', { params: { limit } });
    return response.data;
  },

  // Track user interactions with Radar cards
  trackRadarEvent: async (payload: {
    memory_id: string;
    event_type: 'served' | 'opened' | 'dismissed' | 'acted';
    reason_code?: string;
    confidence?: number;
    context?: Record<string, any>;
  }) => {
    const response = await api.post<{ status: string; event_id: string }>('/ai/radar/events', payload);
    return response.data;
  },

  // Generate summary for a memory
  summarize: async (memoryId: string) => {
    const response = await api.post<{ summary: string }>(
      `/ai/summarize/${memoryId}`
    );
    return response.data;
  },

  // Group memories by AI-detected categories
  groupMemories: async (memoryIds: string[]) => {
    const response = await api.post<{
      groups: Array<{ title: string; memory_ids: string[] }>;
    }>('/ai/group', { memory_ids: memoryIds });
    return response.data;
  },

  // AI reflection on user's thought
  reflect: async (thought: string, memoryId?: string) => {
    const response = await api.post<{
      insight: string;
      related_memories: Memory[];
      cached: boolean;
    }>('/ai/reflect', {
      thought,
      memory_id: memoryId,
    });
    return response.data;
  },
};

// Insights API
export interface InsightsDashboard {
  period_days: number;
  total_memories: number;
  active_days: number;
  avg_per_day: number;
  current_streak: number;
  longest_streak: number;
  peak_hour: number;
  growth_percentage: number;
  activity_heatmap: Array<{ date: string; count: number }>;
  category_breakdown: Array<{
    category_id?: string;
    name?: string;
    icon?: string;
    color?: string;
    count: number;
    percentage: number;
  }>;
  type_breakdown: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  weekly_trend: Array<{ week: string; count: number }>;
  hourly_distribution: Array<{ hour: number; count: number }>;
  top_days: Array<{ date: string; count: number }>;
}

export interface WeeklyRecap {
  period: { start: string; end: string };
  total_memories: number;
  by_type?: Record<string, number>;
  categories_used?: Array<{ name: string; icon: string }>;
  recap: string | null;
  highlights: Array<{
    id: string;
    type: string;
    content: string;
    created_at: string;
  }>;
}

export interface RelatedMemory {
  id: string;
  type: string;
  content: string;
  similarity: number | null;
  link_type?: string;
  explanation?: string;
  created_at: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export interface StreakDetails {
  current_streak: number;
  longest_streak: number;
  total_active_days: number;
  total_days_since_start: number;
  consistency_rate: number;
  first_memory_date: string | null;
  monthly_activity: Array<{ month: string; active_days: number }>;
}

export interface RecallRate {
  days: number;
  served: number;
  opened: number;
  recall_rate: number;
}

export const insightsApi = {
  // Get insights dashboard
  getDashboard: async (days: number = 30) => {
    const response = await api.get<InsightsDashboard>('/insights/dashboard', {
      params: { days },
    });
    return response.data;
  },

  // Get weekly recap
  getWeeklyRecap: async () => {
    const response = await api.get<WeeklyRecap>('/insights/weekly-recap');
    return response.data;
  },

  // Get related memories for a specific memory
  getRelated: async (memoryId: string, limit: number = 5) => {
    const response = await api.get<{ memory_id: string; related: RelatedMemory[]; total: number }>(
      `/insights/related/${memoryId}`,
      { params: { limit } },
    );
    return response.data;
  },

  // Track related-memory click/exposure events
  trackRelatedEvent: async (payload: {
    memory_id: string;
    event_type?: 'related_click';
    reason_code?: string;
    confidence?: number;
    context?: Record<string, any>;
  }) => {
    const response = await api.post<{ status: string; event_id: string }>(
      '/insights/related/events',
      {
        event_type: payload.event_type ?? 'related_click',
        ...payload,
      }
    );
    return response.data;
  },

  // Get detailed streak info
  getStreaks: async () => {
    const response = await api.get<StreakDetails>('/insights/streaks');
    return response.data;
  },

  // Get recall rate from radar events
  getRecallRate: async (days: number = 30) => {
    const response = await api.get<RecallRate>('/insights/recall-rate', {
      params: { days },
    });
    return response.data;
  },
};

export const decisionsApi = {
  create: async (payload: {
    title: string;
    rationale?: string;
    expected_outcome?: string;
    revisit_at?: string;
    memory_id?: string;
  }) => {
    const response = await api.post<Decision>('/decisions/', payload);
    return response.data;
  },

  list: async (params?: {
    status?: 'open' | 'reviewed' | 'archived';
    due_before?: string;
    limit?: number;
    offset?: number;
  }) => {
    const response = await api.get<{ items: Decision[]; total: number }>('/decisions/', {
      params,
    });
    return response.data;
  },

  update: async (
    id: string,
    payload: Partial<{
      title: string;
      rationale: string;
      expected_outcome: string;
      revisit_at: string;
      status: 'open' | 'reviewed' | 'archived';
    }>
  ) => {
    const response = await api.patch<Decision>(`/decisions/${id}`, payload);
    return response.data;
  },

  review: async (id: string, status: 'reviewed' | 'archived' = 'reviewed') => {
    const response = await api.post<Decision>(`/decisions/${id}/review`, { status });
    return response.data;
  },
};

// ─── AI Chat Types ────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSource {
  id: string;
  type: string;
  content: string;
  created_at: string;
  similarity: number | null;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  total_memories: number;
}

export interface ChatSuggestions {
  suggestions: string[];
}

export const chatApi = {
  // Send a message and get AI response with memory context (RAG)
  send: async (message: string, history?: ChatMessage[]) => {
    const response = await api.post<ChatResponse>('/ai/chat', {
      message,
      history: history ?? [],
      stream: false,
    });
    return response.data;
  },

  // Stream a chat response token-by-token via SSE
  stream: async (
    message: string,
    history: ChatMessage[] | undefined,
    onSources: (sources: ChatSource[]) => void,
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (err: string) => void,
  ): Promise<void> => {
    const token = await AsyncStorage.getItem('accessToken');

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/ai/chat`, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 60000;

      let cursor = 0;
      let buf = '';

      const processText = (text: string) => {
        buf += text;
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw) as
              | { type: 'sources'; sources: ChatSource[] }
              | { type: 'token'; content: string }
              | { type: 'done' }
              | { type: 'error'; message: string };
            if (evt.type === 'sources') onSources(evt.sources);
            else if (evt.type === 'token') onToken(evt.content);
            else if (evt.type === 'done') onDone();
            else if (evt.type === 'error') onError(evt.message);
          } catch { /* ignore malformed lines */ }
        }
      };

      xhr.onprogress = () => {
        const newText = xhr.responseText.slice(cursor);
        if (newText.length > 0) {
          cursor = xhr.responseText.length;
          processText(newText);
        }
      };

      xhr.onload = () => {
        // Flush any remaining bytes not caught by onprogress
        const remaining = xhr.responseText.slice(cursor);
        if (remaining.length > 0) processText(remaining);
        resolve();
      };

      xhr.onerror = () => {
        onError(`Network error (status ${xhr.status})`);
        resolve();
      };

      xhr.ontimeout = () => {
        onError('Request timed out');
        resolve();
      };

      xhr.send(JSON.stringify({ message, history: history ?? [], stream: true }));
    });
  },

  // Get smart conversation starters based on user's memory patterns
  getSuggestions: async () => {
    const response = await api.post<ChatSuggestions>('/ai/chat/suggestions');
    return response.data;
  },
};

export const storageApi = {
  // Upload audio file
  uploadAudio: async (fileUri: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);

    const response = await api.post<{
      audio_url: string | null;
      transcription: string | null;
      filename: string;
      size_bytes: number;
    }>('/storage/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  // Upload image file
  uploadImage: async (fileUri: string) => {
    const formData = new FormData();
    // Derive filename and MIME type from the URI so HEIC, PNG, WebP are handled correctly
    const uriParts = fileUri.split('.');
    const ext = (uriParts[uriParts.length - 1] ?? 'jpg').toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
    };
    const mimeType = mimeMap[ext] ?? 'image/jpeg';
    const filename = `photo.${ext}`;

    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: filename,
    } as any);

    const response = await api.post<{
      image_url: string | null;
      thumbnail_url: string | null;
      description: string | null;  // AI-generated text description of the image
      filename: string;
      size_bytes: number;
      original_size_bytes: number;
    }>('/storage/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },
};

export const authApi = {
  // Register new user
  register: async (email: string, password: string, name?: string) => {
    const response = await api.post<{
      user: { id: string; email: string; name?: string };
      access_token: string;
      refresh_token: string;
    }>('/auth/register', { email, password, name });
    return response.data;
  },

  // Login
  login: async (email: string, password: string) => {
    const response = await api.post<{
      user: { id: string; email: string; name?: string };
      access_token: string;
      refresh_token: string;
    }>('/auth/login', { email, password });
    return response.data;
  },

  // Login with Google
  //
  // Flow:
  //   1. PKCE authorization code request → Google consent screen
  //   2. Exchange code directly with Google (no client_secret needed for native credentials)
  //   3. Extract id_token from response
  //   4. POST id_token to our backend /auth/google/login for verification + JWT issuance
  //
  // Required setup in Google Cloud Console:
  //   • Create an OAuth 2.0 credential of type "iOS" (for Expo builds) or
  //     "Android" — these allow code exchange without a client_secret.
  //   • For Expo Go dev testing, also add an "Authorized redirect URI" matching
  //     the URI logged to Metro console: exp://<host>:<port>/--/auth/callback
  loginWithGoogle: async () => {
    // Required on iOS so the in-app browser closes after the OAuth redirect.
    WebBrowser.maybeCompleteAuthSession();

    const googleClientId = Constants.expoConfig?.extra?.googleClientId as string | undefined;
    if (!googleClientId) {
      throw new Error('Google Client ID not configured (check app.json extra.googleClientId)');
    }

    // For a Google iOS credential the redirect URI MUST use the reversed client ID
    // as the URL scheme (e.g. com.googleusercontent.apps.<id>:/).  Using any other
    // scheme (e.g. memoryai://) causes a 404 on accounts.google.com.
    const googleReversedClientId = Constants.expoConfig?.extra?.googleReversedClientId as string | undefined
      ?? `com.googleusercontent.apps.${googleClientId.replace('.apps.googleusercontent.com', '')}`;

    const redirectUri = AuthSession.makeRedirectUri({
      scheme: googleReversedClientId,
    });
    console.log('[Google OAuth] redirect URI:', redirectUri);

    // Use hardcoded Google OIDC endpoints — avoids a runtime network fetch which
    // can fail / time out and produce a malformed authorization URL (404 on Google).
    const discovery: AuthSession.DiscoveryDocument = {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    };

    // Build authorization request WITHOUT PKCE.
    // Google iOS credentials do NOT support PKCE (code_challenge); sending it
    // triggers Error 400: invalid_request "doesn't comply with Google's OAuth 2.0
    // policy".  iOS native credentials are trusted clients — no PKCE or
    // client_secret is required; the credential type itself is the security.
    const request = new AuthSession.AuthRequest({
      clientId: googleClientId,
      scopes: ['openid', 'email', 'profile'],
      redirectUri,
      usePKCE: false,
    });

    const authResult = await request.promptAsync(discovery);

    if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
      throw new Error('Google sign-in was cancelled');
    }
    if (authResult.type !== 'success') {
      throw new Error('Google sign-in failed');
    }

    // Exchange authorization code → tokens directly with Google.
    // No code_verifier needed (PKCE disabled for iOS credential).
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: googleClientId,
        redirectUri,
        code: authResult.params.code,
      },
      discovery,
    );

    const idToken = tokenResponse.idToken;
    if (!idToken) {
      throw new Error('Google did not return an ID token — ensure openid scope is requested');
    }

    // Send id_token to backend for secure server-side verification
    const response = await api.post<{
      user: { id: string; email: string; name?: string };
      access_token: string;
      refresh_token: string;
    }>('/auth/google/login', { id_token: idToken });

    return response.data;
  },

  // Logout
  logout: async () => {
    await api.post('/auth/logout');
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
  },
};

export default api;

// ─── Agent API ────────────────────────────────────────────────────────────────

export interface AgentInsight {
  id: string;
  insight_type: 'intention_loop' | 'arc' | 'tension';
  title: string;
  body: string;
  synthesis: string;
  memory_ids: string[];
}

export interface SynthesisResult {
  synthesis: string;
  memory_ids: string[];
}

export const agentApi = {
  registerPushToken: async (expoPushToken: string): Promise<void> => {
    await api.post('/agent/notifications/register', { expo_push_token: expoPushToken });
  },

  getInsight: async (insightId: string): Promise<AgentInsight> => {
    const r = await api.get<AgentInsight>(`/agent/insights/${insightId}`);
    return r.data;
  },

  markOpened: async (insightId: string): Promise<void> => {
    await api.post(`/agent/insights/${insightId}/open`);
  },

  dismiss: async (insightId: string): Promise<void> => {
    await api.post(`/agent/insights/${insightId}/dismiss`);
  },

  synthesizeMemories: async (memoryIds: string[]): Promise<SynthesisResult> => {
    const r = await api.post<SynthesisResult>('/ai/synthesize', { memory_ids: memoryIds });
    return r.data;
  },
};

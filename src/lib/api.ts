/**
 * API Client for Sign-to-Health Backend
 * 
 * Provides type-safe methods for interacting with the backend API.
 * Falls back to localStorage if API is unavailable.
 */

import type { SessionRecord } from "./automation";
import type { AppSettings } from "./db";

const API_BASE = "/api";

/**
 * API Response type
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  count?: number;
}

/**
 * Health check response
 */
interface HealthResponse {
  success: boolean;
  status: "healthy" | "unhealthy";
  timestamp: string;
  version: string;
  database: {
    status: string;
    sessionCount: number;
  };
  statistics: {
    totalSessions: number;
    emergencies: number;
  };
}

/**
 * Check if API is available
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: "GET",
      cache: "no-store",
    });
    const data: HealthResponse = await response.json();
    return data.success && data.status === "healthy";
  } catch {
    return false;
  }
}

/**
 * Get full health status
 */
export async function getHealthStatus(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: "GET",
      cache: "no-store",
    });
    return await response.json();
  } catch {
    return null;
  }
}

// ============================================
// SESSIONS API
// ============================================

/**
 * Get all sessions
 */
export async function fetchSessions(
  filter?: "all" | "emergencies" | "today" | "week"
): Promise<SessionRecord[]> {
  try {
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);

    const response = await fetch(`${API_BASE}/sessions?${params}`, {
      method: "GET",
      cache: "no-store",
    });

    const data: ApiResponse<SessionRecord[]> = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    // Fallback to localStorage
    return getLocalSessions();
  } catch {
    return getLocalSessions();
  }
}

/**
 * Get session statistics
 */
export async function fetchSessionStats(): Promise<{
  total: number;
  emergencies: number;
  avgDuration: number;
  byTriage: Record<string, number>;
} | null> {
  try {
    const response = await fetch(`${API_BASE}/sessions?stats=true`, {
      method: "GET",
      cache: "no-store",
    });

    const data: ApiResponse<{
      total: number;
      emergencies: number;
      avgDuration: number;
      byTriage: Record<string, number>;
    }> = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get a specific session
 */
export async function fetchSession(id: string): Promise<SessionRecord | null> {
  try {
    const response = await fetch(`${API_BASE}/sessions/${id}`, {
      method: "GET",
      cache: "no-store",
    });

    const data: ApiResponse<SessionRecord> = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    // Fallback to localStorage
    const local = getLocalSessions();
    return local.find((s) => s.id === id) || null;
  } catch {
    const local = getLocalSessions();
    return local.find((s) => s.id === id) || null;
  }
}

/**
 * Save a session
 */
export async function saveSessionToApi(session: SessionRecord): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    });

    const data: ApiResponse<SessionRecord> = await response.json();

    if (data.success) {
      // Also save to localStorage as backup
      saveLocalSession(session);
      return true;
    }

    // Fallback to localStorage only
    saveLocalSession(session);
    return true;
  } catch {
    // Fallback to localStorage
    saveLocalSession(session);
    return true;
  }
}

/**
 * Update a session
 */
export async function updateSession(
  id: string,
  updates: Partial<SessionRecord>
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/sessions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const data: ApiResponse<SessionRecord> = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

/**
 * Delete a session
 */
export async function deleteSessionFromApi(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/sessions/${id}`, {
      method: "DELETE",
    });

    const data: ApiResponse<void> = await response.json();

    if (data.success) {
      // Also remove from localStorage
      deleteLocalSession(id);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Clear all sessions
 */
export async function clearAllSessionsFromApi(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: "DELETE",
    });

    const data: ApiResponse<void> = await response.json();

    if (data.success) {
      // Also clear localStorage
      clearLocalSessions();
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ============================================
// SETTINGS API
// ============================================

/**
 * Get settings (safe version - no API keys)
 */
export async function fetchSettings(): Promise<Partial<AppSettings> | null> {
  try {
    const response = await fetch(`${API_BASE}/settings`, {
      method: "GET",
      cache: "no-store",
    });

    const data: ApiResponse<AppSettings> = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get API keys (for client-side services)
 */
export async function fetchApiKeys(): Promise<{
  humeApiKey: string | null;
  elevenLabsApiKey: string | null;
} | null> {
  try {
    const response = await fetch(`${API_BASE}/settings/keys`, {
      method: "GET",
      cache: "no-store",
    });

    const data: ApiResponse<{
      humeApiKey: string | null;
      elevenLabsApiKey: string | null;
    }> = await response.json();

    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Update settings
 */
export async function updateSettings(
  updates: Partial<AppSettings>
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const data: ApiResponse<AppSettings> = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

/**
 * Reset settings to default
 */
export async function resetSettingsToDefault(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/settings`, {
      method: "DELETE",
    });

    const data: ApiResponse<AppSettings> = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

// ============================================
// LOCAL STORAGE FALLBACK
// ============================================

const LOCAL_SESSIONS_KEY = "signToHealth_history";

function getLocalSessions(): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(LOCAL_SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalSession(session: SessionRecord): void {
  if (typeof window === "undefined") return;
  const sessions = getLocalSessions();
  const existingIndex = sessions.findIndex((s) => s.id === session.id);

  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.unshift(session);
  }

  // Keep only last 50
  if (sessions.length > 50) {
    sessions.splice(50);
  }

  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
}

function deleteLocalSession(id: string): void {
  if (typeof window === "undefined") return;
  const sessions = getLocalSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(filtered));
}

function clearLocalSessions(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_SESSIONS_KEY);
}

// ============================================
// SYNC UTILITIES
// ============================================

/**
 * Sync local sessions to API
 * Use this to migrate from localStorage to backend
 */
export async function syncLocalToApi(): Promise<{
  synced: number;
  failed: number;
}> {
  const local = getLocalSessions();
  let synced = 0;
  let failed = 0;

  for (const session of local) {
    const success = await saveSessionToApi(session);
    if (success) {
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed };
}

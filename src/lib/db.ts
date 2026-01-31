/**
 * Simple File-Based Database for Sign-to-Health AI
 * 
 * For MVP/Hackathon: Uses JSON file storage
 * For Production: Replace with PostgreSQL, MongoDB, or other database
 * 
 * Features:
 * - Session storage
 * - Settings storage
 * - Automatic file creation
 * - Type-safe operations
 */

import { promises as fs } from "fs";
import path from "path";
import type { SessionRecord } from "./automation";

// Database file paths
const DATA_DIR = path.join(process.cwd(), "data");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

/**
 * Application settings
 */
export interface AppSettings {
  humeApiKey?: string;
  elevenLabsApiKey?: string;
  autoSaveEnabled: boolean;
  voiceSummaryEnabled: boolean;
  emergencyAlertEnabled: boolean;
  maxSessionHistory: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Database state
 */
interface DatabaseState {
  sessions: SessionRecord[];
  settings: AppSettings;
}

/**
 * Default settings
 */
const DEFAULT_SETTINGS: AppSettings = {
  autoSaveEnabled: true,
  voiceSummaryEnabled: true,
  emergencyAlertEnabled: true,
  maxSessionHistory: 100,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/**
 * Ensure data directory exists
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Read JSON file safely
 */
async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch {
    // File doesn't exist or is invalid, return default
    return defaultValue;
  }
}

/**
 * Write JSON file safely
 */
async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ============================================
// SESSIONS
// ============================================

/**
 * Get all sessions
 */
export async function getAllSessions(): Promise<SessionRecord[]> {
  return readJsonFile<SessionRecord[]>(SESSIONS_FILE, []);
}

/**
 * Get session by ID
 */
export async function getSessionById(id: string): Promise<SessionRecord | null> {
  const sessions = await getAllSessions();
  return sessions.find((s) => s.id === id) || null;
}

/**
 * Save a new session
 */
export async function saveSession(session: SessionRecord): Promise<SessionRecord> {
  const sessions = await getAllSessions();
  const settings = await getSettings();
  
  // Check if session already exists (update) or is new (create)
  const existingIndex = sessions.findIndex((s) => s.id === session.id);
  
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.unshift(session); // Add to beginning (newest first)
  }
  
  // Trim to max history
  if (sessions.length > settings.maxSessionHistory) {
    sessions.splice(settings.maxSessionHistory);
  }
  
  await writeJsonFile(SESSIONS_FILE, sessions);
  return session;
}

/**
 * Delete a session
 */
export async function deleteSession(id: string): Promise<boolean> {
  const sessions = await getAllSessions();
  const index = sessions.findIndex((s) => s.id === id);
  
  if (index === -1) return false;
  
  sessions.splice(index, 1);
  await writeJsonFile(SESSIONS_FILE, sessions);
  return true;
}

/**
 * Clear all sessions
 */
export async function clearAllSessions(): Promise<void> {
  await writeJsonFile(SESSIONS_FILE, []);
}

/**
 * Get sessions by date range
 */
export async function getSessionsByDateRange(
  startDate: number,
  endDate: number
): Promise<SessionRecord[]> {
  const sessions = await getAllSessions();
  return sessions.filter(
    (s) => s.timestamp >= startDate && s.timestamp <= endDate
  );
}

/**
 * Get emergency sessions
 */
export async function getEmergencySessions(): Promise<SessionRecord[]> {
  const sessions = await getAllSessions();
  return sessions.filter((s) => s.emergencyTriggered);
}

/**
 * Get session statistics
 */
export async function getSessionStats(): Promise<{
  total: number;
  emergencies: number;
  avgDuration: number;
  byTriage: Record<string, number>;
}> {
  const sessions = await getAllSessions();
  
  const emergencies = sessions.filter((s) => s.emergencyTriggered).length;
  const avgDuration = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length
    : 0;
  
  const byTriage: Record<string, number> = {};
  sessions.forEach((s) => {
    const triage = s.triageUrgency || "unknown";
    byTriage[triage] = (byTriage[triage] || 0) + 1;
  });
  
  return {
    total: sessions.length,
    emergencies,
    avgDuration,
    byTriage,
  };
}

// ============================================
// SETTINGS
// ============================================

/**
 * Get application settings
 */
export async function getSettings(): Promise<AppSettings> {
  return readJsonFile<AppSettings>(SETTINGS_FILE, DEFAULT_SETTINGS);
}

/**
 * Update application settings
 */
export async function updateSettings(
  updates: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await getSettings();
  const updated: AppSettings = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };
  await writeJsonFile(SETTINGS_FILE, updated);
  return updated;
}

/**
 * Reset settings to default
 */
export async function resetSettings(): Promise<AppSettings> {
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await writeJsonFile(SETTINGS_FILE, settings);
  return settings;
}

// ============================================
// DATABASE INFO
// ============================================

/**
 * Get database info
 */
export async function getDatabaseInfo(): Promise<{
  dataDir: string;
  sessionsFile: string;
  settingsFile: string;
  sessionCount: number;
  lastUpdated: number;
}> {
  const sessions = await getAllSessions();
  const settings = await getSettings();
  
  return {
    dataDir: DATA_DIR,
    sessionsFile: SESSIONS_FILE,
    settingsFile: SETTINGS_FILE,
    sessionCount: sessions.length,
    lastUpdated: settings.updatedAt,
  };
}

/**
 * Initialize database (ensure files exist)
 */
export async function initDatabase(): Promise<void> {
  await ensureDataDir();
  
  // Initialize sessions file if doesn't exist
  try {
    await fs.access(SESSIONS_FILE);
  } catch {
    await writeJsonFile(SESSIONS_FILE, []);
  }
  
  // Initialize settings file if doesn't exist
  try {
    await fs.access(SETTINGS_FILE);
  } catch {
    await writeJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
  }
}

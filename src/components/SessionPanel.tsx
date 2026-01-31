"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Volume2,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  Play,
  Cloud,
  CloudOff,
} from "lucide-react";
import type { GestureState } from "@/lib/types";
import {
  generateSessionId,
  generateReport,
  formatVoiceSummary,
  exportToPDF,
  playVoiceSummary,
  isEmotionHighAlert,
  type SessionRecord,
} from "@/lib/automation";
import { 
  fetchSessions, 
  saveSessionToApi, 
  deleteSessionFromApi,
  clearAllSessionsFromApi,
  checkApiHealth,
} from "@/lib/api";
import { inferEmotionFromGestures } from "@/lib/emotionLayer";
import { TRIAGE_LABELS, TRIAGE_COLORS } from "@/lib/triageLogic";

interface Props {
  gestureState: GestureState | null;
  clinicalInterpretation: string | null;
}

/**
 * Session Panel Component
 * 
 * Handles the automation workflow:
 * - Session management
 * - Auto-save to history
 * - PDF export
 * - Voice summary
 * - Session history view
 */
export default function SessionPanel({
  gestureState,
  clinicalInterpretation,
}: Props) {
  const [sessionId] = useState(() => generateSessionId());
  const [sessionStart] = useState(() => Date.now());
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [showHighAlert, setShowHighAlert] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check API health and load history on mount
  useEffect(() => {
    const init = async () => {
      const healthy = await checkApiHealth();
      setIsApiConnected(healthy);
      
      // Load history from API (falls back to localStorage)
      const sessions = await fetchSessions();
      setHistory(sessions);
    };
    init();
  }, []);

  // Check for high emotion alert
  useEffect(() => {
    if (gestureState) {
      const emotion = inferEmotionFromGestures(gestureState);
      if (isEmotionHighAlert(emotion)) {
        setShowHighAlert(true);
        // Auto-dismiss after 5 seconds
        const timer = setTimeout(() => setShowHighAlert(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [gestureState]);

  // Generate current report
  const currentReport = generateReport(
    gestureState,
    clinicalInterpretation,
    sessionId,
    sessionStart
  );

  // Save to history (uses API with localStorage fallback)
  const handleSaveToHistory = useCallback(async () => {
    if (!currentReport || currentReport.id === lastSavedId || isSaving) return;
    
    setIsSaving(true);
    try {
      await saveSessionToApi(currentReport);
      setLastSavedId(currentReport.id);
      // Refresh history
      const sessions = await fetchSessions();
      setHistory(sessions);
    } catch (error) {
      console.error("Failed to save session:", error);
    }
    setIsSaving(false);
  }, [currentReport, lastSavedId, isSaving]);

  // Export to PDF
  const handleExportPDF = useCallback(async () => {
    if (!currentReport) return;
    
    // Save first if not saved
    if (currentReport.id !== lastSavedId) {
      await handleSaveToHistory();
    }
    
    exportToPDF(currentReport);
  }, [currentReport, lastSavedId, handleSaveToHistory]);

  // Play voice summary
  const handlePlayVoice = useCallback(async () => {
    if (!currentReport || isSpeaking) return;
    
    setIsSpeaking(true);
    const summary = formatVoiceSummary(currentReport);
    await playVoiceSummary(summary);
    setIsSpeaking(false);
  }, [currentReport, isSpeaking]);

  // Clear history (uses API with localStorage fallback)
  const handleClearHistory = useCallback(async () => {
    await clearAllSessionsFromApi();
    setHistory([]);
  }, []);

  // Export history record
  const handleExportRecord = useCallback((record: SessionRecord) => {
    exportToPDF(record);
  }, []);

  if (!gestureState && !clinicalInterpretation && history.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden shadow-lg">
      {/* High Alert Banner */}
      <AnimatePresence>
        {showHighAlert && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[var(--alert-emergency)] text-white px-4 py-2 flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              High distress detected - Auto-triage activated
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-default)] bg-gradient-to-r from-[var(--bg-elevated)] to-[var(--bg-primary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--accent-primary)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Session Report
            </span>
            {/* API Connection Status */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
              isApiConnected 
                ? "bg-green-500/20 text-green-400" 
                : "bg-amber-500/20 text-amber-400"
            }`}>
              {isApiConnected ? (
                <><Cloud className="h-3 w-3" /> API</>
              ) : (
                <><CloudOff className="h-3 w-3" /> Local</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">
              {Math.floor((Date.now() - sessionStart) / 1000)}s
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {currentReport && (
        <div className="p-4 border-b border-[var(--border-default)]">
          <div className="grid grid-cols-3 gap-2">
            {/* Save to History */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSaveToHistory}
              disabled={currentReport.id === lastSavedId || isSaving}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ${
                currentReport.id === lastSavedId
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                  : isSaving
                  ? "border-[var(--text-muted)] bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                  : "border-[var(--border-default)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/5"
              }`}
            >
              <FileText className={`h-5 w-5 ${isSaving ? "animate-pulse" : ""}`} />
              <span className="text-xs font-medium">
                {currentReport.id === lastSavedId ? "Saved" : isSaving ? "Saving..." : "Save"}
              </span>
            </motion.button>

            {/* Export PDF */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportPDF}
              className="flex flex-col items-center gap-1 p-3 rounded-xl border border-[var(--border-default)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/5 transition-colors"
            >
              <Download className="h-5 w-5 text-[var(--text-secondary)]" />
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Export PDF
              </span>
            </motion.button>

            {/* Voice Summary */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePlayVoice}
              disabled={isSpeaking}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ${
                isSpeaking
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                  : "border-[var(--border-default)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/5"
              }`}
            >
              {isSpeaking ? (
                <Volume2 className="h-5 w-5 animate-pulse" />
              ) : (
                <Play className="h-5 w-5 text-[var(--text-secondary)]" />
              )}
              <span className="text-xs font-medium">
                {isSpeaking ? "Speaking..." : "Voice"}
              </span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Session History Toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-primary)]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            Session History
          </span>
          {history.length > 0 && (
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full">
              {history.length}
            </span>
          )}
        </div>
        {showHistory ? (
          <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </button>

      {/* History List */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[var(--border-default)] overflow-hidden"
          >
            {history.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-muted)] text-sm">
                No saved sessions yet
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                {history.slice(0, 10).map((record, i) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 border-b border-[var(--border-default)] last:border-b-0 hover:bg-[var(--bg-primary)]/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(record.timestamp).toLocaleString()}
                        </span>
                        {record.triageUrgency && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: `${TRIAGE_COLORS[record.triageUrgency]}20`,
                              color: TRIAGE_COLORS[record.triageUrgency],
                            }}
                          >
                            {TRIAGE_LABELS[record.triageUrgency].replace(/[🚨🚑⚠️🟡🧠]\s?/, "")}
                          </span>
                        )}
                        {record.emergencyTriggered && (
                          <AlertTriangle className="h-3 w-3 text-[var(--alert-emergency)]" />
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] truncate mt-1">
                        {record.clinicalInterpretation || "No interpretation"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleExportRecord(record)}
                      className="p-2 rounded-lg hover:bg-[var(--accent-primary)]/10 text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                      title="Export to PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                
                {/* Clear History Button */}
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="w-full p-3 text-sm text-[var(--alert-emergency)] hover:bg-[var(--alert-emergency)]/10 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear History
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

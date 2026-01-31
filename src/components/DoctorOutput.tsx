"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, FileText, Heart, ClipboardList, Tag, ChevronDown, ChevronUp } from "lucide-react";
import { inferEmotionFromGestures } from "@/lib/emotionLayer";
import { inferTriageUrgency } from "@/lib/triageLogic";
import { generateSOAPNote, getICD10Codes } from "@/lib/clinicalOutput";
import TriageBadge from "./TriageBadge";
import type { GestureState } from "@/lib/types";

interface Props {
  gestureState: GestureState | null;
  clinicalInterpretation: string | null;
}

export default function DoctorOutput({
  gestureState,
  clinicalInterpretation,
}: Props) {
  const emotion = inferEmotionFromGestures(gestureState);
  const triageUrgency = inferTriageUrgency(gestureState, clinicalInterpretation);
  const soapNote = generateSOAPNote(gestureState, clinicalInterpretation, emotion);
  const icd10Codes = gestureState ? getICD10Codes(gestureState.gestureTokens) : [];
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showSOAP, setShowSOAP] = useState(false);
  const [showICD10, setShowICD10] = useState(false);

  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);

  const speak = useCallback((text: string) => {
    if (!speechSupported || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [speechSupported]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-gradient-to-r from-[var(--bg-elevated)] to-[var(--bg-primary)]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)]/20 backdrop-blur-sm">
            <FileText className="h-4 w-4 text-[var(--accent-primary)]" />
          </div>
          <span className="font-[family-name:var(--font-display)] font-semibold">
            Clinical Interpretation
          </span>
        </div>
        {clinicalInterpretation && speechSupported && (
          <button
            onClick={isSpeaking ? stopSpeaking : () => speak(clinicalInterpretation)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] transition-colors backdrop-blur-sm"
            aria-label={isSpeaking ? "Stop speech" : "Read aloud"}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="h-4 w-4" />
                Stop
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                Read aloud
              </>
            )}
          </button>
        )}
      </div>

      <div className="p-4 sm:p-6 min-h-[200px]">
        {clinicalInterpretation ? (
          <div className="space-y-4">
            {/* Triage Badge */}
            {triageUrgency && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <TriageBadge urgency={triageUrgency} />
              </motion.div>
            )}
            
            {/* Emotion Detection */}
            {emotion && (emotion.painLevel > 0 || emotion.distress > 0) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 px-4 py-3 backdrop-blur-sm"
              >
                <Heart className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="text-sm text-[var(--text-secondary)]">
                  Detected: {emotion.emotion}
                  {emotion.painLevel > 0 && ` • Pain ${Math.round(emotion.painLevel * 100)}%`}
                  {emotion.distress > 0 && ` • Distress ${Math.round(emotion.distress * 100)}%`}
                </span>
              </motion.div>
            )}
            
            {/* Main Interpretation Card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)] p-4 sm:p-5 border border-[var(--border-default)] shadow-inner"
            >
              <p className="text-[var(--text-primary)] leading-relaxed">
                {clinicalInterpretation}
              </p>
            </motion.div>
            
            {/* SOAP Note Section */}
            {soapNote && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-[var(--border-default)] overflow-hidden backdrop-blur-sm"
              >
                <button
                  onClick={() => setShowSOAP(!showSOAP)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-primary)]/50 hover:bg-[var(--bg-primary)]/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span className="font-medium text-sm">SOAP Note</span>
                  </div>
                  {showSOAP ? (
                    <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                  )}
                </button>
                
                <AnimatePresence>
                  {showSOAP && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-4 bg-[var(--bg-primary)]/30">
                        {/* Subjective */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)] mb-1">
                            Subjective
                          </h4>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {soapNote.subjective}
                          </p>
                        </div>
                        
                        {/* Objective */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)] mb-1">
                            Objective
                          </h4>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {soapNote.objective}
                          </p>
                        </div>
                        
                        {/* Assessment */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)] mb-1">
                            Assessment
                          </h4>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {soapNote.assessment}
                          </p>
                        </div>
                        
                        {/* Plan */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)] mb-1">
                            Plan
                          </h4>
                          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">
                            {soapNote.plan}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
            
            {/* ICD-10 Codes Section */}
            {icd10Codes.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-[var(--border-default)] overflow-hidden backdrop-blur-sm"
              >
                <button
                  onClick={() => setShowICD10(!showICD10)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-primary)]/50 hover:bg-[var(--bg-primary)]/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span className="font-medium text-sm">ICD-10 Codes</span>
                    <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full">
                      {icd10Codes.length}
                    </span>
                  </div>
                  {showICD10 ? (
                    <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                  )}
                </button>
                
                <AnimatePresence>
                  {showICD10 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-[var(--bg-primary)]/30">
                        <p className="text-xs text-[var(--text-muted)] mb-3">
                          Suggested codes based on gesture interpretation:
                        </p>
                        <div className="space-y-2">
                          {icd10Codes.map((item, index) => (
                            <motion.div
                              key={item.code}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="flex items-start gap-3 p-2 rounded-lg bg-[var(--bg-secondary)]/50"
                            >
                              <code className="text-xs font-mono font-semibold text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-2 py-1 rounded">
                                {item.code}
                              </code>
                              <span className="text-sm text-[var(--text-secondary)]">
                                {item.description}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                        <p className="text-xs text-[var(--alert-emergency)]/70 mt-3 italic">
                          Note: These are suggested codes for reference only. Final coding should be performed by certified medical coders.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[180px] text-center p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)] border border-[var(--border-default)] mb-4 shadow-inner">
              <FileText className="h-8 w-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-secondary)] text-sm max-w-xs">
              Use sign language or gestures in front of the camera, or tap a
              demo gesture to see the clinical interpretation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  Hand, 
  Heart, 
  Activity, 
  MapPin,
  ArrowRight,
  Stethoscope,
  Building2,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import type { GestureState } from "@/lib/types";
import { inferTriageUrgency, TRIAGE_LABELS, TRIAGE_COLORS, TRIAGE_DEPARTMENTS, getMatchedTriagePattern } from "@/lib/triageLogic";
import { getPainRegionFromGestures, getPainRegionLabel } from "@/lib/painRegion";
import { inferEmotionFromGestures } from "@/lib/emotionLayer";
import { getDepartmentRecommendation } from "@/lib/automation";

interface Props {
  gestureState: GestureState | null;
  clinicalInterpretation: string | null;
}

/**
 * Knowledge Graph Node component
 */
function GraphNode({
  icon: Icon,
  label,
  value,
  color = "var(--accent-primary)",
  isActive = true,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
  isActive?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isActive ? 1 : 0.4, scale: 1 }}
      className="flex flex-col items-center gap-2"
    >
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
        style={{ 
          backgroundColor: isActive ? `${color}20` : "var(--bg-secondary)",
          border: `2px solid ${isActive ? color : "var(--border-default)"}`,
        }}
      >
        <div style={{ color: isActive ? color : "var(--text-muted)" }}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p 
          className="text-sm font-medium truncate max-w-[100px]"
          style={{ color: isActive ? "var(--text-primary)" : "var(--text-muted)" }}
          title={value}
        >
          {value}
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Arrow connector between nodes
 */
function ArrowConnector({ active = true }: { active?: boolean }) {
  return (
    <div className="flex items-center justify-center px-2">
      <ArrowRight 
        className="h-4 w-4" 
        style={{ color: active ? "var(--accent-primary)" : "var(--text-muted)" }}
      />
    </div>
  );
}

/**
 * Explainability Panel Component
 * 
 * Displays the AI reasoning chain as a knowledge graph:
 * Gesture → Symptom → Diagnosis → Urgency → Department
 * 
 * Features:
 * - Visual graph representation
 * - AI transparency
 * - Clinician trust building
 * - Regulatory readiness
 */
export default function ExplainabilityPanel({
  gestureState,
  clinicalInterpretation,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!gestureState && !clinicalInterpretation) return null;

  const tokens = gestureState?.gestureTokens ?? [];
  const painRegion = getPainRegionFromGestures(gestureState);
  const emotion = inferEmotionFromGestures(gestureState);
  const urgency = inferTriageUrgency(gestureState, clinicalInterpretation);
  const matchedPattern = getMatchedTriagePattern(gestureState);
  
  // Generate session record for department recommendation
  const sessionRecord = gestureState ? {
    id: "temp",
    timestamp: Date.now(),
    duration: 0,
    gestureTokens: tokens,
    painRegion,
    emotion,
    clinicalInterpretation,
    triageUrgency: urgency,
    soapNote: null,
    icd10Codes: [],
    patientConfirmed: null,
    emergencyTriggered: false,
  } : null;
  
  const department = sessionRecord ? getDepartmentRecommendation(sessionRecord) : null;

  // Build reasoning steps for the traditional view
  const steps = [
    tokens.length > 0 && {
      icon: Hand,
      from: "Gestures Detected",
      to: tokens.slice(0, 5).join(", ") + (tokens.length > 5 ? "..." : ""),
      label: "Input",
      color: "var(--accent-primary)",
    },
    painRegion && {
      icon: MapPin,
      from: "Pain Location",
      to: getPainRegionLabel(painRegion),
      label: "Localized",
      color: "#f97316",
    },
    emotion && (emotion.painLevel > 0 || emotion.distress > 0) && {
      icon: Heart,
      from: "Emotional State",
      to: `${emotion.emotion} (Pain: ${Math.round(emotion.painLevel * 100)}%, Distress: ${Math.round(emotion.distress * 100)}%)`,
      label: "Detected",
      color: "#ef4444",
    },
    matchedPattern && {
      icon: Activity,
      from: "Pattern Matched",
      to: matchedPattern.name,
      label: "Classified",
      color: "#a855f7",
    },
    clinicalInterpretation && {
      icon: Stethoscope,
      from: "Clinical Inference",
      to: clinicalInterpretation.length > 100 ? clinicalInterpretation.slice(0, 100) + "…" : clinicalInterpretation,
      label: "Reasoned",
      color: "#22c55e",
    },
    urgency && {
      icon: AlertTriangle,
      from: "Triage Level",
      to: TRIAGE_LABELS[urgency],
      label: "Prioritized",
      color: TRIAGE_COLORS[urgency],
    },
    department && {
      icon: Building2,
      from: "Recommended Dept",
      to: department,
      label: "Routed",
      color: "#3b82f6",
    },
  ].filter(Boolean) as Array<{ 
    icon: React.ComponentType<{ className?: string }>;
    from: string; 
    to: string; 
    label: string;
    color: string;
  }>;

  if (steps.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden shadow-lg">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-primary)]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            AI Reasoning Chain
          </span>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full">
            {steps.length} steps
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </button>
      
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[var(--border-default)] overflow-hidden"
          >
            <div className="p-4 space-y-6">
              {/* Knowledge Graph Visualization */}
              <div className="bg-[var(--bg-primary)]/50 rounded-xl p-4 overflow-x-auto">
                <p className="text-xs text-[var(--text-muted)] mb-4 font-medium">
                  Knowledge Graph: gesture → symptom → diagnosis → urgency → department
                </p>
                
                {/* Visual graph - horizontal flow */}
                <div className="flex items-start justify-start gap-1 min-w-max pb-2">
                  {/* Gesture Node */}
                  <GraphNode
                    icon={Hand}
                    label="Gesture"
                    value={tokens[0] || "None"}
                    color="var(--accent-primary)"
                    isActive={tokens.length > 0}
                  />
                  
                  <ArrowConnector active={!!painRegion || !!emotion} />
                  
                  {/* Symptom Node */}
                  <GraphNode
                    icon={painRegion ? MapPin : Heart}
                    label="Symptom"
                    value={painRegion ? getPainRegionLabel(painRegion) : emotion?.emotion || "None"}
                    color="#f97316"
                    isActive={!!painRegion || !!emotion}
                  />
                  
                  <ArrowConnector active={!!clinicalInterpretation} />
                  
                  {/* Diagnosis Node */}
                  <GraphNode
                    icon={Stethoscope}
                    label="Diagnosis"
                    value={matchedPattern?.name || "Assessing..."}
                    color="#a855f7"
                    isActive={!!matchedPattern || !!clinicalInterpretation}
                  />
                  
                  <ArrowConnector active={!!urgency} />
                  
                  {/* Urgency Node */}
                  <GraphNode
                    icon={AlertTriangle}
                    label="Urgency"
                    value={urgency ? TRIAGE_LABELS[urgency].replace(/[🚨🚑⚠️🟡🧠]\s?/, "") : "None"}
                    color={urgency ? TRIAGE_COLORS[urgency] : "var(--text-muted)"}
                    isActive={!!urgency}
                  />
                  
                  <ArrowConnector active={!!department} />
                  
                  {/* Department Node */}
                  <GraphNode
                    icon={Building2}
                    label="Department"
                    value={department?.split(" / ")[0] || "Pending"}
                    color="#3b82f6"
                    isActive={!!department}
                  />
                </div>
              </div>
              
              {/* Detailed Steps */}
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-muted)] font-medium">
                  Detailed Reasoning Steps
                </p>
                {steps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div 
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ 
                        backgroundColor: `${step.color}20`,
                        color: step.color,
                      }}
                    >
                      <step.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-muted)] font-medium">{step.from}</span>
                        <span 
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ 
                            backgroundColor: `${step.color}15`,
                            color: step.color,
                          }}
                        >
                          {step.label}
                        </span>
                      </div>
                      <p className="text-[var(--text-primary)] mt-0.5 break-words">
                        {step.to}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              {/* Transparency Notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--text-secondary)]">
                  <strong>AI Transparency:</strong> This reasoning chain shows how Sign-to-Health AI 
                  interprets gestures and arrives at clinical recommendations. All outputs should be 
                  validated by qualified medical professionals.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { AlertCircle, Heart, Brain, Clock } from "lucide-react";
import type { TriageUrgency } from "@/lib/triageLogic";
import { TRIAGE_LABELS } from "@/lib/triageLogic";

interface Props {
  urgency: TriageUrgency;
}

const URGENCY_CONFIG: Record<
  NonNullable<TriageUrgency>,
  { icon: typeof AlertCircle; color: string; bgColor: string }
> = {
  immediate: {
    icon: AlertCircle,
    color: "var(--alert-immediate)",
    bgColor: "rgba(239, 68, 68, 0.2)",
  },
  emergency: {
    icon: AlertCircle,
    color: "var(--alert-emergency)",
    bgColor: "rgba(249, 115, 22, 0.2)",
  },
  urgent: {
    icon: Clock,
    color: "var(--alert-urgent)",
    bgColor: "rgba(234, 179, 8, 0.2)",
  },
  "non-urgent": {
    icon: Heart,
    color: "var(--accent-primary)",
    bgColor: "rgba(0, 212, 170, 0.2)",
  },
  "mental-health": {
    icon: Brain,
    color: "#a78bfa",
    bgColor: "rgba(167, 139, 250, 0.2)",
  },
};

export default function TriageBadge({ urgency }: Props) {
  if (!urgency) return null;

  const config = URGENCY_CONFIG[urgency];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border"
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.color,
      }}
    >
      <Icon className="h-4 w-4" style={{ color: config.color }} />
      <span className="text-sm font-semibold" style={{ color: config.color }}>
        {TRIAGE_LABELS[urgency]}
      </span>
    </motion.div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  active: boolean;
}

export default function EmergencyOverlay({ active }: Props) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!active) setDismissed(false);
  }, [active]);
  const show = active && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 20 }}
            className="relative flex flex-col items-center gap-6 max-w-md text-center"
          >
            <button
              onClick={() => setDismissed(true)}
              className="absolute -top-2 -right-2 rounded-full p-2 text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Dismiss (demo)"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--alert-immediate)]/20 border-2 border-[var(--alert-immediate)]">
              <AlertTriangle className="h-10 w-10 text-[var(--alert-immediate)]" />
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-white">
              Emergency detected
            </h2>
            <p className="text-[var(--text-secondary)]">
              Calling medical staff. Please stay calm.
            </p>
            <div className="h-2 w-24 rounded-full bg-[var(--alert-immediate)] animate-pulse" />
            <p className="text-xs text-[var(--text-muted)]">Demo: tap X to dismiss</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

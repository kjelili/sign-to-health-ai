"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ThumbsUp, ThumbsDown, HelpCircle, RefreshCw } from "lucide-react";

interface Props {
  clinicalInterpretation: string | null;
  onConfirm?: (correct: boolean) => void;
}

/**
 * Patient Confirmation Component
 * 
 * Provides visual confirmation cards for patients to indicate
 * if the AI interpretation is correct.
 * 
 * Features:
 * - Large, touch-friendly buttons
 * - Visual icons (no reading required)
 * - Green check for "Yes, correct"
 * - Feedback animation
 * - Fully accessible
 */
export default function PatientConfirmation({
  clinicalInterpretation,
  onConfirm,
}: Props) {
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  if (!clinicalInterpretation) return null;

  const handleConfirm = (correct: boolean) => {
    setConfirmed(correct);
    setShowFeedback(true);
    onConfirm?.(correct);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setShowFeedback(false);
    }, 3000);
  };

  const handleReset = () => {
    setConfirmed(null);
    setShowFeedback(false);
  };

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-default)] bg-gradient-to-r from-[var(--bg-elevated)] to-[var(--bg-primary)]">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            Patient Confirmation
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {showFeedback ? (
            // Feedback state
            <motion.div
              key="feedback"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-6"
            >
              {confirmed ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.5 }}
                      className="h-16 w-16 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center"
                    >
                      <ThumbsUp className="h-8 w-8 text-[var(--accent-primary)]" />
                    </motion.div>
                  </div>
                  <p className="text-[var(--accent-primary)] font-semibold text-lg">
                    Thank you!
                  </p>
                  <p className="text-[var(--text-muted)] text-sm">
                    Interpretation confirmed
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.5 }}
                      className="h-16 w-16 rounded-full bg-[var(--alert-emergency)]/20 flex items-center justify-center"
                    >
                      <ThumbsDown className="h-8 w-8 text-[var(--alert-emergency)]" />
                    </motion.div>
                  </div>
                  <p className="text-[var(--alert-emergency)] font-semibold text-lg">
                    Noted
                  </p>
                  <p className="text-[var(--text-muted)] text-sm">
                    Please try again with clearer gestures
                  </p>
                </div>
              )}
              
              <button
                onClick={handleReset}
                className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Confirm again
              </button>
            </motion.div>
          ) : (
            // Confirmation buttons
            <motion.div
              key="buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Question */}
              <p className="text-center text-[var(--text-primary)] font-medium mb-4">
                Is this interpretation correct?
              </p>
              
              {/* Large visual buttons */}
              <div className="grid grid-cols-2 gap-4">
                {/* Yes button - Green with check icon */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleConfirm(true)}
                  className="group relative flex flex-col items-center justify-center gap-3 min-h-[120px] rounded-2xl bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-primary)]/10 border-2 border-[var(--accent-primary)] transition-all hover:shadow-lg hover:shadow-[var(--accent-primary)]/20"
                  aria-label="Yes, that's correct"
                >
                  {/* Large icon */}
                  <div className="h-14 w-14 rounded-full bg-[var(--accent-primary)] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Check className="h-8 w-8 text-[var(--bg-primary)]" strokeWidth={3} />
                  </div>
                  
                  {/* Text label */}
                  <span className="text-[var(--accent-primary)] font-bold text-lg">
                    Yes
                  </span>
                  
                  {/* Subtitle */}
                  <span className="text-[var(--text-muted)] text-xs">
                    That&apos;s correct
                  </span>
                </motion.button>
                
                {/* No button - Red with X icon */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleConfirm(false)}
                  className="group relative flex flex-col items-center justify-center gap-3 min-h-[120px] rounded-2xl bg-gradient-to-br from-[var(--text-muted)]/10 to-transparent border-2 border-[var(--text-muted)]/50 transition-all hover:border-[var(--alert-immediate)] hover:shadow-lg"
                  aria-label="No, that's wrong"
                >
                  {/* Large icon */}
                  <div className="h-14 w-14 rounded-full bg-[var(--text-muted)]/20 border-2 border-[var(--text-muted)] flex items-center justify-center group-hover:bg-[var(--alert-immediate)]/20 group-hover:border-[var(--alert-immediate)] transition-colors">
                    <X className="h-8 w-8 text-[var(--text-muted)] group-hover:text-[var(--alert-immediate)]" strokeWidth={3} />
                  </div>
                  
                  {/* Text label */}
                  <span className="text-[var(--text-secondary)] font-bold text-lg group-hover:text-[var(--alert-immediate)]">
                    No
                  </span>
                  
                  {/* Subtitle */}
                  <span className="text-[var(--text-muted)] text-xs">
                    Not correct
                  </span>
                </motion.button>
              </div>
              
              {/* Accessibility note */}
              <p className="text-center text-[var(--text-muted)] text-xs mt-4">
                Tap the large buttons to respond
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Hand, Heart, Shield, Zap, ArrowRight, Sparkles } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08 },
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden">
      {/* Gradient orb background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[var(--accent-primary)]/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[var(--accent-primary)]/5 blur-[80px]" />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30">
              <Hand className="h-5 w-5 text-[var(--accent-primary)]" />
            </div>
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Sign-to-Health AI
            </span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-medium text-[var(--bg-primary)] transition-all hover:bg-[var(--accent-secondary)] hover:shadow-[0_0_24px_var(--accent-glow)]"
            >
              Launch App
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 sm:pt-40 lg:pt-48">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-2 mb-8"
          >
            <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
            <span className="text-sm font-medium text-[var(--accent-primary)]">
              The World&apos;s First Multimodal Medical Accessibility Platform
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.1]"
          >
            Giving{" "}
            <span className="text-[var(--accent-primary)]">non-verbal</span>{" "}
            patients a voice in healthcare
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed"
          >
            Real-time medical interpreter that translates sign language, gestures,
            facial expressions, and emotional signals into structured clinical
            understanding for doctors.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/app"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[48px] rounded-xl bg-[var(--accent-primary)] px-8 py-4 text-base font-semibold text-[var(--bg-primary)] transition-all hover:bg-[var(--accent-secondary)] hover:shadow-[0_0_32px_var(--accent-glow)]"
            >
              Try It Now
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center min-h-[48px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-8 py-4 text-base font-medium transition-colors hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/5"
            >
              See How It Works
            </a>
          </motion.div>
        </div>
      </section>

      {/* Stats / Social proof */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="py-16 px-4 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { value: "24/7", label: "Available" },
              { value: "Real-time", label: "Translation" },
              { value: "ER & Mental Health", label: "Use Cases" },
              { value: "AI-Powered", label: "Triage" },
            ].map((stat, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-glass)] backdrop-blur-xl p-6 text-center"
              >
                <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--accent-primary)]">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-[family-name:var(--font-display)] text-3xl font-bold text-center sm:text-4xl"
          >
            How It Works
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-3 text-center text-[var(--text-secondary)] max-w-2xl mx-auto"
          >
            A new interface between human bodies and medicine.
          </motion.p>

          <motion.div
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              {
                icon: Hand,
                title: "Capture",
                desc: "Camera captures sign language, gestures, and facial expressions via MediaPipe.",
              },
              {
                icon: Heart,
                title: "Emotion",
                desc: "AI detects pain, stress, anxiety, and distress for human-level empathy.",
              },
              {
                icon: Zap,
                title: "Reason",
                desc: "Medical LLMs translate signals into structured clinical understanding.",
              },
              {
                icon: Shield,
                title: "Deliver",
                desc: "Doctors get voice summaries, SOAP notes, ICD-10 codes. Patients get confirmation.",
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="group rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 transition-all hover:border-[var(--accent-primary)]/30 hover:shadow-[0_0_24px_var(--accent-glow)]/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] group-hover:bg-[var(--accent-primary)]/30 transition-colors">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-display)] font-semibold text-lg">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl rounded-3xl border border-[var(--accent-primary)]/30 bg-gradient-to-b from-[var(--accent-primary)]/10 to-transparent p-8 sm:p-12 text-center"
        >
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold sm:text-3xl">
            Ready to bridge the gap?
          </h2>
          <p className="mt-3 text-[var(--text-secondary)]">
            Start using Sign-to-Health AI in your practice or as a patient.
          </p>
          <Link
            href="/app"
            className="mt-8 inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-[var(--accent-primary)] px-8 py-4 text-base font-semibold text-[var(--bg-primary)] transition-all hover:bg-[var(--accent-secondary)]"
          >
            Launch Interpreter
            <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-[var(--border-default)]">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Hand className="h-5 w-5 text-[var(--accent-primary)]" />
            <span className="font-[family-name:var(--font-display)] font-semibold">
              Sign-to-Health AI
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            A new interface between human bodies and medicine.
          </p>
        </div>
      </footer>
    </div>
  );
}

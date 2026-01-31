"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Hand, Cpu } from "lucide-react";
import CameraCapture from "@/components/CameraCapture";
import DoctorOutput from "@/components/DoctorOutput";
import PatientConfirmation from "@/components/PatientConfirmation";
import BodyAvatar3D from "@/components/BodyAvatar3D";
import EmergencyOverlay from "@/components/EmergencyOverlay";
import ExplainabilityPanel from "@/components/ExplainabilityPanel";
import SessionPanel from "@/components/SessionPanel";
import { isEmergencySituation } from "@/lib/emergencyMode";
import { getPainRegionFromGestures } from "@/lib/painRegion";
import { initializeAllAIServices, getActiveAIServicesSummary, type AIInitResult } from "@/lib/aiInitializer";
import type { GestureState, BodyPoseState } from "@/lib/types";

export default function AppPage() {
  const [gestureState, setGestureState] = useState<GestureState | null>(null);
  const [clinicalInterpretation, setClinicalInterpretation] = useState<string | null>(null);
  const [poseState, setPoseState] = useState<BodyPoseState | null>(null);
  const [aiStatus, setAiStatus] = useState<AIInitResult | null>(null);

  // Initialize AI services on mount
  useEffect(() => {
    initializeAllAIServices().then(result => {
      setAiStatus(result);
      console.log("AI Services initialized:", result);
    });
  }, []);

  const painRegion = useMemo(() => getPainRegionFromGestures(gestureState), [gestureState]);
  
  // Check for emergency from gestures OR from fall detection
  const isEmergency = useMemo(
    () => {
      // Traditional gesture-based emergency
      const gestureEmergency = isEmergencySituation(gestureState, clinicalInterpretation);
      // Fall-based emergency
      const fallEmergency = poseState?.bodyState?.isFallen || false;
      return gestureEmergency || fallEmergency;
    },
    [gestureState, clinicalInterpretation, poseState]
  );

  // Patient confirmation handler
  const handlePatientConfirm = useCallback((correct: boolean) => {
    console.log("Patient confirmation:", correct ? "Correct" : "Incorrect");
    // In production: Update session record, trigger re-assessment if incorrect
  }, []);

  return (
    <>
      <EmergencyOverlay active={isEmergency} />
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-[var(--border-default)] bg-[var(--bg-primary)]/90 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-primary)]/20">
                <Hand className="h-4 w-4 text-[var(--accent-primary)]" />
              </div>
              <span className="font-[family-name:var(--font-display)] font-semibold">
                Sign-to-Health AI
              </span>
            </div>
            {/* AI Status indicator */}
            <div className="flex items-center gap-2">
              {aiStatus && (
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs">
                  <Cpu className={`h-3 w-3 ${aiStatus.services.openai || aiStatus.services.google ? 'text-green-500' : 'text-gray-400'}`} />
                  <span className="text-[var(--text-secondary)]">
                    {getActiveAIServicesSummary()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content - responsive grid */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Left: Camera + 3D Avatar */}
              <div className="order-2 lg:order-1 space-y-6">
                <CameraCapture
                  onGestureUpdate={setGestureState}
                  onInterpretation={setClinicalInterpretation}
                  onPoseUpdate={setPoseState}
                />
                
                {/* 3D Avatar - shows beneath camera on left side */}
                <div className="hidden lg:block">
                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden">
                    <div className="h-[350px]">
                      <BodyAvatar3D
                        painRegion={painRegion}
                        isEmergency={isEmergency}
                        poseState={poseState}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Session Panel - desktop only */}
                <div className="hidden lg:block">
                  <SessionPanel
                    gestureState={gestureState}
                    clinicalInterpretation={clinicalInterpretation}
                  />
                </div>
              </div>

              {/* Right: Doctor Output + Patient Confirmation + Explainability */}
              <div className="order-1 lg:order-2 space-y-6">
                {/* Doctor Output */}
                <DoctorOutput
                  gestureState={gestureState}
                  clinicalInterpretation={clinicalInterpretation}
                />
                
                {/* 3D Avatar - shows on right for mobile */}
                <div className="lg:hidden">
                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden">
                    <div className="h-[300px]">
                      <BodyAvatar3D
                        painRegion={painRegion}
                        isEmergency={isEmergency}
                        poseState={poseState}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Explainability Panel */}
                <ExplainabilityPanel
                  gestureState={gestureState}
                  clinicalInterpretation={clinicalInterpretation}
                />
                
                {/* Patient Confirmation */}
                <PatientConfirmation 
                  clinicalInterpretation={clinicalInterpretation}
                  onConfirm={handlePatientConfirm}
                />
                
                {/* Session Panel - mobile only */}
                <div className="lg:hidden">
                  <SessionPanel
                    gestureState={gestureState}
                    clinicalInterpretation={clinicalInterpretation}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

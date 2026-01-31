/**
 * API Route: /api/sessions
 * 
 * Methods:
 * - GET: List all sessions (with optional filters)
 * - POST: Create a new session
 * - DELETE: Clear all sessions
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllSessions,
  saveSession,
  clearAllSessions,
  getSessionsByDateRange,
  getEmergencySessions,
  getSessionStats,
} from "@/lib/db";
import type { SessionRecord } from "@/lib/automation";

/**
 * GET /api/sessions
 * 
 * Query params:
 * - filter: "all" | "emergencies" | "today" | "week"
 * - stats: "true" to get statistics instead of sessions
 * - startDate: Unix timestamp for date range filter
 * - endDate: Unix timestamp for date range filter
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";
    const stats = searchParams.get("stats") === "true";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Return statistics if requested
    if (stats) {
      const sessionStats = await getSessionStats();
      return NextResponse.json({
        success: true,
        data: sessionStats,
      });
    }

    let sessions: SessionRecord[];

    // Apply filters
    if (filter === "emergencies") {
      sessions = await getEmergencySessions();
    } else if (filter === "today") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      sessions = await getSessionsByDateRange(todayStart.getTime(), Date.now());
    } else if (filter === "week") {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      sessions = await getSessionsByDateRange(weekAgo, Date.now());
    } else if (startDate && endDate) {
      sessions = await getSessionsByDateRange(
        parseInt(startDate),
        parseInt(endDate)
      );
    } else {
      sessions = await getAllSessions();
    }

    return NextResponse.json({
      success: true,
      data: sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch sessions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions
 * 
 * Body: SessionRecord object
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.id || !body.timestamp) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: id, timestamp",
        },
        { status: 400 }
      );
    }

    const session: SessionRecord = {
      id: body.id,
      timestamp: body.timestamp,
      duration: body.duration || 0,
      gestureTokens: body.gestureTokens || [],
      painRegion: body.painRegion || null,
      emotion: body.emotion || null,
      clinicalInterpretation: body.clinicalInterpretation || null,
      triageUrgency: body.triageUrgency || null,
      soapNote: body.soapNote || null,
      icd10Codes: body.icd10Codes || [],
      patientConfirmed: body.patientConfirmed ?? null,
      emergencyTriggered: body.emergencyTriggered || false,
    };

    const saved = await saveSession(session);

    return NextResponse.json(
      {
        success: true,
        data: saved,
        message: "Session saved successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save session",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions
 * 
 * Clears all sessions (use with caution)
 */
export async function DELETE() {
  try {
    await clearAllSessions();

    return NextResponse.json({
      success: true,
      message: "All sessions cleared",
    });
  } catch (error) {
    console.error("DELETE /api/sessions error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear sessions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

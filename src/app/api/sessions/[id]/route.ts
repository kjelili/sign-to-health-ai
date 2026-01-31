/**
 * API Route: /api/sessions/[id]
 * 
 * Methods:
 * - GET: Get a specific session
 * - PUT: Update a session
 * - DELETE: Delete a session
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionById, saveSession, deleteSession } from "@/lib/db";
import type { SessionRecord } from "@/lib/automation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getSessionById(id);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Session not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error("GET /api/sessions/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch session",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sessions/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if session exists
    const existing = await getSessionById(id);
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Session not found",
        },
        { status: 404 }
      );
    }

    // Merge updates with existing session
    const updated: SessionRecord = {
      ...existing,
      ...body,
      id, // Ensure ID doesn't change
    };

    const saved = await saveSession(updated);

    return NextResponse.json({
      success: true,
      data: saved,
      message: "Session updated successfully",
    });
  } catch (error) {
    console.error("PUT /api/sessions/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update session",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await deleteSession(id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Session not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Session deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/sessions/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete session",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

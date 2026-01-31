/**
 * API Route: /api/settings
 * 
 * Methods:
 * - GET: Get current settings
 * - PUT: Update settings
 * - DELETE: Reset settings to default
 */

import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, resetSettings } from "@/lib/db";

/**
 * GET /api/settings
 */
export async function GET() {
  try {
    const settings = await getSettings();

    // Don't expose API keys in response (security)
    const safeSettings = {
      ...settings,
      humeApiKey: settings.humeApiKey ? "***configured***" : undefined,
      elevenLabsApiKey: settings.elevenLabsApiKey ? "***configured***" : undefined,
    };

    return NextResponse.json({
      success: true,
      data: safeSettings,
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch settings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * 
 * Body: Partial settings object
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate boolean fields
    const updates: Record<string, unknown> = {};

    if (typeof body.autoSaveEnabled === "boolean") {
      updates.autoSaveEnabled = body.autoSaveEnabled;
    }
    if (typeof body.voiceSummaryEnabled === "boolean") {
      updates.voiceSummaryEnabled = body.voiceSummaryEnabled;
    }
    if (typeof body.emergencyAlertEnabled === "boolean") {
      updates.emergencyAlertEnabled = body.emergencyAlertEnabled;
    }
    if (typeof body.maxSessionHistory === "number" && body.maxSessionHistory > 0) {
      updates.maxSessionHistory = body.maxSessionHistory;
    }

    // API keys (only update if provided and not the masked value)
    if (body.humeApiKey && body.humeApiKey !== "***configured***") {
      updates.humeApiKey = body.humeApiKey;
    }
    if (body.elevenLabsApiKey && body.elevenLabsApiKey !== "***configured***") {
      updates.elevenLabsApiKey = body.elevenLabsApiKey;
    }

    const updated = await updateSettings(updates);

    // Return safe settings
    const safeSettings = {
      ...updated,
      humeApiKey: updated.humeApiKey ? "***configured***" : undefined,
      elevenLabsApiKey: updated.elevenLabsApiKey ? "***configured***" : undefined,
    };

    return NextResponse.json({
      success: true,
      data: safeSettings,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update settings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings
 * 
 * Resets settings to default
 */
export async function DELETE() {
  try {
    const settings = await resetSettings();

    return NextResponse.json({
      success: true,
      data: settings,
      message: "Settings reset to default",
    });
  } catch (error) {
    console.error("DELETE /api/settings error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset settings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

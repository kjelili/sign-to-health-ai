/**
 * API Route: /api/settings/keys
 * 
 * Secure endpoint for getting API keys (used by client-side services)
 * 
 * Methods:
 * - GET: Get API keys (returns actual values, use with caution)
 * 
 * Note: In production, consider additional authentication
 */

import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";

/**
 * GET /api/settings/keys
 * 
 * Returns API keys for client-side use
 * Warning: These keys are exposed to the client - use server-side proxy in production
 */
export async function GET() {
  try {
    const settings = await getSettings();

    return NextResponse.json({
      success: true,
      data: {
        humeApiKey: settings.humeApiKey || null,
        elevenLabsApiKey: settings.elevenLabsApiKey || null,
      },
    });
  } catch (error) {
    console.error("GET /api/settings/keys error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch API keys",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

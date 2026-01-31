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

    // First check environment variables, then fall back to database settings
    const keys = {
      humeApiKey: process.env.NEXT_PUBLIC_HUME_API_KEY || settings.humeApiKey || null,
      elevenLabsApiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || settings.elevenLabsApiKey || null,
      openaiApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || settings.openaiApiKey || null,
      googleApiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || settings.googleApiKey || null,
      langchainApiKey: process.env.LANGCHAIN_API_KEY || settings.langchainApiKey || null,
    };

    return NextResponse.json({
      success: true,
      data: keys,
      // Indicate which keys are configured (without exposing them)
      configured: {
        hume: !!keys.humeApiKey,
        elevenLabs: !!keys.elevenLabsApiKey,
        openai: !!keys.openaiApiKey,
        google: !!keys.googleApiKey,
        langchain: !!keys.langchainApiKey,
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

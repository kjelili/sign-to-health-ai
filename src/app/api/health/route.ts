/**
 * API Route: /api/health
 * 
 * Health check endpoint for monitoring
 * 
 * Methods:
 * - GET: Get system health status
 */

import { NextResponse } from "next/server";
import { getDatabaseInfo, getSessionStats, initDatabase } from "@/lib/db";

/**
 * GET /api/health
 * 
 * Returns system health status
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Initialize database if needed
    await initDatabase();

    // Get database info
    const dbInfo = await getDatabaseInfo();
    const stats = await getSessionStats();

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      database: {
        status: "connected",
        sessionCount: dbInfo.sessionCount,
        dataDir: dbInfo.dataDir,
      },
      statistics: {
        totalSessions: stats.total,
        emergencies: stats.emergencies,
        avgDuration: `${Math.round(stats.avgDuration / 1000)}s`,
        triageBreakdown: stats.byTriage,
      },
      services: {
        mediaPipe: "client-side",
        humeAI: "optional (requires API key)",
        elevenLabs: "optional (requires API key)",
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error("GET /api/health error:", error);
    return NextResponse.json(
      {
        success: false,
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}

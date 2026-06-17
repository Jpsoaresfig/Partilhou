/**
 * GET /api/health — readiness simples (nao expoe segredos).
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "partilhou-api",
    time: new Date().toISOString(),
  });
}

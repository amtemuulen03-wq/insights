export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(
      `${process.env.INSIGHT_API_URL}/health/db`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    return Response.json(await response.json());
  } catch (error) {
    console.error("[Backend health check failed]", error);

    return Response.json(
      {
        ok: false,
        message: "Database service unavailable",
      },
      { status: 503 },
    );
  }
}
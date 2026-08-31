export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiUrl = process.env.INSIGHT_API_URL?.replace(/\/+$/, "");

  if (!apiUrl) {
    return Response.json(
      { message: "Internal API is not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${apiUrl}/dashboard/past-campaigns`, {
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
    const data = await response.json();

    return Response.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[Past campaigns failed]", error);
    return Response.json(
      { message: "Past campaigns unavailable" },
      { status: 503 },
    );
  }
}

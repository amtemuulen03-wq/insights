export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiUrl = process.env.INSIGHT_API_URL;

  if (!apiUrl) {
    return Response.json(
      { message: "Internal API is not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `${apiUrl}/dashboard/filters`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );

    const data = await response.json();

    return Response.json(data, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Dashboard filters failed]", error);

    return Response.json(
      { message: "Filter data unavailable" },
      { status: 503 },
    );
  }
}
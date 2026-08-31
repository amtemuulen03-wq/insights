export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiUrl = process.env.INSIGHT_API_URL;

  if (!apiUrl) {
    return Response.json(
      { message: "Internal API is not configured" },
      { status: 500 },
    );
  }

  try {
    const search = new URL(request.url).search;
    const response = await fetch(
      `${apiUrl}/dashboard/campaign-detail${search}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(90_000),
      },
    );
    const data = await response.json();

    return Response.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[Campaign detail failed]", error);

    return Response.json(
      { message: "Campaign detail unavailable" },
      { status: 503 },
    );
  }
}

import DashboardClient, {
  type DashboardRankings,
  type DashboardSummary,
  type DashboardTimeSeries,
  type FilterRow,
  type PastCampaignOption,
} from "./dashboard-client";

export const dynamic = "force-dynamic";

type FilterEnvelope = {
  items?: FilterRow[];
  rows?: FilterRow[];
  data?: FilterRow[];
  filters?: FilterRow[];
};

type PastCampaignEnvelope = {
  items?: PastCampaignOption[];
};

async function fetchApi<T>(path: string): Promise<T> {
  const apiBaseUrl =
    process.env.INSIGHT_API_URL?.replace(/\/+$/, "");

  if (!apiBaseUrl) {
    throw new Error("INSIGHT_API_URL is not configured");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Insight API ${path} returned ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

function extractFilterRows(
  payload: FilterEnvelope | FilterRow[],
): FilterRow[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload.items,
    payload.rows,
    payload.data,
    payload.filters,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function previousPeriod(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const dayMilliseconds = 86_400_000;
  const periodDays =
    Math.round(
      (endDate.getTime() - startDate.getTime()) / dayMilliseconds,
    ) + 1;
  const previousEnd = new Date(startDate.getTime() - dayMilliseconds);
  const previousStart = new Date(
    previousEnd.getTime() - (periodDays - 1) * dayMilliseconds,
  );

  return {
    start: previousStart.toISOString().slice(0, 10),
    end: previousEnd.toISOString().slice(0, 10),
  };
}

export default async function CampaignDashboardPage() {
  const [
    summary,
    timeSeries,
    rankings,
    filterPayload,
    pastCampaignPayload,
  ] = await Promise.all([
    fetchApi<DashboardSummary>("/dashboard/summary"),
    fetchApi<DashboardTimeSeries>("/dashboard/timeseries"),
    fetchApi<DashboardRankings>("/dashboard/rankings"),
    fetchApi<FilterEnvelope | FilterRow[]>(
      "/dashboard/filters",
    ),
    fetchApi<PastCampaignEnvelope>("/dashboard/past-campaigns")
      .catch(() => ({ items: [] })),
  ]);
  const previous = previousPeriod(summary.period.start, summary.period.end);
  const previousQuery = new URLSearchParams(previous);
  const previousSummary = await fetchApi<DashboardSummary>(
    `/dashboard/summary?${previousQuery}`,
  );

  return (
    <DashboardClient
      initialSummary={summary}
      initialPreviousSummary={previousSummary}
      initialTimeSeries={timeSeries}
      initialRankings={rankings}
      filterRows={extractFilterRows(filterPayload)}
      pastCampaigns={pastCampaignPayload.items ?? []}
    />
  );
}

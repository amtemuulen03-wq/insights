import { notFound } from "next/navigation";

import CampaignDetailClient, {
  type CampaignDetail,
} from "../../components/campaign-detail-client";

export const dynamic = "force-dynamic";

type CampaignFilterRow = {
  campaignName?: string | null;
};
type CampaignFilterPayload =
  | CampaignFilterRow[]
  | {
      rows?: CampaignFilterRow[];
      items?: CampaignFilterRow[];
      data?: CampaignFilterRow[];
      filters?: CampaignFilterRow[];
    };

function extractFilterRows(payload: CampaignFilterPayload) {
  if (Array.isArray(payload)) return payload;
  return (
    [payload.rows, payload.items, payload.data, payload.filters].find(
      Array.isArray,
    ) ?? []
  );
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignName: string }>;
}) {
  const { campaignName } = await params;
  const apiBaseUrl = process.env.INSIGHT_API_URL?.replace(/\/+$/, "");

  if (!apiBaseUrl) {
    throw new Error("INSIGHT_API_URL is not configured");
  }

  const apiQuery = new URLSearchParams({ campaign: campaignName });

  const response = await fetch(
    `${apiBaseUrl}/dashboard/campaign-detail?${apiQuery}`,
    { cache: "no-store" },
  );

  if (response.status === 404) notFound();
  if (!response.ok) {
    throw new Error(`Campaign API returned ${response.status}`);
  }

  const detail = (await response.json()) as CampaignDetail;
  const filtersResponse = await fetch(`${apiBaseUrl}/dashboard/filters`, {
    cache: "no-store",
  });
  let campaignOptions = [campaignName];

  if (filtersResponse.ok) {
    const filterPayload =
      (await filtersResponse.json()) as CampaignFilterPayload;
    const filterRows = extractFilterRows(filterPayload);
    campaignOptions = Array.from(
      new Set(
        [campaignName, ...filterRows
          .map((row) => row.campaignName)
          .filter((value): value is string => Boolean(value))],
      ),
    ).sort((left, right) => left.localeCompare(right));
  }

  return (
    <CampaignDetailClient
      initialDetail={detail}
      campaignOptions={campaignOptions}
    />
  );
}

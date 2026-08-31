import { notFound } from "next/navigation";

import CampaignDetailClient, {
  type CampaignDetail,
} from "../components/campaign-detail-client";

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
  searchParams,
}: {
  searchParams: Promise<{
    campaign?: string;
  }>;
}) {
  const query = await searchParams;
  const campaignName = query.campaign?.trim();
  const apiBaseUrl = process.env.INSIGHT_API_URL?.replace(/\/+$/, "");

  if (!campaignName) notFound();
  if (!apiBaseUrl) {
    throw new Error("INSIGHT_API_URL is not configured");
  }

  const apiQuery = new URLSearchParams({ campaign: campaignName });

  const [detailResponse, filtersResponse] = await Promise.all([
    fetch(`${apiBaseUrl}/dashboard/campaign-detail?${apiQuery}`, {
      cache: "no-store",
    }),
    fetch(`${apiBaseUrl}/dashboard/filters`, {
      cache: "no-store",
    }),
  ]);

  if (detailResponse.status === 404) notFound();
  if (!detailResponse.ok) {
    throw new Error(`Campaign API returned ${detailResponse.status}`);
  }

  const detail = (await detailResponse.json()) as CampaignDetail;
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
